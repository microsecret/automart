import { prisma } from "@/lib/prisma"

/**
 * Общее хранилище импортированных АЗС и цен.
 *
 * Скрейсеры (ГдеБЕНЗ, 2ГИС и другие) приводят данные к единой записи и
 * складывают сюда: точка обновляется по внешнему идентификатору, цена — по
 * марке на точке. Повторный прогон не плодит копий.
 */

export type ImportedStationPrice = {
  fuel: string
  priceRub: number
  confirmations: number
  observedAt: Date | null
}

export type ImportedStation = {
  source: string
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
  prices: ImportedStationPrice[]
}

export async function upsertImportedStations(stations: ImportedStation[]): Promise<number> {
  let saved = 0
  for (const station of stations) {
    const record = await prisma.fuelStationImport.upsert({
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
        where: { stationId_fuel: { stationId: record.id, fuel: price.fuel } },
        update: {
          priceRub: price.priceRub,
          confirmations: price.confirmations,
          observedAt: price.observedAt,
        },
        create: {
          stationId: record.id,
          fuel: price.fuel,
          priceRub: price.priceRub,
          confirmations: price.confirmations,
          observedAt: price.observedAt,
        },
      })
    }
    saved += 1
  }
  return saved
}

export async function createFuelImportRun(source: string, requested: number) {
  return prisma.fuelImportRun.create({
    data: { source, status: "RUNNING", requested },
    select: { id: true },
  })
}

export async function finishFuelImportRun(
  runId: string,
  result: { status: "SUCCEEDED" | "PARTIAL" | "FAILED"; fetched: number; upserted: number; failed: number; error?: string | null },
) {
  await prisma.fuelImportRun.update({
    where: { id: runId },
    data: {
      status: result.status,
      fetched: result.fetched,
      upserted: result.upserted,
      failed: result.failed,
      error: result.error ?? null,
      completedAt: new Date(),
    },
  })
}
