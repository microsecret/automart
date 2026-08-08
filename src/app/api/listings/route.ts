import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "../auth/[...nextauth]/route"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"

export const dynamic = "force-dynamic"

/** GET /api/listings — список объявлений с фильтрами и пагинацией */
export async function GET(request: NextRequest) {
  try {
    const sp = new URL(request.url).searchParams
    const page = Math.max(1, parseInt(sp.get("page") || "1"))
    const limit = Math.min(50, Math.max(1, parseInt(sp.get("limit") || "12")))
    const skip = (page - 1) * limit

    const type = sp.get("type") // "vehicle" | "part" | undefined (оба)
    const q = sp.get("q")?.trim()
    const priceFrom = sp.get("priceFrom")
    const priceTo = sp.get("priceTo")
    const city = sp.get("city")?.trim()
    const sort = sp.get("sort") || "newest"

    // Фильтры ТС
    const make = sp.get("make")
    const model = sp.get("model")
    const yearFrom = sp.get("yearFrom")
    const yearTo = sp.get("yearTo")
    const fuelType = sp.get("fuelType")
    const transmission = sp.get("transmission")
    const bodyType = sp.get("bodyType")
    const driveType = sp.get("driveType")
    const engineVolumeFrom = sp.get("engineVolumeFrom")
    const engineVolumeTo = sp.get("engineVolumeTo")
    const powerFrom = sp.get("powerFrom")
    const powerTo = sp.get("powerTo")
    const color = sp.get("color")
    const condition = sp.get("condition")
    const vehicleType = sp.get("vehicleType") // CAR, MOTORCYCLE, TRUCK, SPECIAL, WATER, AIR

    // Фильтры запчастей
    const partType = sp.get("partType")
    const partCondition = sp.get("partCondition")

    const where: Prisma.ListingWhereInput = {}

    if (type === "vehicle") {
      where.vehicleId = { not: null }
    } else if (type === "part") {
      where.partId = { not: null }
    }

    // Фильтр по типу транспорта (категории) — аккумулируем в vehicleFilters
    const vehicleFilters: Prisma.VehicleWhereInput = {}
    if (vehicleType) vehicleFilters.vehicleType = vehicleType

    if (priceFrom || priceTo) {
      where.price = {}
      if (priceFrom) where.price.gte = parseInt(priceFrom)
      if (priceTo) where.price.lte = parseInt(priceTo)
    }

    if (q) {
      where.OR = [
        { title: { contains: q } },
        { description: { contains: q } },
      ]
    }

    if (make) vehicleFilters.make = { contains: make }
    if (model) vehicleFilters.model = { contains: model }
    if (yearFrom || yearTo) {
      vehicleFilters.year = {}
      if (yearFrom) vehicleFilters.year.gte = parseInt(yearFrom)
      if (yearTo) vehicleFilters.year.lte = parseInt(yearTo)
    }
    if (fuelType) vehicleFilters.fuelType = fuelType
    if (transmission) vehicleFilters.transmission = transmission
    if (bodyType) vehicleFilters.bodyType = bodyType
    if (driveType) vehicleFilters.driveType = driveType
    if (color) vehicleFilters.color = { contains: color }
    if (condition) vehicleFilters.condition = condition
    if (engineVolumeFrom || engineVolumeTo) {
      vehicleFilters.engineVolume = {}
      if (engineVolumeFrom) vehicleFilters.engineVolume.gte = parseFloat(engineVolumeFrom)
      if (engineVolumeTo) vehicleFilters.engineVolume.lte = parseFloat(engineVolumeTo)
    }
    if (powerFrom || powerTo) {
      vehicleFilters.power = {}
      if (powerFrom) vehicleFilters.power.gte = parseInt(powerFrom)
      if (powerTo) vehicleFilters.power.lte = parseInt(powerTo)
    }
    if (city) vehicleFilters.location = { contains: city }
    if (Object.keys(vehicleFilters).length > 0) {
      where.vehicle = vehicleFilters
    }

    const partFilters: Prisma.PartWhereInput = {}
    if (partType) partFilters.partType = partType
    if (partCondition) partFilters.condition = partCondition
    if (city) partFilters.location = { contains: city }
    if (Object.keys(partFilters).length > 0) {
      where.part = partFilters
    }

    const orderBy: Prisma.ListingOrderByWithRelationInput =
      sort === "price_asc" ? { price: "asc" }
      : sort === "price_desc" ? { price: "desc" }
      : sort === "oldest" ? { createdAt: "asc" }
      : sort === "year_desc" ? { vehicle: { year: "desc" } }
      : sort === "mileage_asc" ? { vehicle: { mileage: "asc" } }
      : { createdAt: "desc" }

    const [listings, total] = await prisma.$transaction([
      prisma.listing.findMany({
        where,
        skip,
        take: limit,
        include: {
          vehicle: true,
          part: true,
          user: { select: { id: true, name: true, image: true } },
        },
        orderBy,
      }),
      prisma.listing.count({ where }),
    ])

    return NextResponse.json({
      listings,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error("Error fetching listings:", error)
    return NextResponse.json({ error: "Failed to fetch listings" }, { status: 500 })
  }
}

/** POST /api/listings — создать объявление */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { title, description, price, vehicleId, partId } = body

    if ((vehicleId && partId) || (!vehicleId && !partId)) {
      return NextResponse.json(
        { error: "Укажите либо vehicleId, либо partId" },
        { status: 400 }
      )
    }
    if (!title?.trim()) {
      return NextResponse.json({ error: "Заголовок обязателен" }, { status: 400 })
    }
    if (price == null || price < 0) {
      return NextResponse.json({ error: "Цена обязательна" }, { status: 400 })
    }

    if (vehicleId) {
      const v = await prisma.vehicle.findUnique({ where: { id: vehicleId }, select: { id: true, userId: true } })
      if (!v) return NextResponse.json({ error: "ТС не найдено" }, { status: 404 })
      if (v.userId !== session.user.id) return NextResponse.json({ error: "Нет прав" }, { status: 403 })
    }
    if (partId) {
      const p = await prisma.part.findUnique({ where: { id: partId }, select: { id: true, userId: true } })
      if (!p) return NextResponse.json({ error: "Запчасть не найдена" }, { status: 404 })
      if (p.userId !== session.user.id) return NextResponse.json({ error: "Нет прав" }, { status: 403 })
    }

    const listing = await prisma.listing.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        price: parseInt(price),
        userId: session.user.id,
        vehicleId: vehicleId || null,
        partId: partId || null,
      },
      include: {
        vehicle: true,
        part: true,
        user: { select: { id: true, name: true, image: true } },
      },
    })

    return NextResponse.json(listing, { status: 201 })
  } catch (error) {
    console.error("Error creating listing:", error)
    return NextResponse.json({ error: "Failed to create listing" }, { status: 500 })
  }
}
