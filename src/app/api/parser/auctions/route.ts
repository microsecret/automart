import { NextRequest, NextResponse } from "next/server"
import { safeHttpsUrl } from "@/lib/media-url"
import { auctionSourceCountry, isAuctionSource } from "@/lib/auction-sources"
import { saveAuctionImportItems, type AuctionImportItem } from "@/lib/auction-import"
import { normalizeAuctionBodyType, normalizeAuctionDriveType, normalizeAuctionFuelType, normalizeAuctionTransmission } from "@/lib/auction-normalization"

export const dynamic = "force-dynamic"

const PARSER_TOKEN = process.env.PARSER_TOKEN

const VALID_CURRENCIES = new Set(["RUB", "USD", "EUR", "JPY", "KRW", "CNY"])

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

function normalizeImportItem(item: unknown, index: number): AuctionImportItem {
  if (!item || typeof item !== "object") throw new Error(`Лот ${index + 1}: ожидается объект`)
  const value = item as Record<string, unknown>
  const source = typeof value.source === "string" ? value.source.trim().toUpperCase() : ""
  const sourceId = value.sourceId == null ? "" : String(value.sourceId).trim()
  const country = typeof value.country === "string" ? value.country.trim().toUpperCase() : ""
  const sourceCurrency = typeof value.sourceCurrency === "string" ? value.sourceCurrency.trim().toUpperCase() : ""
  const sourcePrice = Number(value.sourcePrice)
  const year = Number(value.year)
  const auctionDate = value.auctionDate ? new Date(String(value.auctionDate)) : null
  const make = optionalText(value.make, 120)
  const model = optionalText(value.model, 160)
  const sourceUrl = optionalUrl(value.sourceUrl)
  const images = Array.isArray(value.images) ? value.images.map(optionalUrl).filter((url): url is string => Boolean(url)).slice(0, 20) : null

  if (!isAuctionSource(source) || auctionSourceCountry(source) !== country) throw new Error(`Лот ${index + 1}: площадка не соответствует стране`)
  if (!sourceId || sourceId.length > 120) throw new Error(`Лот ${index + 1}: некорректный ID источника`)
  if (!VALID_CURRENCIES.has(sourceCurrency)) throw new Error(`Лот ${index + 1}: неподдерживаемая валюта`)
  if (!Number.isSafeInteger(sourcePrice) || sourcePrice < 0) throw new Error(`Лот ${index + 1}: некорректная цена`)
  if (!Number.isInteger(year) || year < 1886 || year > new Date().getFullYear() + 1) throw new Error(`Лот ${index + 1}: некорректный год`)
  if (value.auctionDate && (!auctionDate || Number.isNaN(auctionDate.getTime()))) throw new Error(`Лот ${index + 1}: некорректная дата торгов`)
  if (!make || !model) throw new Error(`Лот ${index + 1}: обязательны марка и модель`)
  if (!sourceUrl) throw new Error(`Лот ${index + 1}: нужна защищённая HTTPS-ссылка источника`)

  return {
    source,
    sourceId,
    country,
    sourceCurrency,
    sourcePrice,
    year,
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

    const { items } = await request.json() as { items: unknown[] }
    if (!Array.isArray(items) || items.length === 0 || items.length > 500) return NextResponse.json({ error: "Передайте от 1 до 500 лотов" }, { status: 400 })
    let normalizedItems: AuctionImportItem[]
    try {
      normalizedItems = items.map(normalizeImportItem)
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Некорректный лот" }, { status: 400 })
    }

    const result = await saveAuctionImportItems(normalizedItems)
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error("Parser error:", error)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
