import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { translateListingFields } from "@/lib/nvidia-translate"

export const dynamic = "force-dynamic"

const PARSER_TOKEN = process.env.PARSER_TOKEN

const RATES: Record<string, number> = { JPY: 0.62, KRW: 0.072, USD: 95, EUR: 102, CNY: 13.2 }

export async function POST(request: NextRequest) {
  try {
    if (!PARSER_TOKEN) {
      console.error("PARSER_TOKEN is not configured")
      return NextResponse.json({ error: "Auction import is not configured" }, { status: 503 })
    }
    const token = request.headers.get("authorization")?.replace("Bearer ", "")
    if (token !== PARSER_TOKEN) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { items } = await request.json() as { items: any[] }
    if (!Array.isArray(items)) return NextResponse.json({ error: "items array required" }, { status: 400 })

    let created = 0, updated = 0, translated = 0

    for (const item of items) {
      const existing = await prisma.auctionListing.findUnique({
        where: { source_sourceId: { source: item.source, sourceId: String(item.sourceId) } },
      }).catch(() => null)

      if (existing) {
        await prisma.auctionListing.update({
          where: { id: existing.id },
          data: { sourcePrice: item.sourcePrice || existing.sourcePrice, lastChecked: new Date() },
        })
        updated++
        continue
      }

      const rate = RATES[item.sourceCurrency] || 1
      const priceRub = Math.round((item.sourcePrice || 0) * rate)
      const markup = priceRub > 2000000 ? 150000 : 80000

      let descriptionRu: string | null = null
      let specsRu: string | null = null
      if (item.descriptionOrig) {
        try {
          const tr = await translateListingFields({ description: item.descriptionOrig, specs: item.specsOrig })
          descriptionRu = tr.descriptionRu
          specsRu = tr.specsRu
          translated++
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
          sourcePrice: item.sourcePrice, sourceCurrency: item.sourceCurrency || "USD",
          priceRub, markup, finalPrice: priceRub + markup,
          imageUrl: item.imageUrl || null,
          images: item.images ? JSON.stringify(item.images) : null,
          descriptionOrig: item.descriptionOrig || null, descriptionRu, specsRu,
          country: item.country,
          auctionDate: item.auctionDate ? new Date(item.auctionDate) : null,
          location: item.location || null,
          isTranslated: !!descriptionRu, translatedAt: descriptionRu ? new Date() : null,
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
