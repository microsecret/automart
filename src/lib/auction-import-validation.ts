import { safeHttpsUrl } from "@/lib/media-url"
import { AUCTION_DAMAGE_KINDS, type AuctionDamageKind, type AuctionDamageReport } from "@/lib/auction-damage"
import { auctionSourceCountry, isAuctionSource } from "@/lib/auction-sources"
import type { AuctionConditionInfo, AuctionEquipmentSnapshot, AuctionImportItem } from "@/lib/auction-import"
import { assessImportAge, resolveMaximumImportAgeYears } from "@/lib/import-age-policy"
import { MAX_AUCTION_INTEGER } from "@/lib/auction-price-guard"
import { isCustomerFacingRussianText, isIdentifiableAuctionMake, normalizeAuctionBodyType, normalizeAuctionDriveType, normalizeAuctionFuelType, normalizeAuctionMake, normalizeAuctionTransmission } from "@/lib/auction-normalization"

const VALID_CURRENCIES = new Set(["RUB", "USD", "EUR", "JPY", "KRW", "CNY"])
const MAX_IMAGES_PER_LISTING = 80
const VALID_DAMAGE_KINDS = new Set<string>(AUCTION_DAMAGE_KINDS)

function optionalText(value: unknown, maxLength = 500) {
  if (typeof value !== "string") return null
  const normalized = value.trim()
  return normalized && normalized.length <= maxLength ? normalized : null
}

function optionalInteger(value: unknown) {
  const normalized = Number(value)
  return Number.isSafeInteger(normalized) && normalized >= 0 ? normalized : null
}

function optionalNumber(value: unknown) {
  const normalized = Number(value)
  return Number.isFinite(normalized) && normalized >= 0 ? normalized : null
}

function optionalUrl(value: unknown) {
  return safeHttpsUrl(optionalText(value, 2_000))
}

function optionalRussianText(value: unknown, maxLength: number) {
  const normalized = optionalText(value, maxLength)
  return normalized && isCustomerFacingRussianText(normalized) ? normalized : null
}

function optionalRatio(value: unknown) {
  const normalized = Number(value)
  return Number.isFinite(normalized) && normalized >= 0 && normalized <= 1 ? normalized : null
}

function normalizeDamageKinds(value: unknown): AuctionDamageKind[] {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.filter((kind): kind is AuctionDamageKind => typeof kind === "string" && VALID_DAMAGE_KINDS.has(kind))))
}

function normalizeDamageReport(value: unknown): AuctionDamageReport | null {
  if (!value || typeof value !== "object") return null
  const input = value as Record<string, unknown>
  const sourceLabel = optionalRussianText(input.sourceLabel, 100)
  if (!sourceLabel || !Array.isArray(input.sections)) return null

  let totalItems = 0
  const sections = input.sections.flatMap((sectionValue) => {
    if (!sectionValue || typeof sectionValue !== "object" || totalItems >= 80) return []
    const section = sectionValue as Record<string, unknown>
    const code = optionalText(section.code, 40)
    const label = optionalRussianText(section.label, 100)
    if (!code || !label || !Array.isArray(section.items)) return []

    const items = section.items.flatMap((itemValue) => {
      if (!itemValue || typeof itemValue !== "object" || totalItems >= 80) return []
      const item = itemValue as Record<string, unknown>
      const id = optionalText(item.id, 120)
      const part = optionalRussianText(item.part, 160)
      const note = optionalRussianText(item.note, 500)
      const kinds = normalizeDamageKinds(item.kinds)
      if (!id || !part || !note || kinds.length === 0) return []

      const photos = Array.isArray(item.photos)
        ? item.photos.flatMap((photoValue) => {
            if (!photoValue || typeof photoValue !== "object") return []
            const photo = photoValue as Record<string, unknown>
            const url = optionalUrl(photo.url)
            const photoNote = optionalRussianText(photo.note, 500)
            const photoKinds = normalizeDamageKinds(photo.kinds)
            return url && photoNote && photoKinds.length > 0 ? [{ url, note: photoNote, kinds: photoKinds }] : []
          }).slice(0, 8)
        : []

      totalItems += 1
      return [{
        id,
        part,
        note,
        kinds,
        x: item.x == null ? null : optionalRatio(item.x),
        y: item.y == null ? null : optionalRatio(item.y),
        photos,
      }]
    })

    return items.length > 0 ? [{ code, label, diagramUrl: optionalUrl(section.diagramUrl), items }] : []
  }).slice(0, 12)

  return sections.length > 0 ? { sourceLabel, sections } : null
}

function normalizeEquipment(value: unknown): AuctionEquipmentSnapshot | null | undefined {
  if (value == null) return undefined
  if (!value || typeof value !== "object") return null
  const input = value as Record<string, unknown>
  const items = Array.isArray(input.items)
    ? input.items.flatMap((item) => {
        if (!item || typeof item !== "object") return []
        const entry = item as Record<string, unknown>
        const label = optionalText(entry.label, 120)
        return label && typeof entry.available === "boolean" ? [{ label, available: entry.available }] : []
      }).slice(0, 100)
    : []
  const totalReported = input.totalReported == null ? null : optionalInteger(input.totalReported)
  return { totalReported, items }
}

function normalizeConditionInfo(value: unknown): AuctionConditionInfo | null | undefined {
  if (value == null) return undefined
  if (!value || typeof value !== "object") return null
  const input = value as Record<string, unknown>
  const insuranceRecordCount = input.insuranceRecordCount == null ? null : optionalInteger(input.insuranceRecordCount)
  const ratio = input.newCarPriceRatioPct == null ? null : optionalNumber(input.newCarPriceRatioPct)
  const verifiedItems = Array.isArray(input.verifiedItems)
    ? input.verifiedItems.flatMap((item) => {
        if (!item || typeof item !== "object") return []
        const entry = item as Record<string, unknown>
        const label = optionalText(entry.label, 120)
        const status = optionalText(entry.status, 500)
        return label && status ? [{ label, status }] : []
      }).slice(0, 100)
    : []
  return {
    insuranceRecordCount,
    inspectionSummary: optionalText(input.inspectionSummary, 2_000),
    newCarPriceRatioPct: ratio != null && ratio <= 100 ? ratio : null,
    verifiedItems,
    damageReport: normalizeDamageReport(input.damageReport),
  }
}

export function normalizeAuctionImportItem(item: unknown, index = 0): AuctionImportItem {
  if (!item || typeof item !== "object") throw new Error(`Лот ${index + 1}: ожидается объект`)
  const value = item as Record<string, unknown>
  const source = typeof value.source === "string" ? value.source.trim().toUpperCase() : ""
  const sourceId = value.sourceId == null ? "" : String(value.sourceId).trim()
  const country = typeof value.country === "string" ? value.country.trim().toUpperCase() : ""
  const sourceCurrency = typeof value.sourceCurrency === "string" ? value.sourceCurrency.trim().toUpperCase() : ""
  const sourcePrice = Number(value.sourcePrice)
  const year = Number(value.year)
  const maxImportAgeYears = resolveMaximumImportAgeYears(undefined)
  const auctionDate = value.auctionDate ? new Date(String(value.auctionDate)) : null
  const make = normalizeAuctionMake(optionalText(value.make, 120))
  const model = optionalText(value.model, 160)
  const manufacturedMonth = optionalText(value.manufacturedMonth, 7)
  const sourceTitle = optionalText(value.sourceTitle, 500)
  const sourceUrl = optionalUrl(value.sourceUrl)
  if (Array.isArray(value.images) && value.images.length > MAX_IMAGES_PER_LISTING) throw new Error(`Лот ${index + 1}: допускается не более ${MAX_IMAGES_PER_LISTING} фотографий`)
  const images = Array.isArray(value.images) ? value.images.map(optionalUrl).filter((url): url is string => Boolean(url)) : null

  if (!isAuctionSource(source) || auctionSourceCountry(source) !== country) throw new Error(`Лот ${index + 1}: площадка не соответствует стране`)
  if (!sourceId || sourceId.length > 120) throw new Error(`Лот ${index + 1}: некорректный ID источника`)
  if (!VALID_CURRENCIES.has(sourceCurrency)) throw new Error(`Лот ${index + 1}: неподдерживаемая валюта`)
  if (!Number.isSafeInteger(sourcePrice) || sourcePrice < 0 || sourcePrice > MAX_AUCTION_INTEGER) throw new Error(`Лот ${index + 1}: некорректная цена`)
  if (!Number.isInteger(year) || year < 1886 || year > new Date().getFullYear() + 1) throw new Error(`Лот ${index + 1}: некорректный год`)
  if (!assessImportAge({ year, manufacturedMonth }, maxImportAgeYears).eligible) throw new Error(`Лот ${index + 1}: принимаются автомобили не старше ${maxImportAgeYears} лет`)
  if (value.auctionDate && (!auctionDate || Number.isNaN(auctionDate.getTime()))) throw new Error(`Лот ${index + 1}: некорректная дата торгов`)
  if (!make || !isIdentifiableAuctionMake(make) || !model) throw new Error(`Лот ${index + 1}: обязательны распознаваемые марка и модель`)
  if (manufacturedMonth && !/^\d{4}-(0[1-9]|1[0-2])$/.test(manufacturedMonth)) throw new Error(`Лот ${index + 1}: месяц выпуска должен быть в формате YYYY-MM`)
  if (!sourceUrl) throw new Error(`Лот ${index + 1}: нужна защищённая HTTPS-ссылка источника`)

  return {
    source, sourceId, country, sourceCurrency, sourcePrice, year, manufacturedMonth, auctionDate, make, model, sourceUrl, sourceTitle,
    mileage: optionalInteger(value.mileage),
    fuelType: normalizeAuctionFuelType(value.fuelType),
    transmission: normalizeAuctionTransmission(value.transmission),
    bodyType: normalizeAuctionBodyType(value.bodyType),
    color: optionalText(value.color, 80),
    engineVolume: optionalNumber(value.engineVolume),
    power: optionalInteger(value.power),
    driveType: normalizeAuctionDriveType(value.driveType),
    vin: optionalText(value.vin, 64),
    lotNumber: optionalText(value.lotNumber, 120),
    imageUrl: optionalUrl(value.imageUrl),
    images,
    descriptionOrig: optionalText(value.descriptionOrig, 20_000),
    specsOrig: optionalText(value.specsOrig, 10_000),
    equipment: normalizeEquipment(value.equipment),
    conditionInfo: normalizeConditionInfo(value.conditionInfo),
    location: optionalText(value.location, 240),
  }
}
