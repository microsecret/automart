import { scraperGetText } from "@/lib/fuel-scraper-http"
import { resolveTargetRegions } from "@/lib/fuel-target-regions"
import { createFuelImportRun, finishFuelImportRun, upsertImportedStations, type ImportedStation } from "@/lib/fuel-import-store"

/**
 * Сбор наличия топлива из сервиса «Топливо» Т-Банка.
 *
 * Источник другого рода, чем остальные. ГдеБЕНЗ и ГдеЗаправка отвечают на
 * вопрос «сколько стоит», а этот — «что залито прямо сейчас», и знает он
 * это не со слов водителей, а по совершённым через банк оплатам: если за
 * последний час на колонке платили за девяносто пятый, значит он есть.
 *
 * Цен он не отдаёт вовсе — на выборке по Екатеринбургу поле цен пустое у
 * всех двухсот шестидесяти девяти точек. Поэтому источник дополняет
 * остальные, а не заменяет: цену дают одни, наличие — другой, и на карте
 * они склеиваются в одну заправку.
 *
 * Ключа не требует: сервис отдаёт данные тому же публичному запросу,
 * которым пользуется его собственная карта.
 */

const TBANK_STATIONS_API = "https://toplivo.tbank.ru/api/v1/stations"

/* Прямоугольник области целиком сервис не отдаёт: на запрос шире
   примерно градуса он отвечает пустым списком. Крупные регионы
   разрезаются на клетки такого размера — по Свердловской области это
   выходит около тридцати запросов, что укладывается в общий бюджет
   прогона. */
const MAX_CELL_DEGREES = 0.6
const DEFAULT_PAUSE_MS = 400

type TbankStation = {
  id?: string
  name?: string | null
  brand?: string | null
  addr?: string | null
  lat?: number
  lon?: number
  status?: string | null
  statusByFuelType?: Record<string, string> | null
  lastTransactionAt?: string | null
}

type TbankResponse = {
  status?: string
  payload?: TbankStation[]
}

/* Марки топлива сервиса — в наши коды. «diesel» приходит словом, бензины
   числами, газ отдельными обозначениями. */
const TBANK_FUEL_MAP: Readonly<Record<string, string>> = {
  "92": "AI92",
  "95": "AI95",
  "98": "AI98",
  "100": "AI100",
  diesel: "DT",
  dt: "DT",
  gas: "GAS",
  lpg: "GAS",
  propane: "GAS",
  methane: "GAS",
}

/* Наличие у сервиса трёхступенчатое, и средняя ступень значит «скорее
   всего есть»: оплаты были, но давно или редко. Наша карта различает
   ровно те же три состояния, поэтому перевод прямой. */
const TBANK_STATUS_MAP: Readonly<Record<string, string>> = {
  available: "yes",
  maybe_available: "low",
  not_available: "no",
}

function asText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function asNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * Режет прямоугольник региона на клетки, которые сервис отдаёт целиком.
 *
 * Область страны бывает шире пяти градусов, и на такой запрос сервис
 * молча возвращает пустой список — не ошибку, а именно пустоту. Без
 * разрезания регион выглядел бы как место, где заправок нет вовсе.
 */
export function splitIntoCells(region: { lat1: number; lon1: number; lat2: number; lon2: number }) {
  const cells: Array<{ minLat: number; maxLat: number; minLon: number; maxLon: number }> = []
  const latSteps = Math.max(1, Math.ceil((region.lat2 - region.lat1) / MAX_CELL_DEGREES))
  const lonSteps = Math.max(1, Math.ceil((region.lon2 - region.lon1) / MAX_CELL_DEGREES))
  const latSize = (region.lat2 - region.lat1) / latSteps
  const lonSize = (region.lon2 - region.lon1) / lonSteps

  for (let row = 0; row < latSteps; row += 1) {
    for (let column = 0; column < lonSteps; column += 1) {
      cells.push({
        minLat: region.lat1 + row * latSize,
        maxLat: region.lat1 + (row + 1) * latSize,
        minLon: region.lon1 + column * lonSize,
        maxLon: region.lon1 + (column + 1) * lonSize,
      })
    }
  }

  return cells
}

/**
 * Сводит наличие по маркам к одному состоянию заправки.
 *
 * Карта показывает точку одним цветом, а марок на ней до шести. Правило
 * простое: есть хоть одна доступная марка — заправка работает; все марки
 * пусты — она пустая; посередине — топливо на исходе.
 */
export function summarizeFuelStatus(byFuel: Record<string, string>): string | null {
  const values = Object.values(byFuel).map((value) => TBANK_STATUS_MAP[value] ?? null).filter(Boolean)
  if (!values.length) return null
  if (values.includes("yes")) return "yes"
  if (values.includes("low")) return "low"
  return "no"
}

/** Марки, которые на заправке сейчас есть, — строкой для карточки точки. */
export function listAvailableFuels(byFuel: Record<string, string>): string | null {
  const available = Object.entries(byFuel)
    .filter(([, state]) => state === "available" || state === "maybe_available")
    .map(([fuel]) => TBANK_FUEL_MAP[fuel.toLowerCase()] ?? null)
    .filter((fuel): fuel is string => Boolean(fuel))

  return available.length ? [...new Set(available)].join(",") : null
}

function normalizeStation(raw: TbankStation, city: string): ImportedStation | null {
  const latitude = asNumber(raw.lat)
  const longitude = asNumber(raw.lon)
  if (latitude === null || longitude === null) return null
  /* Границы России с запасом: сервис изредка отдаёт точки за пределами
     запрошенного прямоугольника. */
  if (latitude < 41 || latitude > 82 || longitude < 19 || longitude > 190) return null

  const byFuel = raw.statusByFuelType ?? {}
  const sourceId = asText(raw.id) ?? `${latitude.toFixed(6)}:${longitude.toFixed(6)}`

  return {
    source: "TBANK",
    sourceId,
    name: asText(raw.name),
    brand: asText(raw.brand),
    address: asText(raw.addr),
    city,
    latitude,
    longitude,
    status: summarizeFuelStatus(byFuel),
    fuelsNow: listAvailableFuels(byFuel),
    dtOnly: false,
    /* Цен у источника нет — их дают другие. Пустой список здесь не
       затирает чужие цены: склейка на карте берёт цену у того, кто её
       видит. */
    prices: [],
  }
}

export type TbankCollectOptions = {
  regionKeys?: string[]
  pauseMs?: number
}

export type TbankCollectResult = {
  runId: string | null
  status: "SUCCEEDED" | "PARTIAL" | "FAILED"
  regions: Array<{ key: string; city: string; fetched: number; saved: number; error: string | null }>
  fetched: number
  saved: number
  failed: number
  message: string | null
}

export async function collectTbank(options: TbankCollectOptions = {}): Promise<TbankCollectResult> {
  const pauseMs = options.pauseMs ?? DEFAULT_PAUSE_MS
  const regions = resolveTargetRegions(options.regionKeys)
  const run = await createFuelImportRun("TBANK", regions.length)

  const regionResults: TbankCollectResult["regions"] = []
  let fetchedTotal = 0
  let savedTotal = 0
  let failedTotal = 0

  for (const region of regions) {
    let fetched = 0
    let saved = 0
    let error: string | null = null
    const stations: ImportedStation[] = []
    /* Клетки региона перекрываются по краям, и одна заправка попадает в
       две. Отсеиваем по идентификатору сервиса, чтобы не отправлять в
       хранилище лишние записи. */
    const seen = new Set<string>()

    for (const cell of splitIntoCells(region)) {
      try {
        const query = new URLSearchParams({
          minLat: cell.minLat.toFixed(4),
          maxLat: cell.maxLat.toFixed(4),
          minLon: cell.minLon.toFixed(4),
          maxLon: cell.maxLon.toFixed(4),
        })
        const response = await scraperGetText(`${TBANK_STATIONS_API}?${query.toString()}`)
        if (!response.ok) throw new Error(`Источник ответил HTTP ${response.status}`)
        const parsed = JSON.parse(response.text) as TbankResponse
        const payload = Array.isArray(parsed.payload) ? parsed.payload : []

        for (const item of payload) {
          const station = normalizeStation(item, region.city)
          if (!station || seen.has(station.sourceId)) continue
          seen.add(station.sourceId)
          stations.push(station)
        }
        fetched += payload.length
      } catch (cause) {
        /* Отказ одной клетки не отменяет регион: остальные её соседи
           обычно отвечают, и потерять четверть города хуже, чем
           недосчитаться одного квадрата. */
        error = cause instanceof Error ? cause.message : "Источник не ответил"
      }

      if (pauseMs > 0) await new Promise((resolve) => setTimeout(resolve, pauseMs))
    }

    if (stations.length) {
      saved = await upsertImportedStations(stations, run.id)
    }
    if (error && !stations.length) failedTotal += 1

    fetchedTotal += fetched
    savedTotal += saved
    regionResults.push({ key: region.key, city: region.city, fetched, saved, error })
  }

  const status: TbankCollectResult["status"] =
    failedTotal === 0 ? "SUCCEEDED" : failedTotal === regions.length ? "FAILED" : "PARTIAL"

  await finishFuelImportRun(run.id, { status, fetched: fetchedTotal, upserted: savedTotal, failed: failedTotal })

  return {
    runId: run.id,
    status,
    regions: regionResults,
    fetched: fetchedTotal,
    saved: savedTotal,
    failed: failedTotal,
    message: null,
  }
}
