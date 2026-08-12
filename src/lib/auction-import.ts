import { prisma } from "@/lib/prisma"
import { translateListingFields } from "@/lib/nvidia-translate"
import { calculateAuctionRubPricing, getAuctionExchangeRates, getAuctionRateToRub } from "@/lib/exchange-rates"

export type AuctionImportItem = {
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

export async function saveAuctionImportItems(items: AuctionImportItem[]) {
  const exchangeRates = await getAuctionExchangeRates()
  let created = 0
  let updated = 0
  let translated = 0

  for (const item of items) {
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
          // A translation failure must not prevent the source inventory refresh.
        }
      }
      if (translatedFields?.descriptionRu || translatedFields?.specsRu) translated++

      const exchangeRate = getAuctionRateToRub(item.sourceCurrency, exchangeRates)
      const price = calculateAuctionRubPricing(item.sourcePrice, exchangeRate, existing.markup)
      await prisma.auctionListing.update({
        where: { id: existing.id },
        data: {
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
        },
      })
      updated++
      continue
    }

    const exchangeRate = getAuctionRateToRub(item.sourceCurrency, exchangeRates)
    const basePriceRub = Math.max(0, Math.round(item.sourcePrice * exchangeRate))
    const markup = basePriceRub > 2_000_000 ? 150_000 : 80_000
    const price = calculateAuctionRubPricing(item.sourcePrice, exchangeRate, markup)

    let descriptionRu: string | null = null
    let specsRu: string | null = null
    if (item.descriptionOrig || item.specsOrig) {
      try {
        const translatedFields = await translateListingFields({ description: item.descriptionOrig, specs: item.specsOrig })
        descriptionRu = translatedFields.descriptionRu
        specsRu = translatedFields.specsRu
        if (descriptionRu || specsRu) translated++
      } catch {
        // The source listing is still useful without an automated translation.
      }
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

  return { created, updated, translated }
}
