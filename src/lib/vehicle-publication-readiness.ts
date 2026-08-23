/**
 * Единый контракт готовности транспортного объявления к модерации.
 *
 * Форма, API владельца и модератор используют один список. Это закрывает
 * обходы через старую быструю подачу, повторную отправку и прямой API-запрос.
 */

// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { AVAILABILITY_TYPES, BODY_TYPES, CONDITIONS, DAMAGE_INFO, DOCUMENT_STATUSES, DRIVE_TYPES, SELLER_TYPES, STEERING_WHEELS, getSelectableFuelOptions, getSelectableTransmissionOptions, getUsageMeta, getVehicleIdentityMeta, supportsTransmission } from "./constants.ts"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { getMissingSpecs, getRequiredSpecs, type ListingSpecInput, type RequiredSpecField } from "./listing-required-specs.ts"

export type VehiclePublicationField = RequiredSpecField
  | "make"
  | "model"
  | "price"
  | "location"
  | "vin"
  | "serialNumber"
  | "registrationNumber"
  | "description"
  | "images"

export type VehiclePublicationInput = ListingSpecInput & {
  make?: string | null
  model?: string | null
  price?: number | string | null
  location?: string | null
  vin?: string | null
  serialNumber?: string | null
  registrationNumber?: string | null
  description?: string | null
  images?: unknown
}

export type VehiclePublicationRequirement = {
  field: VehiclePublicationField
  label: string
  unit?: string
}

const STORED_SUBTYPE_FIELDS: Readonly<Record<string, string>> = {
  MOTORCYCLE: "motorcycleType",
  TRUCK: "truckBodyType",
  SPECIAL: "specialType",
  WATER: "waterType",
  AIR: "airType",
}

/** Извлекает подтип из сохранённого JSON без доверия к его структуре. */
export function readStoredVehicleSubtype(vehicleType: string | null | undefined, typeDetails: unknown): string {
  const field = STORED_SUBTYPE_FIELDS[String(vehicleType || "")]
  if (!field || typeof typeDetails !== "string" || !typeDetails.trim()) return ""
  try {
    const parsed = JSON.parse(typeDetails) as Record<string, unknown>
    return typeof parsed?.[field] === "string" ? parsed[field].trim() : ""
  } catch {
    return ""
  }
}

function isText(value: unknown, minLength = 1) {
  return typeof value === "string" && value.trim().length >= minLength
}

function hasImage(value: unknown): boolean {
  if (Array.isArray(value)) return value.some((item) => isText(item))
  if (typeof value !== "string" || !value.trim()) return false
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) && parsed.some((item) => isText(item))
  } catch {
    return false
  }
}

const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/
const TRANSPORT_IDENTIFIER_PATTERN = /^[A-ZА-ЯЁ0-9][A-ZА-ЯЁ0-9 .\/-]{1,31}$/

function isOption(value: unknown, options: readonly { value: string }[]): boolean {
  return typeof value === "string" && options.some((option) => option.value === value)
}

/** Проверяет не только наличие, но и правдоподобный формат значений. */
export function validateVehiclePublicationValues(input: VehiclePublicationInput): string | null {
  const vehicleType = String(input.vehicleType || "CAR")
  const requiredFields = new Set(getRequiredSpecs(input).map((requirement) => requirement.field))
  const identity = getVehicleIdentityMeta(vehicleType)
  const identityValue = typeof input[identity.field] === "string"
    ? input[identity.field]!.trim().toUpperCase()
    : ""
  if (identity.field === "vin" && !VIN_PATTERN.test(identityValue)) {
    return "VIN должен содержать 17 латинских символов и цифр без I, O и Q."
  }
  if (identity.field !== "vin" && !TRANSPORT_IDENTIFIER_PATTERN.test(identityValue)) {
    return `${identity.label} должен содержать от 3 до 32 букв, цифр, пробелов, точек, слэшей или дефисов.`
  }

  const currentYear = new Date().getFullYear()
  const year = Number(input.year)
  if (!Number.isSafeInteger(year) || year < 1886 || year > currentYear + 1) {
    return `Год выпуска должен быть от 1886 до ${currentYear + 1}.`
  }
  const price = Number(input.price)
  if (!Number.isSafeInteger(price) || price <= 0 || price > 2_000_000_000) {
    return "Цена должна быть целым числом от 1 до 2 000 000 000 рублей."
  }
  if (input.ownersCount != null && (!Number.isSafeInteger(Number(input.ownersCount)) || Number(input.ownersCount) < 0 || Number(input.ownersCount) > 100)) {
    return "Количество владельцев должно быть целым числом от 0 до 100."
  }
  if (input.engineVolume != null && input.engineVolume !== "" && (Number(input.engineVolume) <= 0 || Number(input.engineVolume) > 100)) {
    return "Объём двигателя должен быть больше 0 и не превышать 100 литров."
  }
  if (input.power != null && input.power !== "" && (!Number.isSafeInteger(Number(input.power)) || Number(input.power) <= 0 || Number(input.power) > 100_000)) {
    return "Мощность должна быть целым числом от 1 до 100 000 л.с."
  }
  const usage = getUsageMeta(vehicleType)
  const usageValue = input[usage.field]
  if (requiredFields.has(usage.field) && (!Number.isSafeInteger(Number(usageValue)) || Number(usageValue) < 0)) {
    return `${usage.label} должен быть неотрицательным целым числом.`
  }

  if (requiredFields.has("fuelType") && !isOption(input.fuelType, getSelectableFuelOptions(vehicleType))) {
    return "Выберите тип топлива из списка."
  }
  if (requiredFields.has("transmission") && supportsTransmission(vehicleType) && !isOption(input.transmission, getSelectableTransmissionOptions(vehicleType))) {
    return "Выберите коробку передач из списка."
  }
  if (vehicleType === "CAR" && !isOption(input.bodyType, BODY_TYPES)) return "Выберите тип кузова из списка."
  if (vehicleType === "CAR" && !isOption(input.driveType, DRIVE_TYPES)) return "Выберите привод из списка."
  if (!isOption(input.condition, CONDITIONS)) return "Выберите состояние из списка."
  if ((vehicleType === "CAR" || vehicleType === "TRUCK") && !isOption(input.steeringWheel, STEERING_WHEELS)) {
    return "Выберите расположение руля из списка."
  }
  if (!isOption(input.documentsStatus, DOCUMENT_STATUSES)) return "Выберите статус документов из списка."
  if (!isOption(input.damageInfo, DAMAGE_INFO)) return "Выберите сведения о повреждениях из списка."
  if (!isOption(input.sellerType, SELLER_TYPES)) return "Выберите тип продавца из списка."
  if (!isOption(input.availability, AVAILABILITY_TYPES)) return "Выберите наличие транспорта из списка."
  return null
}

export function getVehiclePublicationRequirements(input: VehiclePublicationInput): VehiclePublicationRequirement[] {
  const identity = getVehicleIdentityMeta(input.vehicleType)
  return [
    { field: "make", label: "Марка" },
    { field: "model", label: "Модель" },
    { field: "price", label: "Цена" },
    { field: "location", label: "Город размещения" },
    { field: identity.field, label: identity.label },
    ...getRequiredSpecs(input),
    { field: "description", label: "Описание не менее 40 символов" },
    { field: "images", label: "Фотография транспорта" },
  ]
}

function isRequirementFilled(input: VehiclePublicationInput, field: VehiclePublicationField): boolean {
  if (field === "images") return hasImage(input.images)
  if (field === "price") {
    const price = Number(input.price)
    return Number.isSafeInteger(price) && price > 0
  }
  if (field === "description") return isText(input.description, 40)
  if (field === "make") return isText(input.make, 2)
  if (field === "model") return isText(input.model)
  if (field === "location") return isText(input.location, 2)
  if (field === "vin") return isText(input.vin, 17)
  if (field === "serialNumber" || field === "registrationNumber") return isText(input[field], 3)

  // Поля характеристик проверяет общий модуль с условными правилами по
  // виду транспорта, топливу и подтипу.
  return !getMissingSpecs(input).some((requirement) => requirement.field === field)
}

export function getMissingVehiclePublicationRequirements(input: VehiclePublicationInput): VehiclePublicationRequirement[] {
  const requiredSpecs = new Set<RequiredSpecField>(getRequiredSpecs(input).map((requirement) => requirement.field))
  const missingSpecs = new Set<RequiredSpecField>(getMissingSpecs(input).map((requirement) => requirement.field))
  return getVehiclePublicationRequirements(input).filter((requirement) => {
    if (missingSpecs.has(requirement.field as RequiredSpecField)) return true
    if (requiredSpecs.has(requirement.field as RequiredSpecField)) return false
    return !isRequirementFilled(input, requirement.field)
  })
}

export function describeMissingVehiclePublicationRequirements(
  missing: readonly VehiclePublicationRequirement[],
): string | null {
  if (missing.length === 0) return null
  const labels = missing.map((item) => item.unit ? `${item.label} (${item.unit})` : item.label)
  return `До отправки на модерацию заполните: ${labels.join(", ")}.`
}

export function validateVehiclePublication(input: VehiclePublicationInput): string | null {
  return describeMissingVehiclePublicationRequirements(getMissingVehiclePublicationRequirements(input))
    || validateVehiclePublicationValues(input)
}
