import { NextRequest, NextResponse } from "next/server"
import { CITY_COORDINATES } from "@/lib/cities"
import { prisma } from "@/lib/prisma"

type OverpassElement = {
  id: number
  type: "node" | "way" | "relation"
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

type Coordinates = {
  latitude: number
  longitude: number
}

type FuelPrice = {
  fuel: string
  price: number | null
  updatedAt: string | null
}

type FuelStationPayload = {
  id: string
  sourceType: OverpassElement["type"] | "provider"
  dataSource: "OPENSTREETMAP" | "ZAPRAVKIN" | "GDEBENZ" | "TWOGIS" | "GDEZAPRAVKA" | "MERGED"
  name: string
  brand: string | null
  operator: string | null
  address: string | null
  openingHours: string | null
  fuels: string[]
  /* Марки, которые источник видит в наличии прямо сейчас: «92,95,ДТ».
     Без этого карта знает цену марки, но не знает, залили её или она
     кончилась, — и красит все марки одинаково. */
  fuelsNow?: string[]
  prices: FuelPrice[]
  status: "FUEL" | "NO_FUEL" | "UNKNOWN"
  statusUpdatedAt: string | null
  latitude: number
  longitude: number
}

type NominatimResult = {
  lat?: string
  lon?: string
  display_name?: string
}

type CachedPlace = {
  coordinates: Coordinates
  label: string
  expiresAt: number
}

type CachedDirectoryStations = {
  stations: FuelStationPayload[]
  expiresAt: number
}

type CachedStationAddress = {
  address: string | null
  expiresAt: number
}

type CachedLiveStations = {
  stations: FuelStationPayload[]
  expiresAt: number
}

type LiveProviderState = "NOT_CONFIGURED" | "READY" | "COOLDOWN" | "BUDGET_EXHAUSTED" | "UNAVAILABLE"

type LiveProviderHealth = {
  state: LiveProviderState
  limit: number | null
  remaining: number | null
  retryAt: string | null
  stale: boolean
}

const FUEL_TAG_LABELS: Record<string, string> = {
  "fuel:diesel": "ДТ",
  "fuel:octane_92": "АИ‑92",
  "fuel:octane_95": "АИ‑95",
  "fuel:octane_98": "АИ‑98",
  "fuel:octane_100": "АИ‑100",
  "fuel:lpg": "Газ",
  "fuel:compressed_natural_gas": "Метан",
  "fuel:electricity": "Зарядка EV",
}

const LIVE_FUEL_LABELS: Record<string, string> = {
  "92": "АИ‑92",
  "AI92": "АИ‑92",
  "AI-92": "АИ‑92",
  "АИ-92": "АИ‑92",
  "95": "АИ‑95",
  "AI95": "АИ‑95",
  "AI-95": "АИ‑95",
  "АИ-95": "АИ‑95",
  "98": "АИ‑98",
  "AI98": "АИ‑98",
  "AI-98": "АИ‑98",
  "АИ-98": "АИ‑98",
  "100": "АИ‑100",
  "AI100": "АИ‑100",
  "AI-100": "АИ‑100",
  "АИ-100": "АИ‑100",
  "DIESEL": "ДТ",
  "DT": "ДТ",
  "ДТ": "ДТ",
  "LPG": "Газ",
  "GAS": "Газ",
  "CNG": "Метан",
  "ELECTRIC": "Зарядка EV",
  "ELECTRICITY": "Зарядка EV",
}

const OVERPASS_ENDPOINTS = [
  "https://overpass.openstreetmap.fr/api/interpreter",
  "https://overpass-api.de/api/interpreter",
]
const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/search"
const ZAPRAVKIN_BASE_URL = (process.env.ZAPRAVKIN_API_URL || "https://api.zapravkin24.ru/v1").replace(/\/$/, "")
const PLACE_CACHE_TTL = 1000 * 60 * 60 * 12
/* Справочник заправок держится шесть часов вместо двадцати минут.

   Двадцать минут — срок для сведений, которые меняются: цены, наличие,
   очередь. Здесь же сам список точек из OpenStreetMap: новые заправки
   появляются раз в месяцы, а закрываются ещё реже. Каждые двадцать
   минут мы заново ждали четыре секунды ради того же ответа.

   Наличие и цены это не задерживает — они приходят своими запросами со
   своим сроком. */
const DIRECTORY_STATION_CACHE_TTL = 1000 * 60 * 60 * 6
const STATION_ADDRESS_CACHE_TTL = 1000 * 60 * 60 * 24 * 7
const LIVE_STATION_CACHE_TTL = 1000 * 45
/* Ячеек хранится больше: одна ячейка сетки — это участок в четыре
   километра, и восьмидесяти хватало на пару крупных городов. Человек с
   трассы, проехавший триста километров, вытеснял из памяти Москву. */
const MAX_DIRECTORY_CACHE_ENTRIES = 400
const MAX_STATION_ADDRESS_CACHE_ENTRIES = 600
const MAX_LIVE_STATION_CACHE_ENTRIES = 80
const LIVE_STATION_PAGE_LIMIT = 200
const MAX_LIVE_STATION_PAGES = 5
const configuredLiveProviderDailyBudget = Number(process.env.FUEL_PROVIDER_DAILY_REQUEST_BUDGET || 8_000)
const LIVE_PROVIDER_DAILY_BUDGET = Number.isFinite(configuredLiveProviderDailyBudget)
  ? Math.max(1, Math.min(10_000, configuredLiveProviderDailyBudget))
  : 8_000
const placeCache = new Map<string, CachedPlace>()
const directoryStationCache = new Map<string, CachedDirectoryStations>()
const stationAddressCache = new Map<string, CachedStationAddress>()
const liveStationCache = new Map<string, CachedLiveStations>()
let nextNominatimRequestAt = 0
let nominatimRequestQueue = Promise.resolve()
let liveProviderHealth: LiveProviderHealth = { state: "NOT_CONFIGURED", limit: null, remaining: null, retryAt: null, stale: false }
let liveProviderCooldownUntil = 0
let liveProviderRequestDay = new Date().toISOString().slice(0, 10)
let liveProviderRequestsToday = 0

function refreshLiveProviderDailyBudget() {
  const today = new Date().toISOString().slice(0, 10)
  if (today !== liveProviderRequestDay) {
    liveProviderRequestDay = today
    liveProviderRequestsToday = 0
  }
}

function asRateLimitNumber(value: string | null) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function updateLiveProviderRateLimits(response: Response) {
  const limit = asRateLimitNumber(response.headers.get("x-ratelimit-limit"))
  const remaining = asRateLimitNumber(response.headers.get("x-ratelimit-remaining"))
  const resetSeconds = asRateLimitNumber(response.headers.get("x-ratelimit-reset"))
  const retrySeconds = asRateLimitNumber(response.headers.get("retry-after"))
  const retryAt = retrySeconds !== null
    ? Date.now() + retrySeconds * 1_000
    : resetSeconds !== null
      ? resetSeconds * 1_000
      : 0

  if (response.status === 429 || remaining === 0) liveProviderCooldownUntil = Math.max(liveProviderCooldownUntil, retryAt || Date.now() + 60_000)
  liveProviderHealth = {
    state: liveProviderCooldownUntil > Date.now() ? "COOLDOWN" : "READY",
    limit,
    remaining,
    retryAt: liveProviderCooldownUntil > Date.now() ? new Date(liveProviderCooldownUntil).toISOString() : null,
    stale: false,
  }
}

function hasPublishedFuelTag(value: string | undefined) {
  return /^(yes|true|1)$/iu.test(value?.trim() || "")
}

function getCoordinates(element: OverpassElement): Coordinates | null {
  if (typeof element.lat === "number" && typeof element.lon === "number") return { latitude: element.lat, longitude: element.lon }
  if (element.center) return { latitude: element.center.lat, longitude: element.center.lon }
  return null
}

function getStationName(tags: Record<string, string>) {
  const publishedName = tags.name?.trim()
  const brandOrOperator = tags.brand?.trim() || tags.operator?.trim()
  const hasGenericName = !publishedName || /^(азс|агзс|fuel|charging station)$/iu.test(publishedName)

  if (brandOrOperator && hasGenericName) return brandOrOperator
  /* Безымянная зарядка — не «АЗС»: человек на электромобиле ищет
     розетку, а не бензин, и подпись должна говорить именно об этом. */
  if (hasGenericName && tags.amenity === "charging_station") return "Зарядная станция"
  return publishedName || brandOrOperator || "АЗС"
}

function stationPriority(station: FuelStationPayload) {
  const namedOrBranded = station.name !== "АЗС" ? 10 : 0
  const publishedLiveStatus = station.status === "FUEL" ? 8 : station.status === "NO_FUEL" ? 4 : 0
  const taggedFuels = Math.min(station.fuels.length, 5)
  const hasAddress = station.address ? 1 : 0
  return namedOrBranded + publishedLiveStatus + taggedFuels + hasAddress
}

/**
 * Ключ кэша — ячейка сетки, а не точка.
 *
 * Ключ округлялся до трёх знаков, то есть примерно до ста метров. При
 * этом сама выборка берётся радиусом в тридцать-сорок километров:
 * сдвинув карту на двести метров, человек получал промах мимо кэша и
 * ждал четыре секунды, пока Overpass отдаст ровно те же точки, которые
 * уже лежали в памяти.
 *
 * Сетка в четыре километра — примерно восьмая часть радиуса. Соседняя
 * ячейка отличается от текущей меньше чем на восьмую часть выборки, и
 * заправки на краю не теряются, потому что радиус берётся с запасом от
 * центра ячейки. Зато любое движение внутри города попадает в кэш.
 */
const CACHE_GRID_DEGREES = 0.04

function getGridCell(coordinates: Coordinates) {
  const latitude = Math.round(coordinates.latitude / CACHE_GRID_DEGREES) * CACHE_GRID_DEGREES
  /* По долготе шаг сетки растягивается к северу: на широте Москвы
     градус долготы вдвое короче градуса широты, и одинаковый шаг дал бы
     ячейки вдвое уже нужного. */
  const longitudeStep = CACHE_GRID_DEGREES / Math.max(0.25, Math.cos(coordinates.latitude * Math.PI / 180))
  const longitude = Math.round(coordinates.longitude / longitudeStep) * longitudeStep
  return `${latitude.toFixed(3)}:${longitude.toFixed(3)}`
}

function getDirectoryCacheKey(coordinates: Coordinates, radius: number) {
  return `${getGridCell(coordinates)}:${radius}`
}

function getLiveStationsCacheKey(coordinates: Coordinates, radius: number) {
  return `${getGridCell(coordinates)}:${radius}`
}

function cacheDirectoryStations(key: string, stations: FuelStationPayload[]) {
  if (directoryStationCache.size >= MAX_DIRECTORY_CACHE_ENTRIES) {
    const oldestKey = directoryStationCache.keys().next().value
    if (oldestKey) directoryStationCache.delete(oldestKey)
  }

  directoryStationCache.set(key, { stations, expiresAt: Date.now() + DIRECTORY_STATION_CACHE_TTL })
}

function cacheStationAddress(key: string, address: string | null) {
  if (stationAddressCache.size >= MAX_STATION_ADDRESS_CACHE_ENTRIES) {
    const oldestKey = stationAddressCache.keys().next().value
    if (oldestKey) stationAddressCache.delete(oldestKey)
  }

  stationAddressCache.set(key, { address, expiresAt: Date.now() + STATION_ADDRESS_CACHE_TTL })
}

function cacheLiveStations(key: string, stations: FuelStationPayload[]) {
  if (liveStationCache.size >= MAX_LIVE_STATION_CACHE_ENTRIES) {
    const oldestKey = liveStationCache.keys().next().value
    if (oldestKey) liveStationCache.delete(oldestKey)
  }

  liveStationCache.set(key, { stations, expiresAt: Date.now() + LIVE_STATION_CACHE_TTL })
}

function isRussianMapCoordinate(latitude: number, longitude: number) {
  return Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= 41 && latitude <= 82 && longitude >= 19 && longitude <= 190
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function asNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value.replace(",", ".")) : Number.NaN
  return Number.isFinite(parsed) ? parsed : null
}

function waitForNominatimPolicy() {
  const scheduledRequest = nominatimRequestQueue.then(async () => {
    const delay = Math.max(0, nextNominatimRequestAt - Date.now())
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay))
    nextNominatimRequestAt = Date.now() + 1_000
  })

  nominatimRequestQueue = scheduledRequest.catch(() => undefined)
  return scheduledRequest
}

function normalizeFuel(value: unknown) {
  const source = asString(value)
  if (!source) return null
  // Data providers use several Unicode dash characters in values such as "АИ‑92".
  // Canonicalize them before the lookup so filters and station cards stay in sync.
  const key = source
    .toLocaleUpperCase("ru-RU")
    .replace(/[‐‑‒–—−]/g, "-")
    .replace(/\s+/g, "")
  return LIVE_FUEL_LABELS[key] || source
}

function uniqueFuels(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))))
}

function normalizeLiveStatus(value: unknown): FuelStationPayload["status"] {
  const status = asString(value)?.toLocaleUpperCase("en-US") || ""
  if (/^(FUEL|AVAILABLE|OPEN|IN_STOCK)$/u.test(status)) return "FUEL"
  if (/(NO_FUEL|OUT_OF_STOCK|EMPTY|CLOSED|UNAVAILABLE)/u.test(status)) return "NO_FUEL"
  return "UNKNOWN"
}

function getLiveCoordinates(record: Record<string, unknown>): Coordinates | null {
  const location = asRecord(record.location) || asRecord(record.coordinates) || asRecord(record.position)
  const latitude = asNumber(record.latitude ?? record.lat ?? location?.latitude ?? location?.lat)
  const longitude = asNumber(record.longitude ?? record.lng ?? record.lon ?? location?.longitude ?? location?.lng ?? location?.lon)
  return latitude !== null && longitude !== null && isRussianMapCoordinate(latitude, longitude) ? { latitude, longitude } : null
}

function normalizeLivePrices(record: Record<string, unknown>) {
  const rawPrices = record.prices ?? record.fuelPrices ?? record.priceList
  const updatedAt = asString(record.statusUpdatedAt ?? record.updatedAt ?? record.observedAt)

  if (Array.isArray(rawPrices)) {
    return rawPrices.flatMap((value) => {
      const price = asRecord(value)
      if (!price) return []
      const fuel = normalizeFuel(price.fuel ?? price.type ?? price.code ?? price.name)
      if (!fuel) return []
      return [{ fuel, price: asNumber(price.price ?? price.value ?? price.amount), updatedAt: asString(price.updatedAt ?? price.observedAt) || updatedAt }]
    })
  }

  const priceMap = asRecord(rawPrices)
  if (!priceMap) return []
  return Object.entries(priceMap).flatMap(([fuelCode, value]) => {
    const fuel = normalizeFuel(fuelCode)
    if (!fuel) return []
    const priceDetails = asRecord(value)
    return [{ fuel, price: asNumber(priceDetails?.price ?? priceDetails?.value ?? value), updatedAt: asString(priceDetails?.updatedAt ?? priceDetails?.observedAt) || updatedAt }]
  })
}

function normalizeLiveStation(value: unknown): FuelStationPayload | null {
  const record = asRecord(value)
  if (!record) return null
  const coordinates = getLiveCoordinates(record)
  if (!coordinates) return null

  const prices = normalizeLivePrices(record)
  const rawFuelTypes = Array.isArray(record.fuelTypes) ? record.fuelTypes : Array.isArray(record.fuels) ? record.fuels : []
  const fuels = uniqueFuels([
    ...rawFuelTypes.map((fuel) => normalizeFuel(asRecord(fuel)?.fuel ?? asRecord(fuel)?.type ?? fuel)),
    ...prices.map((price) => price.fuel),
  ])
  const brand = asString(record.brand ?? record.network)
  const operator = asString(record.operator ?? record.company)
  const name = asString(record.name ?? record.title) || brand || operator || "АЗС"
  const addressRecord = asRecord(record.address)
  const address = asString(record.address) || asString(addressRecord?.full ?? addressRecord?.text ?? addressRecord?.street)
  const providerId = asString(record.id ?? record.stationId ?? record.uuid) || `${coordinates.latitude.toFixed(5)}-${coordinates.longitude.toFixed(5)}`

  return {
    id: `provider-${providerId}`,
    sourceType: "provider",
    dataSource: "ZAPRAVKIN",
    name,
    brand,
    operator,
    address,
    openingHours: asString(record.openingHours ?? record.schedule),
    fuels,
    prices,
    status: normalizeLiveStatus(record.status ?? record.availability),
    statusUpdatedAt: asString(record.statusUpdatedAt ?? record.updatedAt ?? record.observedAt),
    ...coordinates,
  }
}

/** Расстояние между точками в километрах: нужно, чтобы понять, город
    вокруг или трасса, и выбрать радиус выборки. */
function getDistanceInKilometers(from: Coordinates, to: Coordinates) {
  const radians = (value: number) => value * Math.PI / 180
  const latitudeDelta = radians(to.latitude - from.latitude)
  const longitudeDelta = radians(to.longitude - from.longitude)
  const value = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(longitudeDelta / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value))
}

function getDistanceSquared(first: FuelStationPayload, second: FuelStationPayload) {
  const latitude = first.latitude - second.latitude
  const longitude = (first.longitude - second.longitude) * Math.cos(((first.latitude + second.latitude) / 2) * Math.PI / 180)
  return latitude ** 2 + longitude ** 2
}

const STATION_MATCH_DISTANCE_SQUARED = (35 / 111_000) ** 2

function getStationIdentity(station: FuelStationPayload) {
  const source = station.brand || station.operator || (station.name !== "АЗС" ? station.name : null)
  return source
    ?.toLocaleLowerCase("ru-RU")
    .replace(/[«»'"`]/g, "")
    .replace(/\b(азс|агзс|fuel|station)\b/giu, "")
    .replace(/[^\p{L}\p{N}]+/gu, "") || null
}

function canMergeStations(liveStation: FuelStationPayload, directoryStation: FuelStationPayload) {
  if (getDistanceSquared(liveStation, directoryStation) > STATION_MATCH_DISTANCE_SQUARED) return false

  const liveIdentity = getStationIdentity(liveStation)
  const directoryIdentity = getStationIdentity(directoryStation)
  if (!liveIdentity || !directoryIdentity) return true

  return liveIdentity === directoryIdentity
    || liveIdentity.includes(directoryIdentity)
    || directoryIdentity.includes(liveIdentity)
}

/* Приоритет источников при склейке одной заправки.

   Числа значат «чьё название и адрес выигрывают», а не «чьи данные
   лучше»: цены и наличие собираются со всех источников, а вот показать
   заправку надо под одним именем. ГдеБЕНЗ идёт первым, потому что у него
   живые отметки водителей с голосами; ГдеЗаправка часто зовёт точку
   адресом («Вишнёвая улица, 1/3») вместо названия сети. */
const PROVIDER_PRIORITY: Record<string, number> = {
  GDEBENZ: 3,
  TWOGIS: 2,
  GDEZAPRAVKA: 1,
}

function providerRank(station: FuelStationPayload) {
  return PROVIDER_PRIORITY[station.dataSource] ?? 0
}

/**
 * Схлопывает одну и ту же заправку, приехавшую из разных источников.
 *
 * Источники не перезаписывают друг друга в базе — они лежат отдельными
 * записями, и это правильно: у каждого своя частота обновления и свои
 * пробелы. Но на карту они выходили двумя метками: из четырёхсот трёх
 * точек Уфы сто шестьдесят пять оказались дублями. Человек видел два
 * «Irbis» в одном дворе, где у одного есть АИ-95, а у другого нет, и не
 * понимал, какому верить.
 *
 * Склейка объединяет знание, а не выбирает победителя: марка, которую
 * знает хоть один источник, остаётся; цена берётся у того, кто её видит,
 * а при споре — у более свежей отметки.
 */
function mergeProviderStations(stations: FuelStationPayload[]): FuelStationPayload[] {
  const merged: FuelStationPayload[] = []

  for (const station of [...stations].sort((left, right) => providerRank(right) - providerRank(left))) {
    const twinIndex = merged.findIndex((candidate) => canMergeStations(candidate, station))
    if (twinIndex < 0) {
      merged.push(station)
      continue
    }

    const twin = merged[twinIndex]
    /* Цены объединяются по марке. При споре побеждает более свежая: цена
       вчерашнего дня вернее позавчерашней независимо от источника. */
    const priceByFuel = new Map(twin.prices.map((price) => [price.fuel, price]))
    for (const price of station.prices) {
      const known = priceByFuel.get(price.fuel)
      if (!known) {
        priceByFuel.set(price.fuel, price)
        continue
      }
      const knownAt = known.updatedAt ? Date.parse(known.updatedAt) : 0
      const freshAt = price.updatedAt ? Date.parse(price.updatedAt) : 0
      if (freshAt > knownAt) priceByFuel.set(price.fuel, price)
    }

    merged[twinIndex] = {
      ...twin,
      /* Имя и адрес — у источника с большим приоритетом, но пустое место
         заполняет любой: «АЗС» без адреса хуже чужого адреса. */
      name: twin.name !== "АЗС" ? twin.name : station.name,
      brand: twin.brand || station.brand,
      operator: twin.operator || station.operator,
      address: twin.address || station.address,
      openingHours: twin.openingHours || station.openingHours,
      fuels: uniqueFuels([...twin.fuels, ...station.fuels]),
      /* Наличие: берём то, что знает хоть кто-то. Пустой список у одного
         источника не должен стирать сведения другого. */
      fuelsNow: twin.fuelsNow?.length ? twin.fuelsNow : station.fuelsNow,
      prices: [...priceByFuel.values()],
      /* Статус «есть топливо» важнее «неизвестно»: молчание одного
         источника не отменяет наблюдения другого. */
      status: twin.status !== "UNKNOWN" ? twin.status : station.status,
      statusUpdatedAt: twin.statusUpdatedAt || station.statusUpdatedAt,
    }
  }

  return merged
}

function mergeStations(liveStations: FuelStationPayload[], directoryStations: FuelStationPayload[]) {
  const unmatchedDirectoryStations = [...directoryStations]
  const mergedLiveStations = liveStations.map((liveStation) => {
    // В городе несколько АЗС могут стоять рядом. Нельзя присваивать live-цены
    // и наличие первой попавшейся OSM-точке только по близости координат.
    const directoryIndex = unmatchedDirectoryStations.findIndex((directoryStation) => canMergeStations(liveStation, directoryStation))
    if (directoryIndex < 0) return liveStation

    const directoryStation = unmatchedDirectoryStations.splice(directoryIndex, 1)[0]
    return {
      ...directoryStation,
      dataSource: "MERGED" as const,
      name: liveStation.name !== "АЗС" ? liveStation.name : directoryStation.name,
      brand: liveStation.brand || directoryStation.brand,
      operator: liveStation.operator || directoryStation.operator,
      address: liveStation.address || directoryStation.address,
      openingHours: liveStation.openingHours || directoryStation.openingHours,
      fuels: uniqueFuels([...liveStation.fuels, ...directoryStation.fuels]),
      /* Наличие берётся у провайдерской точки: OSM знает, какие колонки
         на станции стоят вообще, но не знает, что залито сегодня. */
      fuelsNow: liveStation.fuelsNow,
      prices: liveStation.prices,
      status: liveStation.status,
      statusUpdatedAt: liveStation.statusUpdatedAt,
    }
  })

  return [...mergedLiveStations, ...unmatchedDirectoryStations]
    .sort((first, second) => stationPriority(second) - stationPriority(first) || first.name.localeCompare(second.name, "ru"))
}

async function requestStations(query: string) {
  const endpoints = Array.from(new Set([
    process.env.OVERPASS_API_URL,
    ...OVERPASS_ENDPOINTS,
  ].filter((endpoint): endpoint is string => Boolean(endpoint))))
  let lastError: unknown

  for (const endpoint of endpoints) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 12_000)

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
          "user-agent": "AutoMarket fuel-map/1.0 (OSM attribution in product)",
        },
        body: new URLSearchParams({ data: query }).toString(),
        signal: controller.signal,
      })

      if (!response.ok) throw new Error(`Overpass responded with ${response.status}`)
      return await response.json() as { elements?: OverpassElement[] }
    } catch (error) {
      lastError = error
      console.warn("Fuel stations source is temporarily unavailable", error instanceof Error ? error.message : "Unknown error")
    } finally {
      clearTimeout(timeout)
    }
  }

  throw lastError || new Error("No fuel station sources are available")
}

async function resolveRussianPlace(value: string) {
  const place = value.trim().replace(/\s+/g, " ")
  const cacheKey = place.toLocaleLowerCase("ru-RU")
  const cached = placeCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached

  await waitForNominatimPolicy()

  const search = new URLSearchParams({
    q: `${place}, Россия`,
    format: "jsonv2",
    limit: "1",
    countrycodes: "ru",
    "accept-language": "ru",
  })
  const contact = process.env.FUEL_MAP_CONTACT_EMAIL?.trim()
  const response = await fetch(`${NOMINATIM_ENDPOINT}?${search.toString()}`, {
    headers: { "user-agent": contact ? `AutoMarket fuel-map/1.0 (${contact})` : "AutoMarket fuel-map/1.0" },
    next: { revalidate: 0 },
  })
  if (!response.ok) throw new Error(`Nominatim responded with ${response.status}`)

  const result = (await response.json() as NominatimResult[])[0]
  const latitude = Number(result?.lat)
  const longitude = Number(result?.lon)
  if (!isRussianMapCoordinate(latitude, longitude)) return null

  const resolved = {
    coordinates: { latitude, longitude },
    label: result.display_name?.split(",").slice(0, 2).join(", ") || place,
    expiresAt: Date.now() + PLACE_CACHE_TTL,
  }
  placeCache.set(cacheKey, resolved)
  return resolved
}

async function resolveStationAddress(coordinates: Coordinates) {
  const cacheKey = `${coordinates.latitude.toFixed(5)}:${coordinates.longitude.toFixed(5)}`
  const cached = stationAddressCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.address

  await waitForNominatimPolicy()
  const search = new URLSearchParams({
    lat: coordinates.latitude.toFixed(6),
    lon: coordinates.longitude.toFixed(6),
    format: "jsonv2",
    zoom: "18",
    addressdetails: "1",
    "accept-language": "ru",
  })
  const contact = process.env.FUEL_MAP_CONTACT_EMAIL?.trim()
  const response = await fetch(`${NOMINATIM_ENDPOINT.replace(/\/search$/, "/reverse")}?${search.toString()}`, {
    headers: { "user-agent": contact ? `AutoMarket fuel-map/1.0 (${contact})` : "AutoMarket fuel-map/1.0" },
    next: { revalidate: 0 },
  })
  if (!response.ok) throw new Error(`Nominatim reverse geocoding responded with ${response.status}`)

  const result = await response.json() as NominatimResult
  const address = result.display_name?.split(",").slice(0, 4).map((part) => part.trim()).filter(Boolean).join(", ") || null
  cacheStationAddress(cacheKey, address)
  return address
}

async function requestLiveStations(coordinates: Coordinates, radius: number, forceRefresh = false) {
  const apiKey = process.env.ZAPRAVKIN_API_KEY?.trim()
  if (!apiKey) {
    liveProviderHealth = { state: "NOT_CONFIGURED", limit: null, remaining: null, retryAt: null, stale: false }
    return []
  }

  const cacheKey = getLiveStationsCacheKey(coordinates, radius)
  const cached = liveStationCache.get(cacheKey)
  if (!forceRefresh && cached && cached.expiresAt > Date.now()) return cached.stations

  refreshLiveProviderDailyBudget()
  if (liveProviderCooldownUntil > Date.now()) {
    liveProviderHealth = { ...liveProviderHealth, state: "COOLDOWN", retryAt: new Date(liveProviderCooldownUntil).toISOString(), stale: Boolean(cached?.stations.length) }
    return cached?.stations || []
  }
  if (liveProviderRequestsToday >= LIVE_PROVIDER_DAILY_BUDGET) {
    liveProviderHealth = { ...liveProviderHealth, state: "BUDGET_EXHAUSTED", retryAt: null, stale: Boolean(cached?.stations.length) }
    return cached?.stations || []
  }

  const latitudeDelta = radius / 111_000
  const longitudeDelta = radius / Math.max(25_000, 111_000 * Math.cos(coordinates.latitude * Math.PI / 180))
  const bbox = [
    coordinates.longitude - longitudeDelta,
    coordinates.latitude - latitudeDelta,
    coordinates.longitude + longitudeDelta,
    coordinates.latitude + latitudeDelta,
  ].map((value) => value.toFixed(5)).join(",")
  const stations: FuelStationPayload[] = []
  let cursor: string | null = null

  try {
    for (let page = 0; page < MAX_LIVE_STATION_PAGES; page += 1) {
      const query = new URLSearchParams({ bbox, limit: String(LIVE_STATION_PAGE_LIMIT) })
      if (cursor) query.set("cursor", cursor)

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 8_000)
      let payload: unknown

      try {
        const response = await fetch(`${ZAPRAVKIN_BASE_URL}/stations?${query.toString()}`, {
          headers: { authorization: `Bearer ${apiKey}`, accept: "application/json" },
          signal: controller.signal,
          next: { revalidate: 0 },
        })
        liveProviderRequestsToday += 1
        updateLiveProviderRateLimits(response)
        if (!response.ok) throw new Error(`Live fuel provider responded with ${response.status}`)
        payload = await response.json() as unknown
      } finally {
        clearTimeout(timeout)
      }

      const payloadRecord = asRecord(payload)
      const pageStations = Array.isArray(payload)
        ? payload
        : Array.isArray(payloadRecord?.data)
          ? payloadRecord.data
          : Array.isArray(payloadRecord?.stations)
            ? payloadRecord.stations
            : []
      stations.push(...pageStations.map(normalizeLiveStation).filter((station): station is FuelStationPayload => Boolean(station)))

      const metadata = asRecord(payloadRecord?.meta)
      const nextCursor = asString(metadata?.cursor)
      if (!nextCursor || !pageStations.length) break
      cursor = nextCursor
    }
  } catch (error) {
    console.warn("Live fuel provider is temporarily unavailable", error instanceof Error ? error.message : "Unknown error")
    if (liveProviderHealth.state !== "COOLDOWN") {
      liveProviderHealth = { ...liveProviderHealth, state: "UNAVAILABLE", stale: Boolean(cached?.stations.length) }
    }
    return cached?.stations || []
  }

  const uniqueStations = Array.from(new Map(stations.map((station) => [station.id, station])).values())
  cacheLiveStations(cacheKey, uniqueStations)
  liveProviderHealth = { ...liveProviderHealth, state: "READY", retryAt: null, stale: false }
  return uniqueStations
}

/* Подписи марок для импортированных цен: те же строки, что у OSM и
   провайдера, чтобы фильтры карты находили импортированные цены по тем
   же ярлыкам, что и остальные. */
const IMPORTED_STATION_FUEL_LABELS: Record<string, string> = {
  AI92: "АИ‑92",
  AI95: "АИ‑95",
  AI98: "АИ‑98",
  AI100: "АИ‑100",
  DT: "ДТ",
  GAS: "Газ",
}

/* Строка fuelsNow хранит коды в виде «92,95,ДТ» — те же, что отдаёт
   ГдеБЕНЗ. Для карты они превращаются в те же ярлыки, что и у OSM. */
const IMPORTED_FUEL_NOW_LABELS: Record<string, string> = {
  "92": "АИ‑92",
  "95": "АИ‑95",
  "98": "АИ‑98",
  "100": "АИ‑100",
  "ДТ": "ДТ",
  "Газ": "Газ",
  "ГАЗ": "Газ",
}

/**
 * Импортированные точки из собственной базы (сборщики ГдеБЕНЗ, ГдеЗаправка
 * и другие).
 *
 * Они не подменяют справочник OpenStreetMap, а ложатся поверх него как
 * провайдерские: при совпадении по близости и имени сливаются с OSM-точкой,
 * а новые точки — например, ещё не нанесённые в OSM — появляются сами.
 */
async function requestImportedStations(coordinates: Coordinates, radius: number): Promise<FuelStationPayload[]> {
  const latitudeDelta = radius / 111_000
  const longitudeDelta = radius / Math.max(25_000, 111_000 * Math.cos(coordinates.latitude * Math.PI / 180))

  const rows = await prisma.fuelStationImport.findMany({
    where: {
      latitude: { gte: coordinates.latitude - latitudeDelta, lte: coordinates.latitude + latitudeDelta },
      longitude: { gte: coordinates.longitude - longitudeDelta, lte: coordinates.longitude + longitudeDelta },
    },
    include: { prices: true },
    take: 600,
  })

  return rows.map((row) => {
    const prices = row.prices.flatMap((price) => {
      const label = IMPORTED_STATION_FUEL_LABELS[price.fuel]
      if (!label) return []
      return [{ fuel: label, price: price.priceRub / 100, updatedAt: price.observedAt?.toISOString() ?? null }]
    })
    const fuelsFromNow = (row.fuelsNow ?? "")
      .split(",")
      .map((code) => IMPORTED_FUEL_NOW_LABELS[code.trim()])
      .filter((label): label is string => Boolean(label))
    const status: FuelStationPayload["status"] = row.status === "yes" || row.status === "low"
      ? "FUEL"
      : row.status === "no"
        ? "NO_FUEL"
        : "UNKNOWN"
    const source = ["GDEBENZ", "TWOGIS", "GDEZAPRAVKA"].includes(row.source) ? row.source : "GDEBENZ"

    return {
      id: `${source.toLocaleLowerCase("en-US")}-${row.sourceId}`,
      sourceType: "provider",
      dataSource: source as FuelStationPayload["dataSource"],
      name: row.name || row.brand || "АЗС",
      brand: row.brand,
      operator: null,
      address: row.address,
      openingHours: null,
      fuels: uniqueFuels([...prices.map((price) => price.fuel), ...fuelsFromNow]),
      fuelsNow: fuelsFromNow,
      prices,
      status,
      statusUpdatedAt: row.updatedAt.toISOString(),
      latitude: row.latitude,
      longitude: row.longitude,
    }
  })
}

function normalizeDirectoryStations(elements: OverpassElement[]) {
  return elements.flatMap((element) => {
    const coordinates = getCoordinates(element)
    if (!coordinates) return []
    const tags = element.tags || {}
    const fuels = Object.entries(FUEL_TAG_LABELS)
      .filter(([tag]) => hasPublishedFuelTag(tags[tag]))
      .map(([, label]) => label)

    /* Зарядная станция опознаётся по типу объекта.

       У неё нет тегов fuel:*, и ассортимент выходил пустым: точка
       приезжала безымянной серой меткой, а фильтр «Зарядка EV» её не
       находил. Человек на электромобиле видел пустую карту там, где
       зарядки есть. */
    if (tags.amenity === "charging_station" && !fuels.includes("Зарядка EV")) {
      fuels.push("Зарядка EV")
    }

    return [{
      id: `osm-${element.type}-${element.id}`,
      sourceType: element.type,
      dataSource: "OPENSTREETMAP" as const,
      name: getStationName(tags),
      brand: tags.brand || null,
      operator: tags.operator || null,
      address: [tags["addr:street"], tags["addr:housenumber"]].filter(Boolean).join(", ") || null,
      openingHours: tags.opening_hours || null,
      /* Удобства при заправке — из OpenStreetMap, открытая лицензия.
         
         «Оплата картой» — тот же вопрос, что человек ищет на чужих
         сервисах, только здесь он берётся из открытых данных, а не из
         чужой базы. Ночью в дороге важно и остальное: работает ли
         туалет, есть ли кофе, можно ли позвонить и спросить. */
      amenities: {
        cardPayment: tags["payment:cards"] === "yes" || tags["payment:credit_cards"] === "yes",
        phone: tags["contact:phone"] || tags.phone || null,
        toilets: tags.toilets === "yes",
        shop: tags.shop === "yes" || Boolean(tags.shop && tags.shop !== "no"),
        cafe: tags.cafe === "yes" || tags.amenity === "cafe",
      },
      fuels,
      prices: [],
      status: "UNKNOWN" as const,
      statusUpdatedAt: null,
      ...coordinates,
    }]
  })
}

/**
 * Справочные точки берутся из OSM. Если в окружении задан ключ партнёрского
 * провайдера, поверх них добавляются проверенные статусы, цены и ассортимент.
 * Мы сознательно не подменяем справочные OSM-теги "онлайн"-данными.
 */
export async function GET(request: NextRequest) {
  const detail = request.nextUrl.searchParams.get("detail")
  const refreshTimestamp = Number(request.nextUrl.searchParams.get("refresh"))
  const forceRefresh = Number.isFinite(refreshTimestamp) && Math.abs(Date.now() - refreshTimestamp) < 15_000
  const city = request.nextUrl.searchParams.get("city") || "Москва"
  const place = request.nextUrl.searchParams.get("place")?.trim() || null
  const latitudeParam = request.nextUrl.searchParams.get("latitude")
  const longitudeParam = request.nextUrl.searchParams.get("longitude")
  const hasCustomCoordinates = latitudeParam !== null || longitudeParam !== null
  const requestedCoordinates = hasCustomCoordinates ? { latitude: Number(latitudeParam), longitude: Number(longitudeParam) } : null

  if (detail === "address") {
    if (!requestedCoordinates || !isRussianMapCoordinate(requestedCoordinates.latitude, requestedCoordinates.longitude)) {
      return NextResponse.json({ error: "Выберите точку АЗС на территории России" }, { status: 400 })
    }

    try {
      const address = await resolveStationAddress(requestedCoordinates)
      return NextResponse.json({ address, source: "OPENSTREETMAP" }, {
        headers: { "Cache-Control": "public, max-age=3600, s-maxage=604800, stale-while-revalidate=86400" },
      })
    } catch (error) {
      console.warn("Fuel station reverse geocoding failed", error instanceof Error ? error.message : "Unknown error")
      return NextResponse.json({ error: "Адрес точки временно недоступен. Попробуйте позже." }, { status: 503 })
    }
  }

  if (place && (place.length < 2 || place.length > 120)) {
    return NextResponse.json({ error: "Укажите населённый пункт или трассу от 2 до 120 символов" }, { status: 400 })
  }
  if (requestedCoordinates && !isRussianMapCoordinate(requestedCoordinates.latitude, requestedCoordinates.longitude)) {
    return NextResponse.json({ error: "Выберите участок на территории России" }, { status: 400 })
  }

  let coordinates: Coordinates | undefined = requestedCoordinates || CITY_COORDINATES[city]
  // После ручного перемещения карты сохраняем понятный контекст последнего
  // поиска, а не возвращаем в заголовке дефолтную "Москву".
  let areaLabel = place || city

  if (!requestedCoordinates && place) {
    try {
      const resolvedPlace = await resolveRussianPlace(place)
      if (!resolvedPlace) return NextResponse.json({ error: "Не удалось найти это место в России. Уточните населённый пункт или название трассы." }, { status: 404 })
      coordinates = resolvedPlace.coordinates
      areaLabel = resolvedPlace.label
    } catch (error) {
      console.warn("Fuel map geocoding failed", error instanceof Error ? error.message : "Unknown error")
      return NextResponse.json({ error: "Поиск места временно недоступен. Выберите город из списка или повторите позже." }, { status: 503 })
    }
  }

  if (!coordinates) {
    return NextResponse.json({ error: "Выберите город из списка или введите населённый пункт либо трассу" }, { status: 400 })
  }

  /* Радиус охвата.

     Было 22–30 км, и этого не хватало: в большом городе заправки на
     окраинах не попадали в выборку вовсе, а при переходе к соседнему
     посёлку карта оставалась пустой, пока человек не сдвинет её вплотную.

     Сорок километров закрывают город с пригородами и участок трассы
     между посёлками. Больше брать нельзя: запрос к OpenStreetMap растёт
     квадратично площади и начинает отваливаться по времени.

     Замерено на живых данных: в радиусе 40 км от центра Москвы 1235
     заправок, ответ приходит за четыре секунды. Предел в 1500 берёт их
     все с запасом — прежние 600 обрезали Москву ровно вдвое, и окраины
     на карту не попадали вовсе. */
  /* Вне городов радиус больше — но решает местность, а не запрос.

     Сорок километров рассчитаны на город: там в этом круге больше
     тысячи заправок, и Overpass отвечает четыре секунды. На трассе и
     вокруг райцентра в том же круге их полтора десятка — человек видит
     пустую карту и решает, что заправок нет вовсе. Между Уфой и
     Оренбургом их полсотни, но стоят они через тридцать-сорок
     километров, и в круг попадала одна-две.

     Радиус выбирается по расстоянию до ближайшего известного города, а
     не по тому, пришли ли координаты с карты. Иначе сдвиг карты внутри
     Москвы на двести метров переключал радиус с тридцати двух
     километров на восемьдесят: запрос тяжелел вчетверо, шёл десять
     секунд и промахивался мимо кэша, потому что радиус входит в ключ.

     Порог в пятьдесят километров: дальше него городская плотность
     заканчивается даже у миллионников. */
  const nearestCityDistance = Object.values(CITY_COORDINATES).reduce((closest, cityPoint) => {
    const km = getDistanceInKilometers(coordinates, cityPoint)
    return km < closest ? km : closest
  }, Number.POSITIVE_INFINITY)
  const radius = nearestCityDistance <= 50 ? 32_000 : 80_000
  // Крупные заправочные комплексы нанесены отношениями, а не точками, поэтому
  // без `relation` часть сетевых АЗС просто отсутствует на карте. Лимит выдачи
  // поднят: в плотной городской застройке 180 точек обрывались задолго до
  // границы запрошенного радиуса.
  /* Зарядные станции — отдельный тег.

     Фильтр «Зарядка EV» на карте был, а показывать ему было нечего:
     запрос тянул только amenity=fuel, и электрозаправка попадала в
     ответ лишь тогда, когда стояла при обычной АЗС и была помечена
     тегом fuel:electricity. Отдельно стоящие зарядки — а их
     большинство — не приезжали вовсе, и человек на электромобиле видел
     пустую карту. */
  const buildQuery = (metres: number) => {
    const near = `around:${metres},${coordinates.latitude},${coordinates.longitude}`
    return `[out:json][timeout:24];(`
      + `node["amenity"="fuel"](${near});`
      + `way["amenity"="fuel"](${near});`
      + `relation["amenity"="fuel"](${near});`
      + `node["amenity"="charging_station"](${near});`
      + `way["amenity"="charging_station"](${near});`
      + `);out center tags 2500;`
  }
  const query = buildQuery(radius)
  const directoryCacheKey = getDirectoryCacheKey(coordinates, radius)
  const cachedDirectory = directoryStationCache.get(directoryCacheKey)
  const directoryPromise = !forceRefresh && cachedDirectory && cachedDirectory.expiresAt > Date.now()
    ? Promise.resolve(cachedDirectory.stations)
    : requestStations(query)
        /* Широкий радиус выгоден в поле и опасен в городе: сдвинув
           карту к Москве, человек просит восемьдесят километров, где
           заправок тысячи, и Overpass отваливается по времени. Тогда
           повторяем запрос вдвое уже — лучше половина участка, чем
           пустая карта и сообщение об ошибке. */
        .catch((error) => {
          if (radius <= 40_000) throw error
          console.warn("Wide fuel-station query failed, retrying with a smaller radius", error instanceof Error ? error.message : "Unknown error")
          return requestStations(buildQuery(Math.round(radius / 2)))
        })
        .then((result) => {
          const stations = normalizeDirectoryStations(result.elements || [])
          cacheDirectoryStations(directoryCacheKey, stations)
          return stations
        })
  const [directoryResult, liveResult, importedResult] = await Promise.allSettled([
    directoryPromise,
    requestLiveStations(coordinates, radius, forceRefresh),
    requestImportedStations(coordinates, radius),
  ])
  const directoryStations = directoryResult.status === "fulfilled" ? directoryResult.value : []
  const liveStations = liveResult.status === "fulfilled" ? liveResult.value : []
  const importedStations = importedResult.status === "fulfilled" ? importedResult.value : []
  const hasProviderKey = Boolean(process.env.ZAPRAVKIN_API_KEY?.trim())

  if (!directoryStations.length && !liveStations.length && !importedStations.length && directoryResult.status === "rejected") {
    console.error("Fuel stations request failed", directoryResult.reason)
    return NextResponse.json({
      city: areaLabel,
      areaLabel,
      coordinates,
      stations: [],
      source: "OpenStreetMap",
      coverage: { dataMode: "DIRECTORY", liveProviderConfigured: hasProviderKey, liveStationCount: 0, directoryStationCount: 0, providerState: liveProviderHealth.state, rateLimitLimit: liveProviderHealth.limit, rateLimitRemaining: liveProviderHealth.remaining, providerRetryAt: liveProviderHealth.retryAt, liveDataStale: liveProviderHealth.stale },
      disclaimer: "Карта точек временно недоступна. Попробуйте позже.",
    }, { status: 503 })
  }

  const hasLiveData = liveStations.length > 0 || importedStations.length > 0
  const dataMode = hasLiveData ? "LIVE" : "DIRECTORY"
  const stations = mergeStations(mergeProviderStations([...liveStations, ...importedStations]), directoryStations)
  const disclaimer = hasLiveData
    ? "Статусы, ассортимент и цены с отметкой времени получены от подключённых источников. Остальные точки добавлены из OpenStreetMap как справочник — их ассортимент уточняйте на АЗС."
    : hasProviderKey
      ? "Проверенный поставщик временно не вернул данные для этого участка. Показаны справочные точки OpenStreetMap; ассортимент и наличие уточняйте на АЗС."
      : "Показаны справочные точки OpenStreetMap. Для фактического наличия и цен нужен подключённый поставщик данных; ассортимент уточняйте на АЗС."

  return NextResponse.json({
    city: areaLabel,
    areaLabel,
    coordinates,
    stations,
    source: hasLiveData ? "Подключённые источники + OpenStreetMap" : "OpenStreetMap",
    coverage: {
      dataMode,
      liveProviderConfigured: hasProviderKey,
      liveStationCount: liveStations.length,
      importedStationCount: importedStations.length,
      directoryStationCount: directoryStations.length,
      providerAttributionUrl: dataMode === "LIVE" ? "https://zapravkin24.ru" : null,
      providerState: liveProviderHealth.state,
      rateLimitLimit: liveProviderHealth.limit,
      rateLimitRemaining: liveProviderHealth.remaining,
      providerRetryAt: liveProviderHealth.retryAt,
      liveDataStale: liveProviderHealth.stale,
    },
    disclaimer,
  }, {
    headers: {
      /* Справочный режим кэшируется надолго и отдаётся устаревшим,
         пока обновляется.

         Список точек OpenStreetMap меняется раз в месяцы, а человек за
         рулём открывает карту по нескольку раз за поездку. Пять минут
         означали, что каждое второе открытие снова ждёт Overpass.

         stale-while-revalidate отдаёт прошлый ответ мгновенно и
         обновляет его в фоне: карта появляется сразу, а свежие точки
         подтягиваются к следующему открытию. */
      "Cache-Control": dataMode === "LIVE"
        ? "public, max-age=30, s-maxage=60, stale-while-revalidate=120"
        : "public, max-age=1800, s-maxage=21600, stale-while-revalidate=604800",
    },
  })
}
