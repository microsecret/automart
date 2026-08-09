import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

const SOURCE_COUNTRY: Record<string, string> = {
  USS: "JP", TAA: "JP", EMARAAT: "KR", AJ: "KR", COPART: "US", IAAI: "US",
  MOBILE_DE: "DE", YCHEZHAI: "CN", GUAZI: "CN", TAOCHE: "CN", UCAR: "CN",
}

const VALID_COUNTRIES = new Set(["JP", "KR", "CN", "US", "DE"])
const VALID_BODY_TYPES = new Set(["SEDAN", "SUV", "HATCHBACK", "COUPE", "PICKUP", "WAGON"])

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams
    const page = Math.max(1, Number.parseInt(sp.get("page") || "1", 10) || 1)
    const limit = Math.min(50, Math.max(1, Number.parseInt(sp.get("limit") || "20", 10) || 20))
    const skip = (page - 1) * limit

    const where: any = {
      status: "ACTIVE",
      OR: [{ auctionDate: null }, { auctionDate: { gte: new Date() } }],
    }
    const country = sp.get("country")
    const source = sp.get("source")
    const make = sp.get("make")
    const priceFrom = sp.get("priceFrom")
    const priceTo = sp.get("priceTo")
    const yearFrom = sp.get("yearFrom")

    if (country && !VALID_COUNTRIES.has(country)) return NextResponse.json({ error: "Некорректная страна" }, { status: 400 })
    if (source && !SOURCE_COUNTRY[source]) return NextResponse.json({ error: "Некорректная площадка" }, { status: 400 })
    if (country && source && SOURCE_COUNTRY[source] !== country) return NextResponse.json({ error: "Площадка не относится к выбранной стране" }, { status: 400 })
    if (country) where.country = country
    if (source) where.source = source
    if (make) where.make = { contains: make }
    const minPrice = priceFrom ? Number.parseInt(priceFrom, 10) : undefined
    const maxPrice = priceTo ? Number.parseInt(priceTo, 10) : undefined
    if ((priceFrom && !Number.isFinite(minPrice)) || (priceTo && !Number.isFinite(maxPrice))) return NextResponse.json({ error: "Цена должна быть целым числом" }, { status: 400 })
    if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) return NextResponse.json({ error: "Цена от не может быть больше цены до" }, { status: 400 })
    if (priceFrom || priceTo) {
      where.finalPrice = {}
      if (minPrice !== undefined) where.finalPrice.gte = minPrice
      if (maxPrice !== undefined) where.finalPrice.lte = maxPrice
    }
    if (yearFrom) {
      const parsedYear = Number.parseInt(yearFrom, 10)
      if (!Number.isInteger(parsedYear) || parsedYear < 1886 || parsedYear > new Date().getFullYear() + 1) return NextResponse.json({ error: "Некорректный год" }, { status: 400 })
      where.year = { gte: parsedYear }
    }
    const bodyType = sp.get("bodyType")
    if (bodyType && !VALID_BODY_TYPES.has(bodyType)) return NextResponse.json({ error: "Некорректный тип кузова" }, { status: 400 })
    if (bodyType) where.bodyType = bodyType

    const [listings, total] = await prisma.$transaction([
      prisma.auctionListing.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.auctionListing.count({ where }),
    ])

    return NextResponse.json({
      listings,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error("Auctions GET error:", error)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
