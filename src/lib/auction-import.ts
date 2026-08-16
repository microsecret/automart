import { prisma } from "@/lib/prisma"
import { translateListingFields, translateToRussian } from "@/lib/nvidia-translate"
import { calculateAuctionRubPricing, getAuctionExchangeRates, getAuctionRateToRub } from "@/lib/exchange-rates"
import { estimatedAuctionServiceFee } from "@/lib/auction-service-fee"
import { normalizeAuctionEngineVolumeCc } from "@/lib/auction-normalization"

function hasUntranslatedForeignText(original: string | null, translated: string | null) {
  if (!original) return false
  const hasForeignOriginal = /[\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF]/.test(original)
  // A partial fallback such as `명серебристый` is not a usable Russian
  // translation either. Keeping it marked as translated would stop the next
  // source refresh from repairing the customer-visible field.
  return !translated
    || (hasForeignOriginal && original.trim() === translated.trim())
    || /[\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF]/.test(translated)
}

function hasUsableTranslation(original: string | null, translated: string | null) {
  return Boolean(original && translated && !hasUntranslatedForeignText(original, translated))
}

const FOREIGN_DISPLAY_TEXT = /[A-Za-z\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF]/
const CYRILLIC_TEXT = /[\u0400-\u04FF]/
const IMPORT_COLOR_LABELS: Readonly<Record<string, string>> = {
  white: "белый", black: "чёрный", silver: "серебристый", gray: "серый", grey: "серый",
  red: "красный", blue: "синий", green: "зелёный", yellow: "жёлтый", orange: "оранжевый",
  brown: "коричневый", beige: "бежевый", gold: "золотистый", purple: "фиолетовый",
  "흰색": "белый", "검정색": "чёрный", "은색": "серебристый", "회색": "серый", "빨간색": "красный", "파란색": "синий",
  "白色": "белый", "黑色": "чёрный", "银色": "серебристый", "灰色": "серый", "红色": "красный", "蓝色": "синий",
  "ホワイト": "белый", "ブラック": "чёрный", "シルバー": "серебристый", "グレー": "серый", "レッド": "красный", "ブルー": "синий",
}
const IMPORT_LOCATION_LABELS: Readonly<Record<string, string>> = {
  seoul: "Сеул", busan: "Пусан", incheon: "Инчхон", daegu: "Тэгу", daejeon: "Тэджон",
  beijing: "Пекин", shanghai: "Шанхай", guangzhou: "Гуанчжоу", shenzhen: "Шэньчжэнь", tianjin: "Тяньцзинь", chongqing: "Чунцин",
  tokyo: "Токио", osaka: "Осака", yokohama: "Иокогама", nagoya: "Нагоя", kobe: "Кобе",
}
const IMPORT_COUNTRY_LABELS: Readonly<Record<string, string>> = {
  KR: "Корея", CN: "Китай", JP: "Япония", US: "США", DE: "Германия", EU: "Европа", AE: "ОАЭ",
}

async function localizeImportedDisplayValue(value: string | null, field: "color" | "location", country: string) {
  const source = value?.trim()
  if (!source) return null
  if (CYRILLIC_TEXT.test(source) && !/[\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF]/.test(source)) return source

  const known = field === "color"
    ? IMPORT_COLOR_LABELS[source.toLocaleLowerCase("en-US")]
    : IMPORT_LOCATION_LABELS[source.toLocaleLowerCase("en-US")]
  if (known) return known
  if (!FOREIGN_DISPLAY_TEXT.test(source)) return source

  const translated = (await translateToRussian(source)).trim()
  if (translated && CYRILLIC_TEXT.test(translated) && !/[\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF]/.test(translated)) return translated

  // Never publish an untranslated source string in a Russian customer card.
  // The original listing remains available through sourceUrl for verification.
  return field === "location" ? `${IMPORT_COUNTRY_LABELS[country] || country} — точный адрес у источника` : null
}

export type AuctionEquipmentItem = {
  label: string
  available: boolean
}

export type AuctionEquipmentSnapshot = {
  totalReported: number | null
  items: AuctionEquipmentItem[]
}

export type AuctionConditionInfo = {
  insuranceRecordCount: number | null
  inspectionSummary: string | null
  newCarPriceRatioPct: number | null
  verifiedItems: AuctionConditionCheck[]
}

export type AuctionConditionCheck = {
  label: string
  status: string
}

export type AuctionImportItem = {
  source: string
  sourceId: string
  sourceUrl: string
  make: string
  model: string
  year: number
  manufacturedMonth?: string | null
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
  equipment?: AuctionEquipmentSnapshot | null
  conditionInfo?: AuctionConditionInfo | null
  location: string | null
}

export async function saveAuctionImportItems(items: AuctionImportItem[]) {
  const exchangeRates = await getAuctionExchangeRates()
  let created = 0
  let updated = 0
  let translated = 0

  for (const item of items) {
    const engineVolume = normalizeAuctionEngineVolumeCc(item.engineVolume, item.fuelType)
    const [displayColor, displayLocation] = await Promise.all([
      localizeImportedDisplayValue(item.color, "color", item.country),
      localizeImportedDisplayValue(item.location, "location", item.country),
    ])
    const existing = await prisma.auctionListing.findUnique({
      where: { source_sourceId: { source: item.source, sourceId: String(item.sourceId) } },
    }).catch(() => null)

    if (existing) {
      const sourceTextChanged = item.descriptionOrig !== existing.descriptionOrig || item.specsOrig !== existing.specsOrig
      const needsTranslationRefresh = sourceTextChanged || hasUntranslatedForeignText(existing.descriptionOrig, existing.descriptionRu) || hasUntranslatedForeignText(existing.specsOrig, existing.specsRu)
      let translatedFields: { descriptionRu: string | null; specsRu: string | null } | null = null
      if (needsTranslationRefresh && (item.descriptionOrig || item.specsOrig)) {
        try {
          translatedFields = await translateListingFields({ description: item.descriptionOrig, specs: item.specsOrig })
        } catch {
          // A translation failure must not prevent the source inventory refresh.
        }
      }
      const hasTranslation = hasUsableTranslation(item.descriptionOrig, translatedFields?.descriptionRu || null) || hasUsableTranslation(item.specsOrig, translatedFields?.specsRu || null)
      if (hasTranslation) translated++

      const exchangeRate = getAuctionRateToRub(item.sourceCurrency, exchangeRates)
      const price = calculateAuctionRubPricing(item.sourcePrice, exchangeRate, existing.markup)
      await prisma.auctionListing.update({
        where: { id: existing.id },
        data: {
          sourceUrl: item.sourceUrl,
          make: item.make,
          model: item.model,
          year: item.year,
          manufacturedMonth: item.manufacturedMonth || null,
          mileage: item.mileage,
          fuelType: item.fuelType,
          transmission: item.transmission,
          bodyType: item.bodyType,
          color: displayColor,
          engineVolume,
          power: item.power,
          driveType: item.driveType,
          vin: item.vin,
          lotNumber: item.lotNumber,
          imageUrl: item.imageUrl,
          images: item.images ? JSON.stringify(item.images) : null,
          descriptionOrig: item.descriptionOrig,
          specsOrig: item.specsOrig,
          ...(item.equipment !== undefined ? { equipment: item.equipment ? JSON.stringify(item.equipment) : null } : {}),
          ...(item.conditionInfo !== undefined ? { conditionInfo: item.conditionInfo ? JSON.stringify(item.conditionInfo) : null } : {}),
          ...(translatedFields ? {
            descriptionRu: translatedFields.descriptionRu,
            specsRu: translatedFields.specsRu,
            isTranslated: hasTranslation,
            translatedAt: hasTranslation ? new Date() : null,
          } : {}),
          location: displayLocation,
          sourcePrice: item.sourcePrice,
          sourceCurrency: item.sourceCurrency,
          priceRub: price.priceRub,
          finalPrice: price.finalPrice,
          exchangeRate,
          pricingUpdatedAt: new Date(),
          lastChecked: new Date(),
          sourceLastSeenAt: new Date(),
          sourceMissingChecks: 0,
          status: "ACTIVE",
          auctionDate: item.auctionDate,
        },
      })
      updated++
      continue
    }

    const exchangeRate = getAuctionRateToRub(item.sourceCurrency, exchangeRates)
    const basePriceRub = Math.max(0, Math.round(item.sourcePrice * exchangeRate))
    const markup = estimatedAuctionServiceFee(basePriceRub)
    const price = calculateAuctionRubPricing(item.sourcePrice, exchangeRate, markup)

    let descriptionRu: string | null = null
    let specsRu: string | null = null
    if (item.descriptionOrig || item.specsOrig) {
      try {
        const translatedFields = await translateListingFields({ description: item.descriptionOrig, specs: item.specsOrig })
        descriptionRu = translatedFields.descriptionRu
        specsRu = translatedFields.specsRu
        if (hasUsableTranslation(item.descriptionOrig, descriptionRu) || hasUsableTranslation(item.specsOrig, specsRu)) translated++
      } catch {
        // The source listing is still useful without an automated translation.
      }
    }

    await prisma.auctionListing.create({
      data: {
        sourceId: String(item.sourceId), source: item.source, sourceUrl: item.sourceUrl,
        make: item.make, model: item.model, year: item.year, manufacturedMonth: item.manufacturedMonth || null,
        mileage: item.mileage || null, fuelType: item.fuelType || null,
        transmission: item.transmission || null, bodyType: item.bodyType || null,
        color: displayColor, engineVolume,
        power: item.power || null, driveType: item.driveType || null,
        vin: item.vin || null, lotNumber: item.lotNumber || null,
        sourcePrice: item.sourcePrice, sourceCurrency: item.sourceCurrency,
        priceRub: price.priceRub, markup, finalPrice: price.finalPrice,
        exchangeRate, pricingUpdatedAt: new Date(),
        imageUrl: item.imageUrl || null,
        images: item.images ? JSON.stringify(item.images) : null,
        descriptionOrig: item.descriptionOrig || null, specsOrig: item.specsOrig || null, descriptionRu, specsRu,
        equipment: item.equipment ? JSON.stringify(item.equipment) : null,
        conditionInfo: item.conditionInfo ? JSON.stringify(item.conditionInfo) : null,
        country: item.country,
        auctionDate: item.auctionDate,
        location: displayLocation,
        sourceLastSeenAt: new Date(),
        sourceMissingChecks: 0,
        isTranslated: hasUsableTranslation(item.descriptionOrig, descriptionRu) || hasUsableTranslation(item.specsOrig, specsRu),
        translatedAt: hasUsableTranslation(item.descriptionOrig, descriptionRu) || hasUsableTranslation(item.specsOrig, specsRu) ? new Date() : null,
      },
    })
    created++
  }

  return { created, updated, translated }
}
