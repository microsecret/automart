import { scraperGetText } from "@/lib/fuel-scraper-http"
import { parseReportedPrice } from "@/lib/fuel-price-reports"
import { resolveTargetRegions, type FuelTargetRegion } from "@/lib/fuel-target-regions"
import { createFuelImportRun, finishFuelImportRun, upsertImportedStations, type ImportedStation } from "@/lib/fuel-import-store"

/**
 * Сбор АЗС и цен с gdezapravka.ru.
 *
 * Источник отдаёт точки и цены двумя запросами по прямоугольнику:
 * /api/stations?bbox=lat1,lon1,lat2,lon2 отдаёт справочник с наличием,
 * /api/prices?bbox= — цены по станциям и медиану по брендам. Цена станции
 * берётся из её собственных отметок; если их нет, подставляется брендовая
 * медиана, чтобы карта не оставалась пустой там, где отмечали мало.
 */

const GDEZAPRAVKA_STATIONS_API = "https://gdezapravka.ru/api/stations"
const GDEZAPRAVKA_PRICES_API = "https://gdezapravka.ru/api/prices"
const STATIONS_LIMIT = 2000
const DEFAULT_PAUSE_MS = 1_200

/* Коды марок источника — строчные; у нас они внутренние коды площадки. */
const GDEZAPRAVKA_FUEL_MAP: Readonly<Record<string, string>> = {
  ai92: "AI92",
  ai95: "AI95",
  ai98: "AI98",
  ai100: "AI100",
  dt: "DT",
  gas: "GAS",
}

/* Наличие на карте: available — есть, unavailable — нет, limited —
   ограниченный ассортимент, unknown — не отмечали. */
const GDEZAPRAVKA_STATUS_MAP: Readonly<Record<string, string>> = {
  available: "yes",
  unavailable: "no",
  limited: "low",
}

/* Ярлыки марок для строки fuelsNow — тем же видом, что у ГдеБЕНЗ. */
const GDEZAPRAVKA_FUEL_LABELS: Readonly<Record<string, string>> = {
  ai92: "92",
  ai95: "95",
  ai98: "98",
  ai100: "100",
  dt: "ДТ",
  gas: "Газ",
}

type GdezapravkaStation = {
  id?: string | number
  name?: string
  brand?: string
  lat?: number
  lng?: number
  status?: string | null
  fuel_types?: unknown
  available_fuels?: unknown
  address?: string
}

type GdezapravkaPriceEntry = {
  price?: number
  updated?: string
  trend?: string
  source?: string
  votes?: number
}

type GdezapravkaPrices = {
  brands?: Record<string, Record<string, GdezapravkaPriceEntry>>
  stations?: Record<string, Record<string, GdezapravkaPriceEntry>>
}

function asNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function asText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

/** «31.08.2026» → полночь московского времени. */
function parseUpdatedAt(value: unknown): Date | null {
  const text = asText(value)
  if (!text) return null
  const match = text.match(/^(\d{2})\.(\d{2})\.(\d{4})/)
  if (!match) return null
  const date = new Date(`${match[3]}-${match[2]}-${match[1]}T00:00:00+03:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function buildBbox(region: FuelTargetRegion) {
  return `${region.lat1.toFixed(5)},${region.lon1.toFixed(5)},${region.lat2.toFixed(5)},${region.lon2.toFixed(5)}`
}

function normalizeStation(raw: GdezapravkaStation, city: string, pricesByStation: Record<string, Record<string, GdezapravkaPriceEntry>>, pricesByBrand: Record<string, Record<string, GdezapravkaPriceEntry>>): ImportedStation | null {
  const latitude = asNumber(raw.lat)
  const longitude = asNumber(raw.lng)
  if (latitude === null || longitude === null) return null
  if (latitude < 41 || latitude > 82 || longitude < 19 || longitude > 190) return null

  const sourceId = asText(raw.id ?? `${latitude.toFixed(6)}:${longitude.toFixed(6)}`) || `${latitude.toFixed(6)}:${longitude.toFixed(6)}`
  const brand = asText(raw.brand)

  const ownPrices = pricesByStation[sourceId] ?? {}
  const brandPrices = brand ? pricesByBrand[brand] ?? {} : {}
  const mergedPrices = { ...brandPrices, ...ownPrices }

  const prices = Object.entries(mergedPrices).flatMap(([fuelCode, entry]) => {
    const fuel = GDEZAPRAVKA_FUEL_MAP[fuelCode]
    if (!fuel) return []
    const priceRub = entry?.price !== undefined ? parseReportedPrice(entry.price) : null
    if (priceRub === null) return []
    return [{
      fuel,
      priceRub,
      confirmations: Math.max(0, Math.round(asNumber(entry.votes) ?? 0)),
      observedAt: parseUpdatedAt(entry.updated),
    }]
  })

  const availableFuels = Array.isArray(raw.available_fuels)
    ? raw.available_fuels.map((value) => GDEZAPRAVKA_FUEL_LABELS[String(value)]).filter(Boolean).join(",") || null
    : null

  return {
    source: "GDEZAPRAVKA",
    sourceId,
    name: asText(raw.name),
    brand,
    address: asText(raw.address),
    city,
    latitude,
    longitude,
    status: (raw.status && GDEZAPRAVKA_STATUS_MAP[String(raw.status)]) || null,
    fuelsNow: availableFuels,
    dtOnly: false,
    prices,
  }
}

export type GdezapravkaCollectOptions = {
  regionKeys?: string[]
  pauseMs?: number
}

export type GdezapravkaCollectResult = {
  runId: string | null
  status: "SUCCEEDED" | "PARTIAL" | "FAILED"
  regions: Array<{ key: string; city: string; fetched: number; saved: number; error: string | null }>
  fetched: number
  saved: number
  failed: number
  message: string | null
}

export async function collectGdezapravka(options: GdezapravkaCollectOptions = {}): Promise<GdezapravkaCollectResult> {
  const pauseMs = options.pauseMs ?? DEFAULT_PAUSE_MS
  const regions = resolveTargetRegions(options.regionKeys)
  const run = await createFuelImportRun("GDEZAPRAVKA", regions.length)

  const regionResults: GdezapravkaCollectResult["regions"] = []
  let fetchedTotal = 0
  let savedTotal = 0
  let failedTotal = 0

  for (let index = 0; index < regions.length; index += 1) {
    const region = regions[index]
    let fetched = 0
    let saved = 0
    let error: string | null = null

    try {
      const bbox = buildBbox(region)
      const stationsResponse = await scraperGetText(`${GDEZAPRAVKA_STATIONS_API}?bbox=${encodeURIComponent(bbox)}&limit=${STATIONS_LIMIT}`, {
        headers: { Referer: "https://gdezapravka.ru/" },
        pauseMs: Math.max(8_000, pauseMs * 4),
      })
      if (!stationsResponse.ok) throw new Error(`ГдеЗаправка ответил HTTP ${stationsResponse.status}`)

      const stations = JSON.parse(stationsResponse.text) as GdezapravkaStation[]
      if (!Array.isArray(stations)) throw new Error("Неожиданный формат списка станций")

      const pricesResponse = await scraperGetText(`${GDEZAPRAVKA_PRICES_API}?bbox=${encodeURIComponent(bbox)}`, {
        headers: { Referer: "https://gdezapravka.ru/" },
        pauseMs: Math.max(8_000, pauseMs * 4),
      })
      const prices = pricesResponse.ok
        ? JSON.parse(pricesResponse.text) as GdezapravkaPrices
        : { brands: {}, stations: {} }

      const pricesByStation = prices.stations ?? {}
      const pricesByBrand = prices.brands ?? {}

      fetched = stations.length
      const imported = stations
        .map((raw) => normalizeStation(raw, region.city, pricesByStation, pricesByBrand))
        .filter((station): station is ImportedStation => station !== null)
      saved = await upsertImportedStations(imported)
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

  const status: GdezapravkaCollectResult["status"] = failedTotal === 0 ? "SUCCEEDED" : failedTotal === regions.length ? "FAILED" : "PARTIAL"
  await finishFuelImportRun(run.id, {
    status,
    fetched: fetchedTotal,
    upserted: savedTotal,
    failed: failedTotal,
    error: status === "FAILED" ? "Все регионы не ответили" : null,
  })

  return { runId: run.id, status, regions: regionResults, fetched: fetchedTotal, saved: savedTotal, failed: failedTotal, message: null }
}
