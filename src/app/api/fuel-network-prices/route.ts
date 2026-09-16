import { NextRequest, NextResponse } from "next/server"
import { CITY_COORDINATES } from "@/lib/cities"
import { buildNetworkPrices, type NetworkPriceSample } from "@/lib/fuel-network-prices"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

/*
 * Радиус выборки вокруг центра города.
 *
 * Тридцать километров покрывают город с пригородами и не захватывают
 * соседний. Считать по полю `city` в базе нельзя: источник пишет туда и
 * «Трасса, Западная Сибирь», и такая точка не нашлась бы ни по одному
 * городу справочника.
 */
const RADIUS_KM = 30

/** Марки, по которым сводка вообще имеет смысл. */
const ALLOWED_FUELS = new Set(["AI92", "AI95", "AI98", "AI100", "DT", "GAS"])
const DEFAULT_FUEL = "AI95"

/*
 * Потолок выборки. Медиану есть смысл считать и по сотням точек, но
 * четыре тысячи записей — это уже про защиту памяти процесса, а не про
 * точность: в самом плотном городе, Москве, их семьсот пятьдесят.
 */
const MAX_SAMPLES = 4_000

/* Цены обновляются обходом раз в несколько часов — пересчитывать сводку
   на каждый заход незачем. Кэш в памяти процесса: переживает наплыв
   посетителей и умирает при деплое, что здесь и требуется. */
const CACHE_TTL = 1000 * 60 * 15
type CachedSummary = { payload: unknown; expiresAt: number }
const summaryCache = new Map<string, CachedSummary>()

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const cityParam = params.get("city") || ""
  const fuelParam = (params.get("fuel") || DEFAULT_FUEL).toUpperCase()

  const fuel = ALLOWED_FUELS.has(fuelParam) ? fuelParam : DEFAULT_FUEL
  const center = CITY_COORDINATES[cityParam]
  /* Неизвестный город — не ошибка: витрина просто не показывается.
     Подставлять вместо него Москву было бы хуже молчания: человек
     принял бы московские цены за свои. */
  if (!center) return NextResponse.json({ city: null, fuel, networks: [] })

  const cacheKey = `${cityParam}:${fuel}`
  const cached = summaryCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return NextResponse.json(cached.payload)

  /* Прямоугольник вместо круга: он ложится на индекс по координатам, а
     лишние углы на такой стороне дают считанные точки и медиану не
     сдвигают. */
  const latitudeDelta = RADIUS_KM / 111
  const longitudeDelta = RADIUS_KM / (111 * Math.cos(center.latitude * Math.PI / 180))

  const rows = await prisma.fuelStationImport.findMany({
    where: {
      latitude: { gte: center.latitude - latitudeDelta, lte: center.latitude + latitudeDelta },
      longitude: { gte: center.longitude - longitudeDelta, lte: center.longitude + longitudeDelta },
      prices: { some: { fuel } },
    },
    select: {
      name: true,
      brand: true,
      prices: { where: { fuel }, select: { fuel: true, priceRub: true } },
    },
    take: MAX_SAMPLES,
  })

  const samples: NetworkPriceSample[] = rows.flatMap((row) =>
    row.prices.map((price) => ({
      name: row.name || row.brand || "",
      brand: row.brand,
      fuel: price.fuel,
      priceRub: price.priceRub,
    })),
  )

  const payload = {
    city: cityParam,
    fuel,
    networks: buildNetworkPrices(samples),
  }
  summaryCache.set(cacheKey, { payload, expiresAt: Date.now() + CACHE_TTL })
  return NextResponse.json(payload)
}
