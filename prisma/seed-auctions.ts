import { PrismaClient } from "@prisma/client"
import items from "./seed-auctions.json"

const prisma = new PrismaClient()
const RATES: Record<string, number> = { JPY: 0.62, KRW: 0.072, USD: 95, EUR: 102, CNY: 13.2 }

async function main() {
  if (process.env.ALLOW_DEMO_SEED !== "true") {
    throw new Error("Demo auction fixtures are disabled. Use real importer data; set ALLOW_DEMO_SEED=true only in an isolated development database.")
  }

  let created = 0
  for (const item of items) {
    const existing = await prisma.auctionListing.findUnique({
      where: { source_sourceId: { source: item.source, sourceId: item.sourceId } },
    }).catch(() => null)
    if (existing) continue

    const rate = RATES[item.sourceCurrency] || 1
    const priceRub = Math.round(item.sourcePrice * rate)
    const markup = priceRub > 2000000 ? 150000 : 80000

    await prisma.auctionListing.create({
      data: {
        sourceId: item.sourceId, source: item.source, sourceUrl: item.sourceUrl,
        make: item.make, model: item.model, year: item.year,
        mileage: item.mileage || null, fuelType: item.fuelType || null,
        transmission: item.transmission || null, bodyType: item.bodyType || null,
        color: item.color || null, engineVolume: item.engineVolume || null,
        power: item.power || null,
        driveType: "driveType" in item && typeof item.driveType === "string" ? item.driveType : null,
        lotNumber: item.lotNumber || null,
        sourcePrice: item.sourcePrice, sourceCurrency: item.sourceCurrency,
        priceRub, markup, finalPrice: priceRub + markup,
        imageUrl: item.imageUrl || null,
        descriptionOrig: item.descriptionOrig || null,
        descriptionRu: item.descriptionOrig || null, // skip NVIDIA for seed
        specsRu: null,
        country: item.country,
        auctionDate: item.auctionDate ? new Date(item.auctionDate) : null,
        location: item.location || null,
        isTranslated: true, translatedAt: new Date(),
      },
    })
    created++
  }
  console.log("Created " + created + " auction listings")
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
