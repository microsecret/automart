import { NextRequest, NextResponse } from "next/server"
import { CITY_COORDINATES, FUEL_MAP_CITIES } from "@/lib/cities"

export const revalidate = 1800

type OverpassElement = {
  id: number
  type: "node" | "way" | "relation"
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

type FuelStationPayload = {
  id: number
  sourceType: OverpassElement["type"]
  name: string
  brand: string | null
  operator: string | null
  address: string | null
  openingHours: string | null
  fuels: string[]
  latitude: number
  longitude: number
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

const OVERPASS_ENDPOINTS = [
  "https://overpass.openstreetmap.fr/api/interpreter",
  "https://overpass-api.de/api/interpreter",
]

function hasPublishedFuelTag(value: string | undefined) {
  return /^(yes|true|1)$/iu.test(value?.trim() || "")
}

function getCoordinates(element: OverpassElement) {
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
  const taggedFuels = Math.min(station.fuels.length, 5)
  const hasAddress = station.address ? 1 : 0
  return namedOrBranded + taggedFuels + hasAddress
}

function isRussianMapCoordinate(latitude: number, longitude: number) {
  return Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= 41 && latitude <= 82 && longitude >= 19 && longitude <= 190
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

/**
 * Не является источником цен или фактических остатков топлива. Мы берём из
 * OSM только опубликованные точки АЗС и открытые описательные теги.
 */
export async function GET(request: NextRequest) {
  const city = request.nextUrl.searchParams.get("city") || "Москва"
  const cityCoordinates = CITY_COORDINATES[city]
  const latitudeParam = request.nextUrl.searchParams.get("latitude")
  const longitudeParam = request.nextUrl.searchParams.get("longitude")
  const hasCustomCoordinates = latitudeParam !== null || longitudeParam !== null
  const requestedCoordinates = hasCustomCoordinates ? { latitude: Number(latitudeParam), longitude: Number(longitudeParam) } : null

  if (!cityCoordinates) {
    return NextResponse.json({ error: "Выберите город из списка карты", cities: FUEL_MAP_CITIES }, { status: 400 })
  }

  if (requestedCoordinates && !isRussianMapCoordinate(requestedCoordinates.latitude, requestedCoordinates.longitude)) {
    return NextResponse.json({ error: "Выберите участок на территории России" }, { status: 400 })
  }

  const coordinates = requestedCoordinates || cityCoordinates
  const radius = requestedCoordinates ? 22_000 : 14_000

  const query = `[out:json][timeout:20];(node["amenity"="fuel"](around:${radius},${coordinates.latitude},${coordinates.longitude});way["amenity"="fuel"](around:${radius},${coordinates.latitude},${coordinates.longitude}););out center tags 120;`

  try {
    const payload = await requestStations(query)
    const stations: FuelStationPayload[] = (payload.elements || []).flatMap((element) => {
      const coords = getCoordinates(element)
      if (!coords) return []
      const tags = element.tags || {}
      const fuels = Object.entries(FUEL_TAG_LABELS)
        .filter(([tag]) => hasPublishedFuelTag(tags[tag]))
        .map(([, label]) => label)

      return [{
        id: element.id,
        sourceType: element.type,
        name: getStationName(tags),
        brand: tags.brand || null,
        operator: tags.operator || null,
        address: [tags["addr:street"], tags["addr:housenumber"]].filter(Boolean).join(", ") || null,
        openingHours: tags.opening_hours || null,
        fuels,
        ...coords,
      }]
    }).sort((a, b) => stationPriority(b) - stationPriority(a) || a.name.localeCompare(b.name, "ru"))

    return NextResponse.json({
      city,
      coordinates,
      stations,
      source: "OpenStreetMap",
      disclaimer: "Точки и открытые теги предоставлены OpenStreetMap. Ассортимент, цены и наличие топлива уточняйте на АЗС.",
    }, {
      headers: { "Cache-Control": "public, max-age=300, s-maxage=1800, stale-while-revalidate=86400" },
    })
  } catch (error) {
    console.error("Fuel stations request failed", error)
    return NextResponse.json({
      city,
      coordinates,
      stations: [],
      source: "OpenStreetMap",
      disclaimer: "Карта точек временно недоступна. Попробуйте позже.",
    }, { status: 503 })
  }
}
