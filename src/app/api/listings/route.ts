import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"

export const dynamic = "force-dynamic"

function parseInteger(value: string | null, fallback?: number) {
  if (!value) return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback
}

function parseValues(value: string | null) {
  return (value || "").split(",").map((item) => item.trim()).filter(Boolean)
}

function oneOrMany(value: string | null) {
  const values = parseValues(value)
  if (values.length === 0) return undefined
  return values.length === 1 ? values[0] : { in: values }
}

function normalizeListing<T extends {
  vehicle?: { location?: string | null } | null
  part?: { location?: string | null } | null
}>(listing: T) {
  return {
    ...listing,
    location: listing.vehicle?.location || listing.part?.location || null,
  }
}

/** GET /api/listings — список объявлений с фильтрами и пагинацией */
export async function GET(request: NextRequest) {
  try {
    const sp = new URL(request.url).searchParams
    const page = Math.max(1, parseInteger(sp.get("page"), 1) || 1)
    const limit = Math.min(50, Math.max(1, parseInteger(sp.get("limit"), 12) || 12))
    const skip = (page - 1) * limit

    const type = sp.get("type") // "vehicle" | "part" | undefined (оба)
    const q = sp.get("q")?.trim()
    const ids = sp.get("ids") // список ID через запятую для сравнения
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
    const steeringWheel = sp.get("steeringWheel")
    const documentsStatus = sp.get("documentsStatus")
    const damageInfo = sp.get("damageInfo")
    const sellerType = sp.get("sellerType")
    const availability = sp.get("availability")
    const customsCleared = sp.get("customsCleared")
    const ownersCountFrom = sp.get("ownersCountFrom")
    const ownersCountTo = sp.get("ownersCountTo")
    const mileageFrom = sp.get("mileageFrom")
    const mileageTo = sp.get("mileageTo")
    const keywords = sp.get("keywords")
    const vehicleType = sp.get("vehicleType") // CAR, MOTORCYCLE, TRUCK, SPECIAL, WATER, AIR

    // Фильтры запчастей
    const partType = sp.get("partType")
    const partCondition = sp.get("partCondition")

    const where: Prisma.ListingWhereInput = {}
    if (ids) {
      const idArr = ids.split(",").map((x) => x.trim()).filter(Boolean)
      where.vehicleId = { in: idArr }
    }

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
      const minPrice = parseInteger(priceFrom)
      const maxPrice = parseInteger(priceTo)
      if (minPrice !== undefined) where.price.gte = minPrice
      if (maxPrice !== undefined) where.price.lte = maxPrice
    }

    if (q) {
      where.OR = [
        { title: { contains: q } },
        { description: { contains: q } },
        { vehicle: { OR: [{ make: { contains: q } }, { model: { contains: q } }, { vin: { contains: q } }] } },
        { part: { OR: [{ name: { contains: q } }, { make: { contains: q } }, { model: { contains: q } }] } },
      ]
    }

    if (make) vehicleFilters.make = { contains: make }
    if (model) vehicleFilters.model = { contains: model }
    if (yearFrom || yearTo) {
      vehicleFilters.year = {}
      const minYear = parseInteger(yearFrom)
      const maxYear = parseInteger(yearTo)
      if (minYear !== undefined) vehicleFilters.year.gte = minYear
      if (maxYear !== undefined) vehicleFilters.year.lte = maxYear
    }
    const fuelTypes = oneOrMany(fuelType)
    if (fuelTypes) vehicleFilters.fuelType = fuelTypes
    if (transmission) vehicleFilters.transmission = transmission
    const bodyTypes = oneOrMany(bodyType)
    if (bodyTypes) vehicleFilters.bodyType = bodyTypes
    if (driveType) vehicleFilters.driveType = driveType
    if (color) vehicleFilters.color = { contains: color }
    const conditions = oneOrMany(condition)
    if (conditions) vehicleFilters.condition = conditions
    if (steeringWheel) vehicleFilters.steeringWheel = steeringWheel
    if (documentsStatus) vehicleFilters.documentsStatus = documentsStatus
    if (damageInfo) vehicleFilters.damageInfo = damageInfo
    if (sellerType) vehicleFilters.sellerType = sellerType
    if (availability) vehicleFilters.availability = availability
    if (customsCleared === "true") vehicleFilters.customsCleared = true
    if (customsCleared === "false") vehicleFilters.customsCleared = false
    if (keywords) vehicleFilters.keywords = { contains: keywords }
    if (ownersCountFrom || ownersCountTo) {
      vehicleFilters.ownersCount = {}
      const minOwners = parseInteger(ownersCountFrom)
      const maxOwners = parseInteger(ownersCountTo)
      if (minOwners !== undefined) vehicleFilters.ownersCount.gte = minOwners
      if (maxOwners !== undefined) vehicleFilters.ownersCount.lte = maxOwners
    }
    if (mileageFrom || mileageTo) {
      vehicleFilters.mileage = {}
      const minMileage = parseInteger(mileageFrom)
      const maxMileage = parseInteger(mileageTo)
      if (minMileage !== undefined) vehicleFilters.mileage.gte = minMileage
      if (maxMileage !== undefined) vehicleFilters.mileage.lte = maxMileage
    }
    if (engineVolumeFrom || engineVolumeTo) {
      vehicleFilters.engineVolume = {}
      const minEngine = Number(engineVolumeFrom)
      const maxEngine = Number(engineVolumeTo)
      if (Number.isFinite(minEngine)) vehicleFilters.engineVolume.gte = minEngine
      if (Number.isFinite(maxEngine)) vehicleFilters.engineVolume.lte = maxEngine
    }
    if (powerFrom || powerTo) {
      vehicleFilters.power = {}
      const minPower = parseInteger(powerFrom)
      const maxPower = parseInteger(powerTo)
      if (minPower !== undefined) vehicleFilters.power.gte = minPower
      if (maxPower !== undefined) vehicleFilters.power.lte = maxPower
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
      listings: listings.map(normalizeListing),
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
    const normalizedTitle = typeof title === "string" ? title.trim() : ""
    const normalizedDescription = typeof description === "string" ? description.trim() : null
    const normalizedPrice = Number(price)

    if ((vehicleId && partId) || (!vehicleId && !partId)) {
      return NextResponse.json(
        { error: "Укажите либо vehicleId, либо partId" },
        { status: 400 }
      )
    }
    if (!normalizedTitle) {
      return NextResponse.json({ error: "Заголовок обязателен" }, { status: 400 })
    }
    if (!Number.isFinite(normalizedPrice) || normalizedPrice < 0) {
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
        title: normalizedTitle,
        description: normalizedDescription || null,
        price: Math.trunc(normalizedPrice),
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

    return NextResponse.json(normalizeListing(listing), { status: 201 })
  } catch (error) {
    console.error("Error creating listing:", error)
    return NextResponse.json({ error: "Failed to create listing" }, { status: 500 })
  }
}
