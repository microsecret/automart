import { scraperGetText } from "@/lib/fuel-scraper-http"
import { parseReportedPrice } from "@/lib/fuel-price-reports"
import { resolveTargetRegions, type FuelTargetRegion } from "@/lib/fuel-target-regions"
import { createFuelImportRun, finishFuelImportRun, upsertImportedStations, type ImportedStation } from "@/lib/fuel-import-store"

/**
 * Сбор АЗС и цен с gdebenz.ru.
 *
 * Источник отдаёт готовый список точек с ценами и наличием одним запросом
 * по прямоугольнику: /api/stations?lat1=&lon1=&lat2=&lon2=. Поэтому сбор
 * города — это один-два запроса, а не обход десятков страниц. Паузы между
 * запросами и прокси-пул защищают от блокировки.
 *
 * Данные складываются в FuelStationImport и FuelPriceImport — отдельно от
 * отметок водителей, чтобы импортированная цена не смешивалась с живой.
 */

const GDEBENZ_API = "https://gdebenz.ru/api/stations"

/** Целевые города и области — общий список для всех источников. */
export const GDEBENZ_TARGET_REGIONS = resolveTargetRegions()

/* Коды марок у ГдеБЕНЗ совпадают с внутренними кодами площадки, кроме
   дизеля: у источника он «ДТ», у нас — «DT». Газ и метан источник в ценах
   не отдаёт, поэтому в списке их нет. */
const GDEBENZ_FUEL_MAP: Readonly<Record<string, string>> = {
  "92": "AI92",
  "95": "AI95",
  "98": "AI98",
  "100": "AI100",
  "ДТ": "DT",
}

type RawGdebenzStation = {
  osm_id?: string
  name?: string
  brand?: string
  lat?: number
  lon?: number
  addr?: string
  status?: string | null
  fuels_now?: string
  dt_only?: number
  conflict?: string | null
  prices_now?: Record<string, { p?: number; n?: number; t?: string }>
}

function asFiniteNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function parseObservedAt(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null
  /* Источник отдаёт московское время без часового пояса: «2026-08-25
     17:17:40». Добавляем пояс явно, чтобы сервер в UTC не сдвинул цену
     на три часа в прошлое. */
  const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/)
  if (!match) return null
  const date = new Date(`${match[1]}T${match[2]}+03:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function normalizeStation(raw: RawGdebenzStation, city: string): ImportedStation | null {
  const latitude = asFiniteNumber(raw.lat)
  const longitude = asFiniteNumber(raw.lon)
  if (latitude === null || longitude === null) return null
  if (latitude < 41 || latitude > 82 || longitude < 19 || longitude > 190) return null

  const sourceId = String(raw.osm_id ?? `${latitude.toFixed(6)}:${longitude.toFixed(6)}`)
  if (!sourceId) return null

  const status = raw.status && ["yes", "low", "no"].includes(raw.status) ? raw.status : null

  const prices = Object.entries(raw.prices_now ?? {}).flatMap(([fuelCode, priceRecord]) => {
    const fuel = GDEBENZ_FUEL_MAP[fuelCode]
    if (!fuel) return []
    const priceRub = priceRecord?.p !== undefined ? parseReportedPrice(priceRecord.p) : null
    if (priceRub === null) return []
    const confirmations = Math.max(0, Math.round(asFiniteNumber(priceRecord.n) ?? 0))
    return [{ fuel, priceRub, confirmations, observedAt: parseObservedAt(priceRecord.t) }]
  })

  return {
    source: "GDEBENZ",
    sourceId,
    name: typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : null,
    brand: typeof raw.brand === "string" && raw.brand.trim() ? raw.brand.trim() : null,
    address: typeof raw.addr === "string" && raw.addr.trim() ? raw.addr.trim() : null,
    city,
    latitude,
    longitude,
    status,
    fuelsNow: typeof raw.fuels_now === "string" && raw.fuels_now.trim() ? raw.fuels_now.trim() : null,
    dtOnly: raw.dt_only === 1,
    prices,
  }
}

function buildStationsUrl(region: FuelTargetRegion) {
  const params = new URLSearchParams({
    lat1: region.lat1.toFixed(5),
    lon1: region.lon1.toFixed(5),
    lat2: region.lat2.toFixed(5),
    lon2: region.lon2.toFixed(5),
  })
  return `${GDEBENZ_API}?${params.toString()}`
}

export type GdebenzCollectOptions = {
  /** Подмножество ключей регионов; пусто — все целевые. */
  regionKeys?: string[]
  /** Пауза между запросами к источнику, миллисекунды. */
  pauseMs?: number
}

export type GdebenzCollectResult = {
  runId: string
  status: "SUCCEEDED" | "PARTIAL" | "FAILED"
  regions: Array<{
    key: string
    city: string
    fetched: number
    saved: number
    error: string | null
  }>
  fetched: number
  saved: number
  failed: number
}

/**
 * Один прогон сбора по целевым регионам.
 *
 * Регионы обходятся строго по одному: последовательные запросы с паузой
 * выглядят для защиты источника как обычный человек у карты, а не как
 * скрейпер с параллельным пулом.
 */
export async function collectGdebenz(options: GdebenzCollectOptions = {}): Promise<GdebenzCollectResult> {
  const pauseMs = options.pauseMs ?? 1_500
  const regions = resolveTargetRegions(options.regionKeys)

  const run = await createFuelImportRun("GDEBENZ", regions.length)

  const regionResults: GdebenzCollectResult["regions"] = []
  let fetchedTotal = 0
  let savedTotal = 0
  let failedTotal = 0

  for (let index = 0; index < regions.length; index += 1) {
    const region = regions[index]
    let fetched = 0
    let saved = 0
    let error: string | null = null

    try {
      const response = await scraperGetText(buildStationsUrl(region), {
        headers: { Referer: "https://gdebenz.ru/" },
        pauseMs: Math.max(8_000, pauseMs * 4),
      })
      if (!response.ok) throw new Error(`Источник ответил HTTP ${response.status}`)

      const payload = JSON.parse(response.text) as RawGdebenzStation[]
      if (!Array.isArray(payload)) throw new Error("Неожиданный формат ответа источника")

      fetched = payload.length
      const stations = payload
        .map((raw) => normalizeStation(raw, region.city))
        .filter((station): station is ImportedStation => station !== null)
      saved = await upsertImportedStations(stations)
    } catch (caught) {
      error = caught instanceof Error ? caught.message : "Не удалось собрать регион"
      failedTotal += 1
    }

    fetchedTotal += fetched
    savedTotal += saved
    regionResults.push({ key: region.key, city: region.city, fetched, saved, error })

    if (index < regions.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, pauseMs))
    }
  }

  const status: GdebenzCollectResult["status"] = failedTotal === 0 ? "SUCCEEDED" : failedTotal === regions.length ? "FAILED" : "PARTIAL"
  await finishFuelImportRun(run.id, {
    status,
    fetched: fetchedTotal,
    upserted: savedTotal,
    failed: failedTotal,
    error: status === "FAILED" ? "Все регионы не ответили" : null,
  })

  return { runId: run.id, status, regions: regionResults, fetched: fetchedTotal, saved: savedTotal, failed: failedTotal }
}
