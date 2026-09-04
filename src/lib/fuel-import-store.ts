import { prisma } from "@/lib/prisma"
import { FUEL_TARGET_REGIONS } from "@/lib/fuel-target-regions"
import { findNearestCity } from "@/lib/cities"
import { diffFuelAvailability } from "@/lib/fuel-appeared-diff"
import { broadcastFuelAppeared } from "@/lib/fuel-appeared-broadcast"
import { AVAILABILITY_FUEL_LABELS } from "@/lib/fuel-availability"

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
  /** Очередь словами источника — её знает только Яндекс. */
  queueNote?: string | null
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

  /* Города рядом нет — значит заправка стоит на трассе между городами.

     Имя региона обхода в этом месте служебное: у прямоугольника «Урал»
     так набралось триста семьдесят четыре точки, и в списке городов
     появился «город Урал». Регион может задать честную подпись, и тогда
     берётся она. */
  const region = FUEL_TARGET_REGIONS.find((candidate) => candidate.city === station.city)
  return region?.fallbackLabel ?? station.city
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

    /* Что было на этой заправке до нынешнего прогона.

       Статус перезаписывался поверх прежнего, и переход «топлива не
       было → появилось» проходил незамеченным. А это и есть главное
       событие сервиса: за сутки водители оставляют одну-две отметки,
       а источники приносят изменения по четырнадцати тысячам
       заправок — именно там видно, где топливо появилось. */
    const previous = await prisma.fuelStationImport.findUnique({
      where: { source_sourceId: { source: station.source, sourceId: station.sourceId } },
      select: { status: true, fuelsNow: true },
    })

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
        queueNote: station.queueNote ?? null,
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
        queueNote: station.queueNote ?? null,
      },
      select: { id: true },
    })

    /* Топливо появилось там, где его не было — новость города.

       Отправка ожидается, а не отпускается в фон. При `void` все
       появления одного прогона уходили разом: каждая проверяла порог
       раньше, чем предыдущая успевала записаться, и в чат прилетали
       четыре сообщения в одну секунду. Ожидание делает порог по чату
       настоящим — сообщения идут по одному.

       Ошибку рассылка глотает сама: сбор не должен падать из-за того,
       что Telegram не ответил. */
    const change = diffFuelAvailability(previous, { status: station.status, fuelsNow: station.fuelsNow })
    if (change.appeared.length > 0) {
      await broadcastFuelAppeared({
        stationId: `${station.source.toLowerCase()}-${station.sourceId}`,
        stationName: station.name || station.brand || "АЗС",
        address: station.address,
        city,
        fuelLabels: change.appeared.map((fuel) => AVAILABILITY_FUEL_LABELS[fuel as keyof typeof AVAILABILITY_FUEL_LABELS] || fuel),
        latitude: station.latitude,
        longitude: station.longitude,
        /* Честно: это заметил сбор, а не человек у колонки. */
        origin: "source",
      })
    }

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
const KEEP_RUNS_WITH_LOG = 3

/* Потолок ленты в строках, а не только в прогонах.

   Двенадцати прогонов казалось немного, но каждый пишет строку на каждую
   заправку: лента доросла до 80 тысяч строк и 23 МБ — против 4 МБ самих
   заправок с ценами, ради которых всё и собирается. Хранилище съедала
   отладочная информация, а не данные.

   Консоль нужна, чтобы видеть идущий сбор и разобрать последний сбой;
   для этого хватает трёх прогонов и потолка в строках, который держит
   ленту в узде, даже если один прогон окажется огромным. */
const KEEP_LOG_ENTRIES = 12_000

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

    /* Строки сверх потолка режутся по возрасту: свежие нужнее старых,
       потому что смотрят всегда на текущий прогон. */
    const total = await prisma.fuelImportLogEntry.count()
    if (total <= KEEP_LOG_ENTRIES) return

    const cutoff = await prisma.fuelImportLogEntry.findMany({
      orderBy: { createdAt: "desc" },
      skip: KEEP_LOG_ENTRIES,
      take: 1,
      select: { createdAt: true },
    })
    if (!cutoff.length) return
    await prisma.fuelImportLogEntry.deleteMany({
      where: { createdAt: { lt: cutoff[0].createdAt } },
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
  /* NOT_CONFIGURED — источник не запускался, потому что ему не хватает
     ключа или настройки. Это тоже исход прогона: без записи в истории
     такой источник молчит, и в админке он выглядит просто не
     запускавшимся. */
  result: { status: "SUCCEEDED" | "PARTIAL" | "FAILED" | "NOT_CONFIGURED"; fetched: number; upserted: number; failed: number; error?: string | null },
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
