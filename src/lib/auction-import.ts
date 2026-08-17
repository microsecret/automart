import { prisma } from "@/lib/prisma"
import { translateListingFields, translateToRussian } from "@/lib/nvidia-translate"
import { calculateAuctionRubPricing, getAuctionExchangeRates, getAuctionRateToRub } from "@/lib/exchange-rates"
import { estimatedAuctionServiceFee } from "@/lib/auction-service-fee"
import { auctionVehicleIdentity, normalizeAuctionEngineVolumeCc } from "@/lib/auction-normalization"
import type { AuctionDamageReport } from "@/lib/auction-damage"
import { serializeAuctionSourceSpecs } from "@/lib/auction-source-details"
import { auctionPriceStorageError } from "@/lib/auction-price-guard"
import { createQualityHoldReason, evaluateAuctionImportItemQuality, isQualityHoldReason } from "@/lib/auction-quality"

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
  "白": "белый", "黒": "чёрный", "銀": "серебристый", "灰": "серый", "赤": "красный", "青": "синий",
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
  damageReport?: AuctionDamageReport | null
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

export type AuctionImportSaveResult = {
  created: number
  updated: number
  translated: number
  qualityHold: number
  qualityRestored: number
}

export async function saveAuctionImportItems(items: AuctionImportItem[]) {
  const exchangeRates = await getAuctionExchangeRates()
  let created = 0
  let updated = 0
  let translated = 0
  let qualityHold = 0
  let qualityRestored = 0

  for (const item of items) {
    const identity = auctionVehicleIdentity(item.make, item.model)
    const engineVolume = normalizeAuctionEngineVolumeCc(item.engineVolume, item.fuelType)
    const [displayColor, displayLocation] = await Promise.all([
      localizeImportedDisplayValue(item.color, "color", item.country),
      localizeImportedDisplayValue(item.location, "location", item.country),
    ])
    const existing = await prisma.auctionListing.findUnique({
      where: { source_sourceId: { source: item.source, sourceId: String(item.sourceId) } },
      select: {
        id: true,
        status: true,
        adminHiddenAt: true,
        adminHiddenReason: true,
        markup: true,
        descriptionOrig: true,
        descriptionRu: true,
        specsOrig: true,
        specsRu: true,
      },
    }).catch(() => null)
    const qualityAssessment = evaluateAuctionImportItemQuality(item)
    const isQualityHold = qualityAssessment.anomalies.length > 0
    const qualityReason = isQualityHold ? createQualityHoldReason(qualityAssessment.anomalies) : null

    const exchangeRate = getAuctionRateToRub(item.sourceCurrency, exchangeRates)
    const priceStorageError = auctionPriceStorageError({ sourcePrice: item.sourcePrice, exchangeRate, markup: existing?.markup || 0 })
    if (priceStorageError) {
      console.warn(`Auction ${item.source}/${item.sourceId} skipped: ${priceStorageError}`)
      continue
    }

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

      const specsRu = serializeAuctionSourceSpecs({
        sourceId: item.sourceId,
        year: item.year,
        manufacturedMonth: item.manufacturedMonth,
        mileage: item.mileage,
        lotNumber: item.lotNumber,
        sourcePrice: item.sourcePrice,
        sourceCurrency: item.sourceCurrency,
        engineVolume,
        power: item.power,
        fuelType: item.fuelType,
        transmission: item.transmission,
        bodyType: item.bodyType,
        driveType: item.driveType,
        color: displayColor,
        vin: item.vin,
        location: displayLocation,
        conditionInfo: item.conditionInfo,
      }, translatedFields?.specsRu || existing.specsRu)

      const price = calculateAuctionRubPricing(item.sourcePrice, exchangeRate, existing.markup)
      await prisma.auctionListing.update({
        where: { id: existing.id },
        data: {
          sourceUrl: item.sourceUrl,
          make: identity.make,
          model: identity.model,
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
            isTranslated: hasTranslation,
            translatedAt: hasTranslation ? new Date() : null,
          } : {}),
          specsRu,
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
          // Ручное решение администратора сильнее автопроверки: коллектор
          // возвращает лот в выдачу только если сам его и скрыл.
          ...(isQualityHold
            ? { adminHiddenAt: existing.adminHiddenAt || new Date(), adminHiddenReason: qualityReason }
            : isQualityHoldReason(existing.adminHiddenReason)
              ? { adminHiddenAt: null, adminHiddenReason: null }
              : {}),
          ...(existing.adminHiddenAt && !isQualityHold && !isQualityHoldReason(existing.adminHiddenReason)
            ? {}
            : { status: "ACTIVE" }),
          auctionDate: item.auctionDate,
        },
      })
      if (isQualityHold && !existing.adminHiddenAt) qualityHold++
      if (!isQualityHold && isQualityHoldReason(existing.adminHiddenReason)) qualityRestored++
      updated++
      continue
    }

    const basePriceRub = Math.max(0, Math.round(item.sourcePrice * exchangeRate))
    const markup = estimatedAuctionServiceFee(basePriceRub)
    const priceWithMarkupError = auctionPriceStorageError({ sourcePrice: item.sourcePrice, exchangeRate, markup })
    if (priceWithMarkupError) {
      console.warn(`Auction ${item.source}/${item.sourceId} skipped: ${priceWithMarkupError}`)
      continue
    }
    const price = calculateAuctionRubPricing(item.sourcePrice, exchangeRate, markup)

    let descriptionRu: string | null = null
    let translatedSpecsRu: string | null = null
    if (item.descriptionOrig || item.specsOrig) {
      try {
        const translatedFields = await translateListingFields({ description: item.descriptionOrig, specs: item.specsOrig })
        descriptionRu = translatedFields.descriptionRu
        translatedSpecsRu = translatedFields.specsRu
        if (hasUsableTranslation(item.descriptionOrig, descriptionRu) || hasUsableTranslation(item.specsOrig, translatedSpecsRu)) translated++
      } catch {
        // The source listing is still useful without an automated translation.
      }
    }

    const specsRu = serializeAuctionSourceSpecs({
      sourceId: item.sourceId,
      year: item.year,
      manufacturedMonth: item.manufacturedMonth,
      mileage: item.mileage,
      lotNumber: item.lotNumber,
      sourcePrice: item.sourcePrice,
      sourceCurrency: item.sourceCurrency,
      engineVolume,
      power: item.power,
      fuelType: item.fuelType,
      transmission: item.transmission,
      bodyType: item.bodyType,
      driveType: item.driveType,
      color: displayColor,
      vin: item.vin,
      location: displayLocation,
      conditionInfo: item.conditionInfo,
    }, translatedSpecsRu)

    await prisma.auctionListing.create({
      data: {
        sourceId: String(item.sourceId), source: item.source, sourceUrl: item.sourceUrl,
        make: identity.make, model: identity.model, year: item.year, manufacturedMonth: item.manufacturedMonth || null,
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
        ...(isQualityHold ? { adminHiddenAt: new Date(), adminHiddenReason: qualityReason } : {}),
        isTranslated: hasUsableTranslation(item.descriptionOrig, descriptionRu) || hasUsableTranslation(item.specsOrig, translatedSpecsRu),
        translatedAt: hasUsableTranslation(item.descriptionOrig, descriptionRu) || hasUsableTranslation(item.specsOrig, translatedSpecsRu) ? new Date() : null,
      },
    })
    if (isQualityHold) qualityHold++
    created++
  }

  return { created, updated, translated, qualityHold, qualityRestored } satisfies AuctionImportSaveResult
}
