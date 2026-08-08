import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams
    const page = parseInt(sp.get("page") || "1")
    const limit = parseInt(sp.get("limit") || "20")
    const skip = (page - 1) * limit

    const where: any = { status: "ACTIVE" }
    const country = sp.get("country")
    const source = sp.get("source")
    const make = sp.get("make")
    const priceFrom = sp.get("priceFrom")
    const priceTo = sp.get("priceTo")
    const yearFrom = sp.get("yearFrom")

    if (country) where.country = country
    if (source) where.source = source
    if (make) where.make = { contains: make }
    if (priceFrom || priceTo) {
      where.finalPrice = {}
      if (priceFrom) where.finalPrice.gte = parseInt(priceFrom)
      if (priceTo) where.finalPrice.lte = parseInt(priceTo)
    }
    if (yearFrom) where.year = { gte: parseInt(yearFrom) }

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
