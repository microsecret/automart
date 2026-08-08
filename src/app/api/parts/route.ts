import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

/** GET /api/parts — листинг запчастей с фильтрами */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams
    const page = parseInt(sp.get("page") || "1")
    const limit = parseInt(sp.get("limit") || "20")
    const skip = (page - 1) * limit

    const q = sp.get("q")?.trim()
    const partType = sp.get("partType")
    const subcategory = sp.get("subcategory")
    const make = sp.get("make")
    const model = sp.get("model")
    const priceFrom = sp.get("priceFrom")
    const priceTo = sp.get("priceTo")
    const condition = sp.get("condition")
    const oemNumber = sp.get("oemNumber")
    const sort = sp.get("sort") || "newest"

    const where: any = {}

    if (q) {
      where.OR = [
        { name: { contains: q } },
        { description: { contains: q } },
        { keywords: { contains: q } },
      ]
    }
    if (partType) where.partType = partType
    if (subcategory) where.subcategory = { contains: subcategory }
    if (make) where.make = { contains: make }
    if (model) where.model = { contains: model }
    if (condition) where.condition = condition
    if (oemNumber) where.oemNumber = { contains: oemNumber }
    if (priceFrom || priceTo) {
      where.price = {}
      if (priceFrom) where.price.gte = parseInt(priceFrom)
      if (priceTo) where.price.lte = parseInt(priceTo)
    }

    // Если есть make+model — ищем также через PartCompatibility
    if (make && sp.get("compatible") === "true") {
      where.OR = [
        ...(where.OR || []),
        { compatibility: { some: { make: { contains: make }, ...(model ? { model: { contains: model } } : {}) } } },
      ]
    }

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
    const body = await request.json()
    const { name, description, price, condition, partType, make, model, yearFrom, yearTo, location, images, subcategory, oemNumber, suspensionType, brakeType, compatibility } = body

    if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 })
    if (price == null || price < 0) return NextResponse.json({ error: "Price required" }, { status: 400 })

    const part = await prisma.part.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        price: parseInt(price),
        condition: condition || "USED",
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
      },
      include: { compatibility: true },
    })

    return NextResponse.json(part, { status: 201 })
  } catch (error) {
    console.error("Parts POST error:", error)
    return NextResponse.json({ error: "Failed to create part" }, { status: 500 })
  }
}
