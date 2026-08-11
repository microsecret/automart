import { NextRequest, NextResponse } from "next/server"
import { CITY_COORDINATES } from "@/lib/cities"

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
  dataSource: "OPENSTREETMAP" | "ZAPRAVKIN" | "MERGED"
  name: string
  brand: string | null
  operator: string | null
  address: string | null
  openingHours: string | null
  fuels: string[]
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
const DIRECTORY_STATION_CACHE_TTL = 1000 * 60 * 20
const MAX_DIRECTORY_CACHE_ENTRIES = 80
const placeCache = new Map<string, CachedPlace>()
const directoryStationCache = new Map<string, CachedDirectoryStations>()
let lastNominatimRequestAt = 0

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
  const hasGenericName = !publishedName || /^(азс|агзс|fuel)$/iu.test(publishedName)

  if (brandOrOperator && hasGenericName) return brandOrOperator
  return publishedName || brandOrOperator || "АЗС"
}

function stationPriority(station: FuelStationPayload) {
  const namedOrBranded = station.name !== "АЗС" ? 10 : 0
  const publishedLiveStatus = station.status === "FUEL" ? 8 : station.status === "NO_FUEL" ? 4 : 0
  const taggedFuels = Math.min(station.fuels.length, 5)
  const hasAddress = station.address ? 1 : 0
  return namedOrBranded + publishedLiveStatus + taggedFuels + hasAddress
}

function getDirectoryCacheKey(coordinates: Coordinates, radius: number) {
  // Координаты намеренно округляются примерно до километра: для соседних
  // точек карты набор АЗС совпадает, а повторный запрос к Overpass не нужен.
  return `${coordinates.latitude.toFixed(2)}:${coordinates.longitude.toFixed(2)}:${radius}`
}

function cacheDirectoryStations(key: string, stations: FuelStationPayload[]) {
  if (directoryStationCache.size >= MAX_DIRECTORY_CACHE_ENTRIES) {
    const oldestKey = directoryStationCache.keys().next().value
    if (oldestKey) directoryStationCache.delete(oldestKey)
  }

  directoryStationCache.set(key, { stations, expiresAt: Date.now() + DIRECTORY_STATION_CACHE_TTL })
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

function getDistanceSquared(first: FuelStationPayload, second: FuelStationPayload) {
  const latitude = first.latitude - second.latitude
  const longitude = (first.longitude - second.longitude) * Math.cos(((first.latitude + second.latitude) / 2) * Math.PI / 180)
  return latitude ** 2 + longitude ** 2
}

function mergeStations(liveStations: FuelStationPayload[], directoryStations: FuelStationPayload[]) {
  const unmatchedDirectoryStations = [...directoryStations]
  const mergedLiveStations = liveStations.map((liveStation) => {
    const directoryIndex = unmatchedDirectoryStations.findIndex((directoryStation) => getDistanceSquared(liveStation, directoryStation) < 0.000001)
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

  const waitForPolicy = Math.max(0, 1_000 - (Date.now() - lastNominatimRequestAt))
  if (waitForPolicy) await new Promise((resolve) => setTimeout(resolve, waitForPolicy))

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
  lastNominatimRequestAt = Date.now()
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

async function requestLiveStations(coordinates: Coordinates, radius: number) {
  const apiKey = process.env.ZAPRAVKIN_API_KEY?.trim()
  if (!apiKey) return []

  const latitudeDelta = radius / 111_000
  const longitudeDelta = radius / Math.max(25_000, 111_000 * Math.cos(coordinates.latitude * Math.PI / 180))
  const bbox = [
    coordinates.longitude - longitudeDelta,
    coordinates.latitude - latitudeDelta,
    coordinates.longitude + longitudeDelta,
    coordinates.latitude + latitudeDelta,
  ].map((value) => value.toFixed(5)).join(",")
  const endpoint = `${ZAPRAVKIN_BASE_URL}/stations?${new URLSearchParams({ bbox, limit: "200" }).toString()}`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8_000)

  try {
    const response = await fetch(endpoint, {
      headers: { authorization: `Bearer ${apiKey}`, accept: "application/json" },
      signal: controller.signal,
      next: { revalidate: 0 },
    })
    if (!response.ok) throw new Error(`Live fuel provider responded with ${response.status}`)
    const payload = await response.json() as unknown
    const payloadRecord = asRecord(payload)
    const stations = Array.isArray(payload)
      ? payload
      : Array.isArray(payloadRecord?.data)
        ? payloadRecord.data
        : Array.isArray(payloadRecord?.stations)
          ? payloadRecord.stations
          : []
    return stations.map(normalizeLiveStation).filter((station): station is FuelStationPayload => Boolean(station))
  } catch (error) {
    console.warn("Live fuel provider is temporarily unavailable", error instanceof Error ? error.message : "Unknown error")
    return []
  } finally {
    clearTimeout(timeout)
  }
}

function normalizeDirectoryStations(elements: OverpassElement[]) {
  return elements.flatMap((element) => {
    const coordinates = getCoordinates(element)
    if (!coordinates) return []
    const tags = element.tags || {}
    const fuels = Object.entries(FUEL_TAG_LABELS)
      .filter(([tag]) => hasPublishedFuelTag(tags[tag]))
      .map(([, label]) => label)

    return [{
      id: `osm-${element.type}-${element.id}`,
      sourceType: element.type,
      dataSource: "OPENSTREETMAP" as const,
      name: getStationName(tags),
      brand: tags.brand || null,
      operator: tags.operator || null,
      address: [tags["addr:street"], tags["addr:housenumber"]].filter(Boolean).join(", ") || null,
      openingHours: tags.opening_hours || null,
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
  const city = request.nextUrl.searchParams.get("city") || "Москва"
  const place = request.nextUrl.searchParams.get("place")?.trim() || null
  const latitudeParam = request.nextUrl.searchParams.get("latitude")
  const longitudeParam = request.nextUrl.searchParams.get("longitude")
  const hasCustomCoordinates = latitudeParam !== null || longitudeParam !== null
  const requestedCoordinates = hasCustomCoordinates ? { latitude: Number(latitudeParam), longitude: Number(longitudeParam) } : null

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

  const radius = requestedCoordinates ? 30_000 : place ? 26_000 : 22_000
  const query = `[out:json][timeout:24];(node["amenity"="fuel"](around:${radius},${coordinates.latitude},${coordinates.longitude});way["amenity"="fuel"](around:${radius},${coordinates.latitude},${coordinates.longitude}););out center tags 180;`
  const directoryCacheKey = getDirectoryCacheKey(coordinates, radius)
  const cachedDirectory = directoryStationCache.get(directoryCacheKey)
  const directoryPromise = cachedDirectory && cachedDirectory.expiresAt > Date.now()
    ? Promise.resolve(cachedDirectory.stations)
    : requestStations(query).then((result) => {
        const stations = normalizeDirectoryStations(result.elements || [])
        cacheDirectoryStations(directoryCacheKey, stations)
        return stations
      })
  const [directoryResult, liveResult] = await Promise.allSettled([
    directoryPromise,
    requestLiveStations(coordinates, radius),
  ])
  const directoryStations = directoryResult.status === "fulfilled" ? directoryResult.value : []
  const liveStations = liveResult.status === "fulfilled" ? liveResult.value : []
  const hasProviderKey = Boolean(process.env.ZAPRAVKIN_API_KEY?.trim())

  if (!directoryStations.length && !liveStations.length && directoryResult.status === "rejected") {
    console.error("Fuel stations request failed", directoryResult.reason)
    return NextResponse.json({
      city: areaLabel,
      areaLabel,
      coordinates,
      stations: [],
      source: "OpenStreetMap",
      coverage: { dataMode: "DIRECTORY", liveProviderConfigured: hasProviderKey, liveStationCount: 0, directoryStationCount: 0 },
      disclaimer: "Карта точек временно недоступна. Попробуйте позже.",
    }, { status: 503 })
  }

  const dataMode = liveStations.length ? "LIVE" : "DIRECTORY"
  const stations = mergeStations(liveStations, directoryStations)
  const disclaimer = dataMode === "LIVE"
    ? "Статусы, ассортимент и цены с отметкой времени получены от подключённого поставщика. Остальные точки добавлены из OpenStreetMap как справочник — их ассортимент уточняйте на АЗС."
    : hasProviderKey
      ? "Проверенный поставщик временно не вернул данные для этого участка. Показаны справочные точки OpenStreetMap; ассортимент и наличие уточняйте на АЗС."
      : "Показаны справочные точки OpenStreetMap. Для фактического наличия и цен нужен подключённый поставщик данных; ассортимент уточняйте на АЗС."

  return NextResponse.json({
    city: areaLabel,
    areaLabel,
    coordinates,
    stations,
    source: dataMode === "LIVE" ? "Заправкин + OpenStreetMap" : "OpenStreetMap",
    coverage: {
      dataMode,
      liveProviderConfigured: hasProviderKey,
      liveStationCount: liveStations.length,
      directoryStationCount: directoryStations.length,
      providerAttributionUrl: dataMode === "LIVE" ? "https://zapravkin24.ru" : null,
    },
    disclaimer,
  }, {
    headers: {
      "Cache-Control": dataMode === "LIVE"
        ? "public, max-age=30, s-maxage=60, stale-while-revalidate=120"
        : "public, max-age=300, s-maxage=1800, stale-while-revalidate=86400",
    },
  })
}
