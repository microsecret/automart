/**
 * Целевые города и области для сбора АЗС и цен.
 *
 * Общий список для всех источников (ГдеБЕНЗ, 2ГИС и других): каждый регион —
 * это прямоугольник, который источник умеет отдавать одним запросом или
 * несколькими страницами.
 */

export type FuelTargetRegion = {
  key: string
  city: string
  lat1: number
  lon1: number
  lat2: number
  lon2: number
}

export const FUEL_TARGET_REGIONS: ReadonlyArray<FuelTargetRegion> = [
  { key: "moscow", city: "Москва", lat1: 55.30, lon1: 37.00, lat2: 56.20, lon2: 38.20 },
  { key: "moscow-oblast", city: "Московская область", lat1: 54.20, lon1: 35.00, lat2: 56.90, lon2: 40.30 },
  { key: "ufa", city: "Уфа", lat1: 54.50, lon1: 55.60, lat2: 55.00, lon2: 56.40 },
  { key: "bashkortostan", city: "Республика Башкортостан", lat1: 51.80, lon1: 53.00, lat2: 56.50, lon2: 60.00 },
  { key: "kazan", city: "Казань", lat1: 55.60, lon1: 48.80, lat2: 56.00, lon2: 49.60 },
  { key: "tatarstan", city: "Республика Татарстан", lat1: 54.20, lon1: 47.20, lat2: 56.80, lon2: 53.80 },
  { key: "naberezhnye-chelny", city: "Набережные Челны", lat1: 55.55, lon1: 52.10, lat2: 55.90, lon2: 52.80 },
  { key: "nizhnekamsk", city: "Нижнекамск", lat1: 55.50, lon1: 51.50, lat2: 55.80, lon2: 52.00 },
  { key: "ishimbay", city: "Ишимбай", lat1: 53.30, lon1: 55.80, lat2: 53.60, lon2: 56.20 },
  { key: "sterlitamak", city: "Стерлитамак", lat1: 53.50, lon1: 55.80, lat2: 53.80, lon2: 56.20 },
]

export function resolveTargetRegions(keys?: string[]): FuelTargetRegion[] {
  const requested = keys?.length ? new Set(keys) : null
  return FUEL_TARGET_REGIONS.filter((region) => !requested || requested.has(region.key))
}

export function targetRegionKeys(): string[] {
  return FUEL_TARGET_REGIONS.map((region) => region.key)
}
