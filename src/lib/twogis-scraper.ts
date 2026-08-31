import { scraperGetText } from "@/lib/fuel-scraper-http"
import { parseReportedPrice } from "@/lib/fuel-price-reports"
import { resolveTargetRegions } from "@/lib/fuel-target-regions"
import { createFuelImportRun, finishFuelImportRun, upsertImportedStations, type ImportedStation } from "@/lib/fuel-import-store"

/**
 * Сбор АЗС и цен из каталога 2ГИС.
 *
 * 2ГИС отдаёт точки и цены через Catalog API 3.0, но требует ключ: без
 * `TWOGIS_API_KEY` (официальный ключ) или `TWOGIS_PUBLIC_KEY` (ключ из
 * браузерной сессии) адаптер не запускается и честно сообщает об этом.
 * Структура `fuel_prices` у 2ГИС не публична и может меняться, поэтому
 * парсер терпим к нескольким форматам и просто пропускает то, что не
 * распознал.
 */

const TWOGIS_CATALOG_API = "https://catalog.api.2gis.ru/3.0/items"
const TWOGIS_RUBRIC = "fuel" // рубрика «АЗС» в каталоге
const PAGE_SIZE = 50
const MAX_PAGES_PER_REGION = 20
const DEFAULT_PAUSE_MS = 800

type TwogisFuelPriceEntry = {
  fuel_type?: unknown
  fuel?: unknown
  type?: unknown
  name?: unknown
  price?: unknown
  value?: unknown
  amount?: unknown
  updated_at?: unknown
  date?: unknown
}

type TwogisItem = {
  id?: string
  name?: string
  point?: { lat?: number; lon?: number }
  address_name?: string
  fuel_prices?: unknown
}

type TwogisResponse = {
  meta?: { code?: number; error?: { message?: string } }
  result?: { total?: number; items?: TwogisItem[] }
}

const TWOGIS_FUEL_MAP: Readonly<Record<string, string>> = {
  "92": "AI92", gasoline_92: "AI92", ai92: "AI92", a92: "AI92",
  "95": "AI95", gasoline_95: "AI95", ai95: "AI95", a95: "AI95",
  "98": "AI98", gasoline_98: "AI98", ai98: "AI98", a98: "AI98",
  "100": "AI100", gasoline_100: "AI100", ai100: "AI100", a100: "AI100",
  "ДТ": "DT", diesel: "DT", dt: "DT",
  lpg: "GAS", gas: "GAS", propane: "GAS", cng: "GAS", methane: "GAS",
}

function asNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function asText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function normalizeTwogisFuelCode(value: unknown) {
  const code = asText(value)?.toLocaleLowerCase("en-US").replace(/[\s-]+/g, "_")
  return code ? TWOGIS_FUEL_MAP[code] ?? TWOGIS_FUEL_MAP[asText(value) ?? ""] ?? null : null
}

function extractFuelPrices(value: unknown): TwogisFuelPriceEntry[] {
  if (Array.isArray(value)) return value.filter((entry): entry is TwogisFuelPriceEntry => Boolean(entry && typeof entry === "object"))
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>
    if (Array.isArray(record.prices)) return extractFuelPrices(record.prices)
    /* Иногда цены приходят словарём «марка → цена». */
    return Object.entries(record).flatMap(([key, entry]) => {
      if (["updated_at", "date", "currency"].includes(key)) return []
      if (typeof entry === "number" || typeof entry === "string") return [{ fuel_type: key, price: entry }]
      if (entry && typeof entry === "object") return [{ fuel_type: key, ...(entry as Record<string, unknown>) }]
      return []
    })
  }
  return []
}

function parseObservedAt(value: unknown): Date | null {
  if (typeof value === "string" && value.trim()) {
    const date = new Date(value)
    if (!Number.isNaN(date.getTime())) return date
  }
  return null
}

function normalizeTwogisItem(item: TwogisItem, city: string): ImportedStation | null {
  const latitude = asNumber(item.point?.lat)
  const longitude = asNumber(item.point?.lon)
  if (latitude === null || longitude === null) return null
  if (latitude < 41 || latitude > 82 || longitude < 19 || longitude > 190) return null

  const sourceId = asText(item.id) ?? `${latitude.toFixed(6)}:${longitude.toFixed(6)}`

  const prices = extractFuelPrices(item.fuel_prices).flatMap((entry) => {
    const fuel = normalizeTwogisFuelCode(entry.fuel_type ?? entry.fuel ?? entry.type ?? entry.name)
    if (!fuel) return []
    const priceRub = parseReportedPrice(entry.price ?? entry.value ?? entry.amount)
    if (priceRub === null) return []
    return [{
      fuel,
      priceRub,
      confirmations: 0,
      observedAt: parseObservedAt(entry.updated_at ?? entry.date),
    }]
  })

  return {
    source: "TWOGIS",
    sourceId,
    name: asText(item.name),
    brand: null,
    address: asText(item.address_name),
    city,
    latitude,
    longitude,
    status: null,
    fuelsNow: null,
    dtOnly: false,
    prices,
  }
}

function configuredTwogisKey() {
  return process.env.TWOGIS_API_KEY?.trim() || process.env.TWOGIS_PUBLIC_KEY?.trim() || null
}

export type TwogisCollectOptions = {
  regionKeys?: string[]
  pauseMs?: number
}

export type TwogisCollectResult = {
  runId: string | null
  status: "SUCCEEDED" | "PARTIAL" | "FAILED" | "NOT_CONFIGURED"
  regions: Array<{ key: string; city: string; fetched: number; saved: number; error: string | null }>
  fetched: number
  saved: number
  failed: number
  message: string | null
}

export async function collectTwogis(options: TwogisCollectOptions = {}): Promise<TwogisCollectResult> {
  const apiKey = configuredTwogisKey()
  if (!apiKey) {
    return {
      runId: null,
      status: "NOT_CONFIGURED",
      regions: [],
      fetched: 0,
      saved: 0,
      failed: 0,
      message: "2ГИС требует ключ: задайте TWOGIS_API_KEY или TWOGIS_PUBLIC_KEY",
    }
  }

  const pauseMs = options.pauseMs ?? DEFAULT_PAUSE_MS
  const regions = resolveTargetRegions(options.regionKeys)
  const run = await createFuelImportRun("TWOGIS", regions.length)

  const regionResults: TwogisCollectResult["regions"] = []
  let fetchedTotal = 0
  let savedTotal = 0
  let failedTotal = 0

  for (let regionIndex = 0; regionIndex < regions.length; regionIndex += 1) {
    const region = regions[regionIndex]
    let fetched = 0
    let saved = 0
    let error: string | null = null

    try {
      for (let page = 1; page <= MAX_PAGES_PER_REGION; page += 1) {
        const params = new URLSearchParams({
          key: apiKey,
          type: TWOGIS_RUBRIC,
          page: String(page),
          page_size: String(PAGE_SIZE),
          point1: `${region.lon1},${region.lat1}`,
          point2: `${region.lon2},${region.lat2}`,
          fields: "items.point,items.name,items.address_name,items.fuel_prices",
        })
        const response = await scraperGetText(`${TWOGIS_CATALOG_API}?${params.toString()}`, {
          headers: { Referer: "https://2gis.ru/" },
          pauseMs: Math.max(8_000, pauseMs * 4),
        })
        if (!response.ok) throw new Error(`2ГИС ответил HTTP ${response.status}`)

        const payload = JSON.parse(response.text) as TwogisResponse
        if (payload.meta?.code && payload.meta.code >= 400) {
          throw new Error(payload.meta.error?.message || `2ГИС вернул код ${payload.meta.code}`)
        }

        const items = Array.isArray(payload.result?.items) ? payload.result.items : []
        fetched += items.length
        const stations = items
          .map((item) => normalizeTwogisItem(item, region.city))
          .filter((station): station is ImportedStation => station !== null)
        saved += await upsertImportedStations(stations, run.id)

        const total = payload.result?.total ?? 0
        if (!items.length || fetched >= total) break
        await new Promise((resolve) => setTimeout(resolve, pauseMs))
      }
    } catch (caught) {
      error = caught instanceof Error ? caught.message : "Не удалось собрать регион"
      failedTotal += 1
    }

    fetchedTotal += fetched
    savedTotal += saved
    regionResults.push({ key: region.key, city: region.city, fetched, saved, error })

    if (regionIndex < regions.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, pauseMs))
    }
  }

  const status: TwogisCollectResult["status"] = failedTotal === 0 ? "SUCCEEDED" : failedTotal === regions.length ? "FAILED" : "PARTIAL"
  await finishFuelImportRun(run.id, {
    status,
    fetched: fetchedTotal,
    upserted: savedTotal,
    failed: failedTotal,
    error: status === "FAILED" ? "Все регионы не ответили" : null,
  })

  return { runId: run.id, status, regions: regionResults, fetched: fetchedTotal, saved: savedTotal, failed: failedTotal, message: null }
}
