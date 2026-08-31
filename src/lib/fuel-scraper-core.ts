import { prisma } from "@/lib/prisma"

/**
 * Общая часть скрейперов АЗС: регионы, сохранение, журнал прогонов.
 *
 * Источники (ГдеБЕНЗ, ГдеЗаправка и будущие) отличаются только способом
 * получить список точек с ценами; нормализация, запись в базу и отчёт о
 * прогоне одинаковы для всех. Поэтому вынесены сюда.
 */

export type FuelRegion = {
  key: string
  city: string
  lat1: number
  lon1: number
  lat2: number
  lon2: number
}

/** Целевые города и области первого запуска. */
export const FUEL_TARGET_REGIONS: ReadonlyArray<FuelRegion> = [
  { key: "moscow", city: "Москва", lat1: 55.30, lon1: 37.00, lat2: 56.20, lon2: 38.20 },
  { key: "moscow-oblast", city: "Московская область", lat1: 54.20, lon1: 35.00, lat2: 56.90, lon2: 40.30 },
  { key: "ufa", city: "Уфа", lat1: 54.50, lon1: 55.60, lat2: 55.00, lon2: 56.40 },
  { key: "bashkortostan", city: "Республика Башкортостан", lat1: 51.80, lon1: 53.00, lat2: 56.50, lon2: 60.00 },
  { key: "kazan", city: "Казань", lat1: 55.60, lon1: 48.80, lat2: 56.00, lon2: 49.60 },
  { key: "naberezhnye-chelny", city: "Набережные Челны", lat1: 55.55, lon1: 52.10, lat2: 55.90, lon2: 52.80 },
  { key: "nizhnekamsk", city: "Нижнекамск", lat1: 55.50, lon1: 51.50, lat2: 55.80, lon2: 52.00 },
  { key: "ishimbay", city: "Ишимбай", lat1: 53.30, lon1: 55.80, lat2: 53.60, lon2: 56.20 },
  { key: "sterlitamak", city: "Стерлитамак", lat1: 53.50, lon1: 55.80, lat2: 53.80, lon2: 56.20 },
]

export type NormalizedFuelPrice = {
  fuel: string // AI92, AI95, AI98, AI100, DT, GAS
  priceRub: number // копейки
  confirmations: number
  observedAt: Date | null
}

export type NormalizedFuelStation = {
  source: string // GDEBENZ, GDEZAPRAVKA, ...
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
  prices: NormalizedFuelPrice[]
}

export async function saveFuelStation(station: NormalizedFuelStation) {
  const saved = await prisma.fuelStationImport.upsert({
    where: { source_sourceId: { source: station.source, sourceId: station.sourceId } },
    update: {
      name: station.name,
      brand: station.brand,
      address: station.address,
      city: station.city,
      latitude: station.latitude,
      longitude: station.longitude,
      status: station.status,
      fuelsNow: station.fuelsNow,
      dtOnly: station.dtOnly,
    },
    create: {
      source: station.source,
      sourceId: station.sourceId,
      name: station.name,
      brand: station.brand,
      address: station.address,
      city: station.city,
      latitude: station.latitude,
      longitude: station.longitude,
      status: station.status,
      fuelsNow: station.fuelsNow,
      dtOnly: station.dtOnly,
    },
    select: { id: true },
  })

  for (const price of station.prices) {
    await prisma.fuelPriceImport.upsert({
      where: { stationId_fuel: { stationId: saved.id, fuel: price.fuel } },
      update: {
        priceRub: price.priceRub,
        confirmations: price.confirmations,
        observedAt: price.observedAt,
      },
      create: {
        stationId: saved.id,
        fuel: price.fuel,
        priceRub: price.priceRub,
        confirmations: price.confirmations,
        observedAt: price.observedAt,
      },
    })
  }
}

export type FuelCollectRegionResult = {
  key: string
  city: string
  fetched: number
  saved: number
  error: string | null
}

export type FuelCollectResult = {
  runId: string
  source: string
  status: "SUCCEEDED" | "PARTIAL" | "FAILED"
  regions: FuelCollectRegionResult[]
  fetched: number
  saved: number
  failed: number
}

/**
 * Прогон сбора по регионам одного источника.
 *
 * Регионы обходятся строго по одному с паузой: последовательные запросы
 * выглядят для защиты источника как человек у карты, а не скрейпер.
 */
export async function runFuelCollection(options: {
  source: string
  regions: readonly FuelRegion[]
  pauseMs: number
  fetchRegion: (region: FuelRegion) => Promise<NormalizedFuelStation[]>
}): Promise<FuelCollectResult> {
  const { source, regions, pauseMs, fetchRegion } = options

  const run = await prisma.fuelImportRun.create({
    data: { source, status: "RUNNING", requested: regions.length },
    select: { id: true },
  })

  const regionResults: FuelCollectRegionResult[] = []
  let fetchedTotal = 0
  let savedTotal = 0
  let failedTotal = 0

  for (let index = 0; index < regions.length; index += 1) {
    const region = regions[index]
    let fetched = 0
    let saved = 0
    let error: string | null = null

    try {
      const stations = await fetchRegion(region)
      fetched = stations.length
      for (const station of stations) {
        await saveFuelStation(station)
        saved += 1
      }
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

  const status: FuelCollectResult["status"] = failedTotal === 0
    ? "SUCCEEDED"
    : failedTotal === regions.length
      ? "FAILED"
      : "PARTIAL"

  await prisma.fuelImportRun.update({
    where: { id: run.id },
    data: {
      status,
      fetched: fetchedTotal,
      upserted: savedTotal,
      failed: failedTotal,
      error: status === "FAILED" ? "Все регионы не ответили" : null,
      completedAt: new Date(),
    },
  })

  return { runId: run.id, source, status, regions: regionResults, fetched: fetchedTotal, saved: savedTotal, failed: failedTotal }
}
