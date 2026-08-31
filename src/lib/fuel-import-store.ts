import { prisma } from "@/lib/prisma"
import { findNearestCity } from "@/lib/cities"

/**
 * Общее хранилище импортированных АЗС и цен.
 *
 * Скрейсеры (ГдеБЕНЗ, 2ГИС и другие) приводят данные к единой записи и
 * складывают сюда: точка обновляется по внешнему идентификатору, цена — по
 * марке на точке. Повторный прогон не плодит копий.
 */

export type ImportedStationPrice = {
  fuel: string
  priceRub: number
  confirmations: number
  observedAt: Date | null
}

export type ImportedStation = {
  source: string
  sourceId: string
  name: string | null
  brand: string | null
  address: string | null
  city: string
  latitude: number
  longitude: number
  status: string | null
  fuelsNow: string | null
  dtOnly: boolean
  prices: ImportedStationPrice[]
}


/* Точка приезжает с именем региона обхода, а регион — это прямоугольник:
   для «Республики Башкортостан» все две тысячи заправок получали одно имя
   на всех, и ни фильтр в админке, ни выбор города на карте по ним не
   работали. Город определяется по координатам самой точки.

   Порог в 60 км отсекает случай, когда ближайший город всё же далеко:
   заправка на трассе между городами не должна приписываться к тому, до
   которого случайно оказалось ближе. Тогда остаётся имя региона — оно
   грубое, но честное. */
const CITY_MATCH_MAX_KM = 60

function resolveStationCity(station: ImportedStation): string {
  const nearest = findNearestCity({ latitude: station.latitude, longitude: station.longitude })
  if (nearest.name && nearest.km <= CITY_MATCH_MAX_KM) return nearest.name
  return station.city
}

/* Ярлыки марок для строки ленты: администратор читает «АИ-92 62,40», а не
   «AI92 6240». Те же подписи, что на карте и в таблице админки. */
const LOG_FUEL_LABELS: Record<string, string> = {
  AI92: "АИ-92",
  AI95: "АИ-95",
  AI98: "АИ-98",
  AI100: "АИ-100",
  DT: "ДТ",
  GAS: "Газ",
}

function formatPricesForLog(prices: ImportedStationPrice[]): string | null {
  if (!prices.length) return null
  return prices
    .map((price) => `${LOG_FUEL_LABELS[price.fuel] || price.fuel} ${(price.priceRub / 100).toFixed(2).replace(".", ",")}`)
    .join(" · ")
}

/* Лента сбрасывается в базу маленькими порциями, а не одной пачкой в
   конце региона.

   Пачкой было дешевле по числу запросов, но консоль от этого стояла
   мёртвой: администратор ждал минуту в тишине, а потом получал сотню
   строк разом — по такой ленте не видно, идёт сбор или завис. Порция в
   пять строк доезжает до экрана за секунду и остаётся дешевле, чем
   вставка на каждую заправку. */
const LOG_FLUSH_SIZE = 5

type PendingLogEntry = {
  runId: string; source: string; city: string; station: string; address: string | null
  prices: string | null; status: string | null; kind: string
}

async function flushLogEntries(entries: PendingLogEntry[]) {
  if (!entries.length) return
  const batch = entries.splice(0, entries.length)
  /* Лента вспомогательная: сорванная запись строки не должна ронять
     прогон, ради которого всё и затевалось. */
  try {
    await prisma.fuelImportLogEntry.createMany({ data: batch })
  } catch (error) {
    console.error("Fuel run log write failed", error instanceof Error ? error.message : error)
  }
}

export async function upsertImportedStations(stations: ImportedStation[], runId?: string): Promise<number> {
  let saved = 0
  const logEntries: PendingLogEntry[] = []

  for (const station of stations) {
    const city = resolveStationCity(station)
    const record = await prisma.fuelStationImport.upsert({
      where: { source_sourceId: { source: station.source, sourceId: station.sourceId } },
      update: {
        name: station.name,
        brand: station.brand,
        address: station.address,
        city,
        latitude: station.latitude,
        longitude: station.longitude,
        status: station.status,
        fuelsNow: station.fuelsNow,
        dtOnly: station.dtOnly,
      },
      create: {
        source: station.source,
        sourceId: station.sourceId,
        name: station.name,
        brand: station.brand,
        address: station.address,
        city,
        latitude: station.latitude,
        longitude: station.longitude,
        status: station.status,
        fuelsNow: station.fuelsNow,
        dtOnly: station.dtOnly,
      },
      select: { id: true },
    })

    /* Марки, которых источник больше не отдаёт, удаляются.

       Раньше цены только добавлялись и обновлялись, поэтому любая
       однажды записанная марка оставалась навсегда: газ, приписанный
       Башнефти ошибкой источника, пережил и правку скрейпера, и повторный
       прогон. Заправка должна показывать то, что источник говорит о ней
       сейчас, а не объединение всего, что он говорил когда-либо. */
    const keepFuels = station.prices.map((price) => price.fuel)
    await prisma.fuelPriceImport.deleteMany({
      where: {
        stationId: record.id,
        ...(keepFuels.length ? { fuel: { notIn: keepFuels } } : {}),
      },
    })

    for (const price of station.prices) {
      await prisma.fuelPriceImport.upsert({
        where: { stationId_fuel: { stationId: record.id, fuel: price.fuel } },
        update: {
          priceRub: price.priceRub,
          confirmations: price.confirmations,
          observedAt: price.observedAt,
        },
        create: {
          stationId: record.id,
          fuel: price.fuel,
          priceRub: price.priceRub,
          confirmations: price.confirmations,
          observedAt: price.observedAt,
        },
      })
    }
    saved += 1
    if (runId) {
      logEntries.push({
        runId,
        source: station.source,
        city,
        station: station.name || station.brand || "АЗС",
        address: station.address,
        prices: formatPricesForLog(station.prices),
        status: station.status,
        kind: "STATION",
      })
      if (logEntries.length >= LOG_FLUSH_SIZE) await flushLogEntries(logEntries)
    }
  }

  await flushLogEntries(logEntries)

  return saved
}

/** Событие прогона в ленте: начало региона, ошибка, итог. */
export async function logFuelRunEvent(
  runId: string,
  entry: { source: string; kind: "REGION" | "ERROR" | "SUMMARY"; message: string; city?: string | null },
) {
  /* Лента — вспомогательная вещь: если запись строки не удалась, прогон
     из-за этого падать не должен. */
  try {
    await prisma.fuelImportLogEntry.create({
      data: { runId, source: entry.source, kind: entry.kind, message: entry.message, city: entry.city ?? null },
    })
  } catch (error) {
    console.error("Fuel run log write failed", error instanceof Error ? error.message : error)
  }
}

/* Прогоны идут каждые 15 минут и каждый пишет тысячи строк ленты. Без
   чистки таблица растёт неограниченно, а нужна она только для последних
   прогонов: старое читать некому. Чистка привязана к созданию прогона —
   так не нужен отдельный cron, который однажды забудут поставить. */
const KEEP_RUNS_WITH_LOG = 12

async function pruneOldRunLogs() {
  try {
    const keep = await prisma.fuelImportRun.findMany({
      orderBy: { startedAt: "desc" },
      take: KEEP_RUNS_WITH_LOG,
      select: { id: true },
    })
    if (!keep.length) return
    await prisma.fuelImportLogEntry.deleteMany({
      where: { runId: { notIn: keep.map((run) => run.id) } },
    })
  } catch (error) {
    console.error("Fuel run log prune failed", error instanceof Error ? error.message : error)
  }
}

export async function createFuelImportRun(source: string, requested: number) {
  const run = await prisma.fuelImportRun.create({
    data: { source, status: "RUNNING", requested },
    select: { id: true },
  })
  await pruneOldRunLogs()
  return run
}

export async function finishFuelImportRun(
  runId: string,
  result: { status: "SUCCEEDED" | "PARTIAL" | "FAILED"; fetched: number; upserted: number; failed: number; error?: string | null },
) {
  await prisma.fuelImportRun.update({
    where: { id: runId },
    data: {
      status: result.status,
      fetched: result.fetched,
      upserted: result.upserted,
      failed: result.failed,
      error: result.error ?? null,
      completedAt: new Date(),
    },
  })
}

/**
 * Пересчёт города у ранее импортированных точек.
 *
 * До привязки по координатам город брался из имени региона обхода, и все
 * точки большого региона получали имя «Республика ...» на всех. Новые
 * прогоны раскладывают точки правильно, но уже собранные тысячи так и
 * остались бы одной кучей, поэтому их разносит тем же правилом.
 */
export async function recomputeImportedCities(): Promise<{ scanned: number; updated: number }> {
  const stations = await prisma.fuelStationImport.findMany({
    select: { id: true, city: true, latitude: true, longitude: true },
  })

  let updated = 0
  for (const station of stations) {
    const nearest = findNearestCity({ latitude: station.latitude, longitude: station.longitude })
    const city = nearest.name && nearest.km <= CITY_MATCH_MAX_KM ? nearest.name : station.city
    if (!city || city === station.city) continue
    await prisma.fuelStationImport.update({ where: { id: station.id }, data: { city } })
    updated += 1
  }

  return { scanned: stations.length, updated }
}
