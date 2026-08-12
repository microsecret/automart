import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { auctionSourceCountry, isAuctionSource } from "@/lib/auction-sources"
import { AUCTION_BODY_TYPES } from "@/lib/auction-normalization"
import { resolveMaximumImportAgeYears } from "@/lib/import-age-policy"

export const dynamic = "force-dynamic"

const VALID_COUNTRIES = new Set(["JP", "KR", "CN", "US", "DE"])
const VALID_BODY_TYPES = new Set<string>(AUCTION_BODY_TYPES)

/**
 * The public navigation used the human-facing "EU" alias before auctions
 * adopted ISO country codes. Keep old bookmarks working, but use one
 * canonical value for validation and filtering below.
 */
function normalizeCountry(value: string | null) {
  return value === "EU" ? "DE" : value
}

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams
    const page = Math.max(1, Number.parseInt(sp.get("page") || "1", 10) || 1)
    const limit = Math.min(50, Math.max(1, Number.parseInt(sp.get("limit") || "20", 10) || 20))
    const skip = (page - 1) * limit

    const where: Prisma.AuctionListingWhereInput = {
      status: "ACTIVE",
      OR: [{ auctionDate: null }, { auctionDate: { gte: new Date() } }],
    }
    const country = normalizeCountry(sp.get("country"))
    const source = sp.get("source")
    const make = sp.get("make")
    const priceFrom = sp.get("priceFrom")
    const priceTo = sp.get("priceTo")
    const yearFrom = sp.get("yearFrom")
    const maxImportAgeYears = resolveMaximumImportAgeYears(undefined)
    // The parser excludes over-age lots on import, but the public read path
    // must enforce the same catalogue policy too. This keeps an old record
    // from becoming visible if it originated from a different importer.
    const minimumImportYear = new Date().getFullYear() - maxImportAgeYears
    const earliestBoundaryMonth = `${minimumImportYear}-${String(new Date().getMonth() + 1).padStart(2, "0")}`

    if (country && !VALID_COUNTRIES.has(country)) return NextResponse.json({ error: "Некорректная страна" }, { status: 400 })
    if (source && !isAuctionSource(source)) return NextResponse.json({ error: "Некорректная площадка" }, { status: 400 })
    if (country && source && auctionSourceCountry(source) !== country) return NextResponse.json({ error: "Площадка не относится к выбранной стране" }, { status: 400 })
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
    let requestedYearFrom: number | undefined
    if (yearFrom) {
      const parsedYear = Number.parseInt(yearFrom, 10)
      if (!Number.isInteger(parsedYear) || parsedYear < 1886 || parsedYear > new Date().getFullYear() + 1) return NextResponse.json({ error: "Некорректный год" }, { status: 400 })
      requestedYearFrom = parsedYear
    }
    where.year = { gte: Math.max(minimumImportYear, requestedYearFrom ?? minimumImportYear) }
    // `manufacturedMonth` is optional. A record without a precise month stays
    // in the boundary year and is explicitly marked for documentary review;
    // a record with a known older month is reliably excluded here.
    where.AND = [{
      OR: [
        { year: { gt: minimumImportYear } },
        { year: minimumImportYear, manufacturedMonth: null },
        { year: minimumImportYear, manufacturedMonth: { gte: earliestBoundaryMonth } },
      ],
    }]
    const bodyType = sp.get("bodyType")
    if (bodyType && !VALID_BODY_TYPES.has(bodyType)) return NextResponse.json({ error: "Некорректный тип кузова" }, { status: 400 })
    if (bodyType) where.bodyType = bodyType

    const [listings, total, aggregates, popularMakes, sourceDistribution, fuelDistribution, bodyDistribution, powerKnown, mileageKnown] = await prisma.$transaction([
      prisma.auctionListing.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.auctionListing.count({ where }),
      prisma.auctionListing.aggregate({
        where,
        _avg: { finalPrice: true, year: true, mileage: true },
        _min: { finalPrice: true },
        _max: { finalPrice: true },
      }),
      prisma.auctionListing.groupBy({
        by: ["make"],
        where,
        _count: true,
        orderBy: { _count: { make: "desc" } },
        take: 8,
      }),
      prisma.auctionListing.groupBy({
        by: ["source"],
        where,
        _count: true,
        orderBy: { _count: { source: "desc" } },
      }),
      prisma.auctionListing.groupBy({
        by: ["fuelType"],
        where,
        _count: true,
        orderBy: { _count: { fuelType: "desc" } },
      }),
      prisma.auctionListing.groupBy({
        by: ["bodyType"],
        where,
        _count: true,
        orderBy: { _count: { bodyType: "desc" } },
      }),
      prisma.auctionListing.count({ where: { ...where, power: { not: null } } }),
      prisma.auctionListing.count({ where: { ...where, mileage: { not: null } } }),
    ])

    // Average price is sensitive to premium lots. The median is an additional
    // factual reference for the active filters, calculated without guessing a
    // market price or using listings outside the current result set.
    const middleOffset = Math.floor(Math.max(0, total - 1) / 2)
    const medianRows = total > 0
      ? await prisma.auctionListing.findMany({
          where,
          orderBy: { finalPrice: "asc" },
          skip: middleOffset,
          take: total % 2 === 0 ? 2 : 1,
          select: { finalPrice: true },
        })
      : []
    const medianFinalPrice = medianRows.length
      ? Math.round(medianRows.reduce((sum, row) => sum + row.finalPrice, 0) / medianRows.length)
      : null

    return NextResponse.json({
      listings,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      importPolicy: {
        maxAgeYears: maxImportAgeYears,
        minimumYear: minimumImportYear,
        note: "Правило каталога для предварительного импорта; таможенную категорию и дату выпуска необходимо сверить по документам.",
      },
      analytics: {
        total,
        averageFinalPrice: aggregates._avg.finalPrice ? Math.round(aggregates._avg.finalPrice) : null,
        medianFinalPrice,
        minFinalPrice: aggregates._min.finalPrice,
        maxFinalPrice: aggregates._max.finalPrice,
        averageYear: aggregates._avg.year ? Math.round(aggregates._avg.year) : null,
        averageMileage: aggregates._avg.mileage ? Math.round(aggregates._avg.mileage) : null,
        powerKnown,
        mileageKnown,
        popularMakes: popularMakes.map((item) => ({ make: item.make, count: item._count })),
        sources: sourceDistribution.map((item) => ({ source: item.source, count: item._count })),
        fuelDistribution: fuelDistribution.flatMap((item) => item.fuelType ? [{ fuelType: item.fuelType, count: item._count }] : []),
        bodyDistribution: bodyDistribution.flatMap((item) => item.bodyType ? [{ bodyType: item.bodyType, count: item._count }] : []),
      },
    })
  } catch (error) {
    console.error("Auctions GET error:", error)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
