import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { translateListingFields } from "@/lib/nvidia-translate"
import { calculateAuctionRubPricing, getAuctionExchangeRates, getAuctionRateToRub } from "@/lib/exchange-rates"
import { safeHttpsUrl } from "@/lib/media-url"
import { auctionSourceCountry, isAuctionSource } from "@/lib/auction-sources"

export const dynamic = "force-dynamic"

const PARSER_TOKEN = process.env.PARSER_TOKEN

const VALID_CURRENCIES = new Set(["RUB", "USD", "EUR", "JPY", "KRW", "CNY"])

type AuctionImportItem = {
  source: string
  sourceId: string
  sourceUrl: string
  make: string
  model: string
  year: number
  sourcePrice: number
  sourceCurrency: string
  country: string
  auctionDate: Date | null
  mileage: number | null
  fuelType: string | null
  transmission: string | null
  bodyType: string | null
  color: string | null
  engineVolume: number | null
  power: number | null
  driveType: string | null
  vin: string | null
  lotNumber: string | null
  imageUrl: string | null
  images: string[] | null
  descriptionOrig: string | null
  specsOrig: string | null
  location: string | null
}

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
    fuelType: optionalText(value.fuelType, 40),
    transmission: optionalText(value.transmission, 80),
    bodyType: optionalText(value.bodyType, 80),
    color: optionalText(value.color, 80),
    engineVolume: optionalNumber(value.engineVolume),
    power: optionalInteger(value.power),
    driveType: optionalText(value.driveType, 80),
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
    const token = request.headers.get("authorization")?.replace("Bearer ", "")
    if (token !== PARSER_TOKEN) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { items } = await request.json() as { items: unknown[] }
    if (!Array.isArray(items) || items.length === 0 || items.length > 500) return NextResponse.json({ error: "Передайте от 1 до 500 лотов" }, { status: 400 })
    let normalizedItems: AuctionImportItem[]
    try {
      normalizedItems = items.map(normalizeImportItem)
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Некорректный лот" }, { status: 400 })
    }

    const exchangeRates = await getAuctionExchangeRates()

    let created = 0, updated = 0, translated = 0

    for (const item of normalizedItems) {
      const existing = await prisma.auctionListing.findUnique({
        where: { source_sourceId: { source: item.source, sourceId: String(item.sourceId) } },
      }).catch(() => null)

      if (existing) {
        const sourceTextChanged = item.descriptionOrig !== existing.descriptionOrig || item.specsOrig !== existing.specsOrig
        let translatedFields: { descriptionRu: string | null; specsRu: string | null } | null = null
        if (sourceTextChanged && (item.descriptionOrig || item.specsOrig)) {
          try {
            translatedFields = await translateListingFields({ description: item.descriptionOrig, specs: item.specsOrig })
          } catch {
            // Переводчик не должен останавливать приём актуальных данных площадки.
          }
        }
        if (translatedFields?.descriptionRu || translatedFields?.specsRu) translated++

        await prisma.auctionListing.update({
          where: { id: existing.id },
          data: (() => {
            const exchangeRate = getAuctionRateToRub(item.sourceCurrency, exchangeRates)
            const price = calculateAuctionRubPricing(item.sourcePrice, exchangeRate, existing.markup)
            return {
              sourceUrl: item.sourceUrl,
              make: item.make,
              model: item.model,
              year: item.year,
              mileage: item.mileage,
              fuelType: item.fuelType,
              transmission: item.transmission,
              bodyType: item.bodyType,
              color: item.color,
              engineVolume: item.engineVolume,
              power: item.power,
              driveType: item.driveType,
              vin: item.vin,
              lotNumber: item.lotNumber,
              imageUrl: item.imageUrl,
              images: item.images ? JSON.stringify(item.images) : null,
              descriptionOrig: item.descriptionOrig,
              specsOrig: item.specsOrig,
              ...(translatedFields ? {
                descriptionRu: translatedFields.descriptionRu,
                specsRu: translatedFields.specsRu,
                isTranslated: Boolean(translatedFields.descriptionRu || translatedFields.specsRu),
                translatedAt: translatedFields.descriptionRu || translatedFields.specsRu ? new Date() : null,
              } : {}),
              location: item.location,
              sourcePrice: item.sourcePrice,
              sourceCurrency: item.sourceCurrency,
              priceRub: price.priceRub,
              finalPrice: price.finalPrice,
              exchangeRate,
              pricingUpdatedAt: new Date(),
              lastChecked: new Date(),
              auctionDate: item.auctionDate,
            }
          })(),
        })
        updated++
        continue
      }

      const exchangeRate = getAuctionRateToRub(item.sourceCurrency, exchangeRates)
      const basePriceRub = Math.max(0, Math.round(item.sourcePrice * exchangeRate))
      const markup = basePriceRub > 2000000 ? 150000 : 80000
      const price = calculateAuctionRubPricing(item.sourcePrice, exchangeRate, markup)

      let descriptionRu: string | null = null
      let specsRu: string | null = null
      if (item.descriptionOrig || item.specsOrig) {
        try {
          const tr = await translateListingFields({ description: item.descriptionOrig, specs: item.specsOrig })
          descriptionRu = tr.descriptionRu
          specsRu = tr.specsRu
          if (descriptionRu || specsRu) translated++
        } catch {}
      }

      await prisma.auctionListing.create({
        data: {
          sourceId: String(item.sourceId), source: item.source, sourceUrl: item.sourceUrl,
          make: item.make, model: item.model, year: item.year,
          mileage: item.mileage || null, fuelType: item.fuelType || null,
          transmission: item.transmission || null, bodyType: item.bodyType || null,
          color: item.color || null, engineVolume: item.engineVolume || null,
          power: item.power || null, driveType: item.driveType || null,
          vin: item.vin || null, lotNumber: item.lotNumber || null,
          sourcePrice: item.sourcePrice, sourceCurrency: item.sourceCurrency,
          priceRub: price.priceRub, markup, finalPrice: price.finalPrice,
          exchangeRate, pricingUpdatedAt: new Date(),
          imageUrl: item.imageUrl || null,
          images: item.images ? JSON.stringify(item.images) : null,
          descriptionOrig: item.descriptionOrig || null, specsOrig: item.specsOrig || null, descriptionRu, specsRu,
          country: item.country,
          auctionDate: item.auctionDate,
          location: item.location || null,
          isTranslated: Boolean(descriptionRu || specsRu), translatedAt: descriptionRu || specsRu ? new Date() : null,
        },
      })
      created++
    }

    return NextResponse.json({ success: true, created, updated, translated })
  } catch (error) {
    console.error("Parser error:", error)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
