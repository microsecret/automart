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
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
]

function getCoordinates(element: OverpassElement) {
  if (typeof element.lat === "number" && typeof element.lon === "number") return { latitude: element.lat, longitude: element.lon }
  if (element.center) return { latitude: element.center.lat, longitude: element.center.lon }
  return null
}

async function requestStations(query: string) {
  const endpoints = Array.from(new Set([
    process.env.OVERPASS_API_URL,
    ...OVERPASS_ENDPOINTS,
  ].filter((endpoint): endpoint is string => Boolean(endpoint))))
  let lastError: unknown

  for (const endpoint of endpoints) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 20_000)

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
      console.warn("Fuel stations source is temporarily unavailable", { endpoint, error: error instanceof Error ? error.message : "Unknown error" })
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
  const coordinates = CITY_COORDINATES[city]

  if (!coordinates) {
    return NextResponse.json({ error: "Выберите город из списка карты", cities: FUEL_MAP_CITIES }, { status: 400 })
  }

  const query = `[out:json][timeout:20];(node["amenity"="fuel"](around:14000,${coordinates.latitude},${coordinates.longitude});way["amenity"="fuel"](around:14000,${coordinates.latitude},${coordinates.longitude}););out center tags 120;`

  try {
    const payload = await requestStations(query)
    const stations = (payload.elements || []).flatMap((element) => {
      const coords = getCoordinates(element)
      if (!coords) return []
      const tags = element.tags || {}
      const fuels = Object.entries(FUEL_TAG_LABELS)
        .filter(([tag]) => tags[tag] === "yes")
        .map(([, label]) => label)

      return [{
        id: element.id,
        sourceType: element.type,
        name: tags.name || tags.brand || "АЗС",
        brand: tags.brand || null,
        operator: tags.operator || null,
        address: [tags["addr:street"], tags["addr:housenumber"]].filter(Boolean).join(", ") || null,
        openingHours: tags.opening_hours || null,
        fuels,
        ...coords,
      }]
    }).sort((a, b) => a.name.localeCompare(b.name, "ru"))

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
