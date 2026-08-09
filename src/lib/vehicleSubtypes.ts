import { AIR_TYPES, BODY_TYPES, MOTORCYCLE_TYPES, SPECIAL_TYPES, TRUCK_BODY_TYPES, WATER_TYPES } from "@/lib/constants"

export type VehicleSubtypeType = "CAR" | "MOTORCYCLE" | "TRUCK" | "SPECIAL" | "WATER" | "AIR"
export type VehicleTypeDetails = Record<string, string | number | boolean>
type InferredVehicleSubtype = { bodyType?: string; typeDetails?: VehicleTypeDetails }

type Option = { value: string; label: string }

export const VEHICLE_SUBTYPE_CONFIG: Record<VehicleSubtypeType, { field: string; label: string; options: readonly Option[] }> = {
  CAR: { field: "bodyType", label: "Кузов", options: BODY_TYPES },
  MOTORCYCLE: { field: "motorcycleType", label: "Класс мотоцикла", options: MOTORCYCLE_TYPES },
  TRUCK: { field: "truckBodyType", label: "Надстройка", options: TRUCK_BODY_TYPES },
  SPECIAL: { field: "specialType", label: "Вид техники", options: SPECIAL_TYPES },
  WATER: { field: "waterType", label: "Тип судна", options: WATER_TYPES },
  AIR: { field: "airType", label: "Категория ВС", options: AIR_TYPES },
}

export function getVehicleSubtypeConfig(vehicleType: string | null | undefined) {
  return VEHICLE_SUBTYPE_CONFIG[vehicleType as VehicleSubtypeType] || null
}

export function isValidVehicleSubtype(vehicleType: string, value: string) {
  return getVehicleSubtypeConfig(vehicleType)?.options.some((option) => option.value === value) || false
}

export function getVehicleSubtypeLabel(
  vehicleType: string | null | undefined,
  bodyType?: string | null,
  typeDetails?: string | null,
) {
  const config = getVehicleSubtypeConfig(vehicleType)
  if (!config) return null

  if (vehicleType === "CAR") {
    return config.options.find((option) => option.value === bodyType)?.label || null
  }

  try {
    const details = typeDetails ? JSON.parse(typeDetails) as VehicleTypeDetails : null
    const value = details?.[config.field]
    return typeof value === "string"
      ? config.options.find((option) => option.value === value)?.label || null
      : null
  } catch {
    return null
  }
}

function includesAny(value: string, terms: string[]) {
  return terms.some((term) => value.includes(term))
}

/**
 * Conservative classifier for a blank subtype field. It only suggests a value
 * for well-known model families and never replaces a value entered by a seller.
 */
export function inferVehicleSubtype(vehicleType: string, make: string, model: string): InferredVehicleSubtype {
  const value = `${make} ${model}`.toLocaleLowerCase("ru-RU")
  const detail = (field: string, subtype: string) => ({ typeDetails: { [field]: subtype } })

  if (vehicleType === "CAR") {
    if (includesAny(value, ["alphard", "vito", "caravelle", "multivan", "serena", "stepwgn", "odyssey"])) return { bodyType: "MINIVAN" }
    if (includesAny(value, ["x5", "x7", "g-class", "land cruiser", "prado", "defender", "patrol", "tahoe", "wrangler", "sequoia"])) return { bodyType: "SUV" }
    if (includesAny(value, ["rav4", "tiguan", "sportage", "tucson", "creta", "cx-", "q3", "q5", "q7", "x3", "xc60", "xc90", "duster", "haval", "chery", "exeed", "geely", "jetour"])) return { bodyType: "CROSSOVER" }
    return {}
  }

  if (vehicleType === "MOTORCYCLE") {
    if (includesAny(value, ["scooter", "nmax", "xmax", "tmax", "pcx", "dio", "burgman", "forza"])) return detail("motorcycleType", "SCOOTER")
    if (includesAny(value, ["ninja", "yzf-r", "gsx-r", "cbr", "panigale", "s1000rr", "hayabusa"])) return detail("motorcycleType", "SPORT")
    if (includesAny(value, ["gs", "africa twin", "v-strom", "versys", "adventure", "multistrada"])) return detail("motorcycleType", "ADVENTURE")
    if (includesAny(value, ["sportster", "softail", "vulcan", "bolt", "indian"])) return detail("motorcycleType", "CRUISER")
    return {}
  }

  if (vehicleType === "TRUCK") {
    if (includesAny(value, ["6520", "5516", "самосвал", "dump"])) return detail("truckBodyType", "DUMP")
    if (includesAny(value, ["fh", "fm", "r450", "s650", "actros", "tgx", "5490", "тягач"])) return detail("truckBodyType", "TRACTOR")
    if (includesAny(value, ["refrigerator", "рефрижератор"])) return detail("truckBodyType", "REFRIGERATOR")
    return {}
  }

  if (vehicleType === "SPECIAL") {
    if (includesAny(value, ["pc", "zx", "ec", "dx", "js", "xe", "r 2", "экскаватор"])) return detail("specialType", "EXCAVATOR")
    if (includesAny(value, ["wa", "lw", "l120", "l 586", "hl", "погрузчик"])) return detail("specialType", "LOADER")
    if (includesAny(value, ["d65", "pr 7", "бульдозер"])) return detail("specialType", "BULLDOZER")
    if (includesAny(value, ["gr", "грейдер"])) return detail("specialType", "GRADER")
    return {}
  }

  if (vehicleType === "WATER") {
    if (includesAny(value, ["sea-doo", "seadoo", "гидроцикл", "jet ski"])) return detail("waterType", "JETSKI")
    if (includesAny(value, ["bayliner", "mastercraft", "malibu", "лодка", "boat"])) return detail("waterType", "BOAT")
    if (includesAny(value, ["azimut", "ferretti", "яхт", "yacht"])) return detail("waterType", "YACHT")
    return {}
  }

  if (vehicleType === "AIR") {
    if (includesAny(value, ["airbus helicopter", "bell", "robinson", "eurocopter", "mil mi", "вертол"] )) return detail("airType", "HELICOPTER")
    if (includesAny(value, ["cessna", "piper", "beechcraft", "citation", "самол"] )) return detail("airType", "AIRPLANE")
  }

  return {}
}
