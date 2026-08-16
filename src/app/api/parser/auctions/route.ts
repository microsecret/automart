import { NextRequest, NextResponse } from "next/server"
import { safeHttpsUrl } from "@/lib/media-url"
import { auctionSourceCountry, isAuctionSource } from "@/lib/auction-sources"
import { saveAuctionImportItems, type AuctionConditionInfo, type AuctionEquipmentSnapshot, type AuctionImportItem } from "@/lib/auction-import"
import { assessImportAge, resolveMaximumImportAgeYears } from "@/lib/import-age-policy"
import { isIdentifiableAuctionMake, normalizeAuctionBodyType, normalizeAuctionDriveType, normalizeAuctionFuelType, normalizeAuctionMake, normalizeAuctionTransmission } from "@/lib/auction-normalization"

export const dynamic = "force-dynamic"

const PARSER_TOKEN = process.env.PARSER_TOKEN

const VALID_CURRENCIES = new Set(["RUB", "USD", "EUR", "JPY", "KRW", "CNY"])
const MAX_IMAGES_PER_LISTING = 80

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
        const status = optionalText(entry.status, 80)
        return label && status ? [{ label, status }] : []
      }).slice(0, 100)
    : []
  return {
    insuranceRecordCount,
    inspectionSummary: optionalText(input.inspectionSummary, 2_000),
    newCarPriceRatioPct: ratio != null && ratio <= 100 ? ratio : null,
    verifiedItems,
  }
}

function normalizeImportItem(item: unknown, index: number): AuctionImportItem {
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
  const sourceUrl = optionalUrl(value.sourceUrl)
  if (Array.isArray(value.images) && value.images.length > MAX_IMAGES_PER_LISTING) {
    throw new Error(`Лот ${index + 1}: допускается не более ${MAX_IMAGES_PER_LISTING} фотографий`)
  }
  const images = Array.isArray(value.images) ? value.images.map(optionalUrl).filter((url): url is string => Boolean(url)) : null

  if (!isAuctionSource(source) || auctionSourceCountry(source) !== country) throw new Error(`Лот ${index + 1}: площадка не соответствует стране`)
  if (!sourceId || sourceId.length > 120) throw new Error(`Лот ${index + 1}: некорректный ID источника`)
  if (!VALID_CURRENCIES.has(sourceCurrency)) throw new Error(`Лот ${index + 1}: неподдерживаемая валюта`)
  if (!Number.isSafeInteger(sourcePrice) || sourcePrice < 0) throw new Error(`Лот ${index + 1}: некорректная цена`)
  if (!Number.isInteger(year) || year < 1886 || year > new Date().getFullYear() + 1) throw new Error(`Лот ${index + 1}: некорректный год`)
  if (!assessImportAge({ year, manufacturedMonth }, maxImportAgeYears).eligible) throw new Error(`Лот ${index + 1}: принимаются автомобили не старше ${maxImportAgeYears} лет`)
  if (value.auctionDate && (!auctionDate || Number.isNaN(auctionDate.getTime()))) throw new Error(`Лот ${index + 1}: некорректная дата торгов`)
  if (!make || !isIdentifiableAuctionMake(make) || !model) throw new Error(`Лот ${index + 1}: обязательны распознаваемые марка и модель`)
  if (manufacturedMonth && !/^\d{4}-(0[1-9]|1[0-2])$/.test(manufacturedMonth)) throw new Error(`Лот ${index + 1}: месяц выпуска должен быть в формате YYYY-MM`)
  if (!sourceUrl) throw new Error(`Лот ${index + 1}: нужна защищённая HTTPS-ссылка источника`)

  return {
    source,
    sourceId,
    country,
    sourceCurrency,
    sourcePrice,
    year,
    manufacturedMonth,
    auctionDate,
    make,
    model,
    sourceUrl,
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

export async function POST(request: NextRequest) {
  try {
    if (!PARSER_TOKEN) {
      console.error("PARSER_TOKEN is not configured")
      return NextResponse.json({ error: "Auction import is not configured" }, { status: 503 })
    }
    if (request.headers.get("authorization") !== `Bearer ${PARSER_TOKEN}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { items, dryRun = false } = await request.json() as { items: unknown[]; dryRun?: boolean }
    if (!Array.isArray(items) || items.length === 0 || items.length > 500) return NextResponse.json({ error: "Передайте от 1 до 500 лотов" }, { status: 400 })
    if (typeof dryRun !== "boolean") return NextResponse.json({ error: "dryRun должен быть логическим значением" }, { status: 400 })
    let normalizedItems: AuctionImportItem[]
    try {
      normalizedItems = items.map(normalizeImportItem)
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Некорректный лот" }, { status: 400 })
    }

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        validated: normalizedItems.length,
        sources: [...new Set(normalizedItems.map((item) => item.source))],
        imagesValidated: normalizedItems.reduce((total, item) => total + (item.images?.length || (item.imageUrl ? 1 : 0)), 0),
      })
    }

    const result = await saveAuctionImportItems(normalizedItems)
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error("Parser error:", error)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
