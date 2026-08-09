import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { PART_TYPES } from "@/lib/constants"

export const dynamic = "force-dynamic"

const PART_TYPE_VALUES = new Set<string>(PART_TYPES.map((item) => item.value))

function normalizeOem(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9А-ЯЁ]/g, "")
}

/** GET /api/parts — листинг запчастей с фильтрами */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams
    const page = Math.max(1, Number.parseInt(sp.get("page") || "1", 10) || 1)
    const limit = Math.min(50, Math.max(1, Number.parseInt(sp.get("limit") || "20", 10) || 20))
    const skip = (page - 1) * limit

    const q = sp.get("q")?.trim()
    const partType = sp.get("partType")
    const subcategory = sp.get("subcategory")
    const make = sp.get("make")
    const model = sp.get("model")
    const priceFrom = sp.get("priceFrom")
    const priceTo = sp.get("priceTo")
    const condition = sp.get("condition")
    const saleFormat = sp.get("saleFormat")
    const oemNumber = sp.get("oemNumber")
    const sort = sp.get("sort") || "newest"

    const where: Prisma.PartWhereInput = {}
    const and: Prisma.PartWhereInput[] = []

    const minPrice = priceFrom ? Number.parseInt(priceFrom, 10) : undefined
    const maxPrice = priceTo ? Number.parseInt(priceTo, 10) : undefined
    if ((priceFrom && !Number.isFinite(minPrice)) || (priceTo && !Number.isFinite(maxPrice))) {
      return NextResponse.json({ error: "Цена должна быть целым числом" }, { status: 400 })
    }
    if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
      return NextResponse.json({ error: "Цена от не может быть больше цены до" }, { status: 400 })
    }
    if (partType && !PART_TYPE_VALUES.has(partType)) {
      return NextResponse.json({ error: "Неизвестная категория запчасти" }, { status: 400 })
    }

    if (q) {
      const normalizedQuery = normalizeOem(q)
      and.push({
        OR: [
          { name: { contains: q } },
          { description: { contains: q } },
          { keywords: { contains: q } },
          { oemNumber: { contains: q } },
          ...(normalizedQuery ? [{ crossReferences: { some: { normalizedNumber: { contains: normalizedQuery } } } }] : []),
          { compatibility: { some: { OR: [{ make: { contains: q } }, { model: { contains: q } }] } } },
        ],
      })
    }
    if (partType) where.partType = partType
    if (subcategory) where.subcategory = { contains: subcategory }
    if (make && sp.get("compatible") === "true") {
      and.push({
        OR: [
          { make: { contains: make }, ...(model ? { model: { contains: model } } : {}) },
          { compatibility: { some: { make: { contains: make }, ...(model ? { model: { contains: model } } : {}) } } },
        ],
      })
    } else {
      if (make) where.make = { contains: make }
      if (model) where.model = { contains: model }
    }
    if (condition) where.condition = condition
    if (saleFormat === "FIXED" || saleFormat === "AUCTION") where.saleFormat = saleFormat
    if (oemNumber) {
      const normalizedOem = normalizeOem(oemNumber)
      and.push({ OR: [
        { oemNumber: { contains: oemNumber } },
        ...(normalizedOem ? [{ crossReferences: { some: { normalizedNumber: { contains: normalizedOem } } } }] : []),
      ] })
    }
    if (priceFrom || priceTo) {
      where.price = {}
      if (minPrice !== undefined) where.price.gte = minPrice
      if (maxPrice !== undefined) where.price.lte = maxPrice
    }

    if (and.length) where.AND = and

    const orderBy: any =
      sort === "price_asc" ? { price: "asc" }
      : sort === "price_desc" ? { price: "desc" }
      : { createdAt: "desc" }

    const [parts, total] = await prisma.$transaction([
      prisma.part.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          compatibility: { select: { id: true, make: true, model: true, generation: true, yearFrom: true, yearTo: true } },
        },
      }),
      prisma.part.count({ where }),
    ])

    return NextResponse.json({
      parts,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error("Parts GET error:", error)
    return NextResponse.json({ error: "Failed to fetch parts" }, { status: 500 })
  }
}

/** POST /api/parts — создать запчасть с совместимостью */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const { name, description, price, condition, partType, make, model, yearFrom, yearTo, location, images, subcategory, oemNumber, crossNumbers, suspensionType, brakeType, compatibility, sellerType, availability, saleFormat, auctionEndsAt, auctionStartPrice, auctionMinStep } = body

    if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 })
    if (price == null || price < 0) return NextResponse.json({ error: "Price required" }, { status: 400 })
    if (partType && !PART_TYPE_VALUES.has(partType)) return NextResponse.json({ error: "Неизвестная категория запчасти" }, { status: 400 })

    const normalizedCrossNumbers = Array.from(new Set((Array.isArray(crossNumbers) ? crossNumbers : [])
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter(Boolean)
      .slice(0, 40)))

    const normalizedSaleFormat = saleFormat === "AUCTION" ? "AUCTION" : "FIXED"
    const parsedEnd = auctionEndsAt ? new Date(auctionEndsAt) : null
    if (normalizedSaleFormat === "AUCTION" && (!parsedEnd || Number.isNaN(parsedEnd.getTime()) || parsedEnd <= new Date())) {
      return NextResponse.json({ error: "Для аукциона укажите дату окончания в будущем" }, { status: 400 })
    }
    const normalizedPrice = Math.trunc(Number(price))
    const startPrice = normalizedSaleFormat === "AUCTION" ? Math.max(1, Math.trunc(Number(auctionStartPrice || price))) : null
    const minStep = normalizedSaleFormat === "AUCTION" ? Math.max(1, Math.trunc(Number(auctionMinStep || Math.max(100, normalizedPrice * 0.01)))) : null

    const part = await prisma.part.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        price: normalizedSaleFormat === "AUCTION" ? startPrice! : normalizedPrice,
        condition: condition || "USED",
        sellerType: sellerType || "OWNER",
        availability: availability || "IN_STOCK",
        saleFormat: normalizedSaleFormat,
        auctionStatus: normalizedSaleFormat === "AUCTION" ? "ACTIVE" : "NONE",
        auctionEndsAt: normalizedSaleFormat === "AUCTION" ? parsedEnd : null,
        auctionStartPrice: startPrice,
        auctionCurrentPrice: startPrice,
        auctionMinStep: minStep,
        partType: partType || "OTHER",
        make: make || "Universal",
        model: model || "Universal",
        yearFrom: yearFrom ? parseInt(yearFrom) : null,
        yearTo: yearTo ? parseInt(yearTo) : null,
        location: location || "Москва",
        images: images || null,
        subcategory: subcategory || null,
        oemNumber: oemNumber || null,
        suspensionType: suspensionType || null,
        brakeType: brakeType || null,
        crossReferences: normalizedCrossNumbers.length > 0 ? {
          create: normalizedCrossNumbers.map((number) => ({ number, normalizedNumber: normalizeOem(number) })),
        } : undefined,
        compatibility: compatibility?.length > 0 ? {
          create: compatibility.map((c: any) => ({
            make: c.make,
            model: c.model,
            generation: c.generation || null,
            yearFrom: c.yearFrom ? parseInt(c.yearFrom) : null,
            yearTo: c.yearTo ? parseInt(c.yearTo) : null,
            engine: c.engine || null,
            note: c.note || null,
          }))
        } : undefined,
        userId: session.user.id,
      },
      include: { compatibility: true, crossReferences: true },
    })

    return NextResponse.json(part, { status: 201 })
  } catch (error) {
    console.error("Parts POST error:", error)
    return NextResponse.json({ error: "Failed to create part" }, { status: 500 })
  }
}
