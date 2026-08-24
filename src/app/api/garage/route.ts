import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { validateVehicleEnergyAndModelYear } from "@/lib/constants"
import { prisma } from "@/lib/prisma"
import { normalizeVehicleIdentity } from "@/lib/vehicle-publication-readiness"

export const dynamic = "force-dynamic"

const FUEL_TYPES = new Set(["GASOLINE", "DIESEL", "ELECTRIC", "HYBRID", "GAS", "OTHER"])
const TRANSMISSION_TYPES = new Set(["MANUAL", "AUTOMATIC", "VARIATOR", "ROBOTIC"])
const GARAGE_VEHICLE_SELECT = {
  id: true, make: true, model: true, year: true, mileage: true, vin: true,
  fuelType: true, transmission: true, bodyType: true, color: true,
  doors: true, engineVolume: true, power: true, driveType: true,
  condition: true, steeringWheel: true, ownersCount: true,
  documentsStatus: true, damageInfo: true, sellerType: true,
  availability: true, customsCleared: true, generation: true, keywords: true,
  location: true, description: true, images: true, createdAt: true,
} as const

function optionalText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null
  const normalized = value.trim().replace(/\s+/g, " ")
  return normalized ? normalized.slice(0, maxLength) : null
}

function optionalInteger(value: unknown, min: number, max: number) {
  if (value === "" || value == null) return null
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : null
}

function optionalDecimal(value: unknown, min: number, max: number) {
  if (value === "" || value == null) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null
}

function normalizeGarageVehiclePayload(body: unknown) {
  const input = body && typeof body === "object" ? body as Record<string, unknown> : {}
  const make = optionalText(input.make, 60)
  const model = optionalText(input.model, 80)
  const year = Number(input.year)
  const mileage = input.mileage === "" || input.mileage == null ? null : Number(input.mileage)
  const fuelType = typeof input.fuelType === "string" && FUEL_TYPES.has(input.fuelType) ? input.fuelType : "GASOLINE"
  const transmission = typeof input.transmission === "string" && TRANSMISSION_TYPES.has(input.transmission) ? input.transmission : "MANUAL"
  const vin = optionalText(input.vin, 32)?.toUpperCase() || null
  const currentYear = new Date().getFullYear()

  if (!make || make.length < 2 || !model || !Number.isInteger(year) || year < 1900 || year > currentYear + 1) {
    return { error: "Марка, модель и год обязательны" } as const
  }
  if (mileage != null && (!Number.isInteger(mileage) || mileage < 0 || mileage > 3_000_000)) {
    return { error: "Проверьте пробег автомобиля" } as const
  }

  const normalizedIdentity = vin ? normalizeVehicleIdentity("CAR", vin, null, null) : null
  if (normalizedIdentity && "error" in normalizedIdentity) {
    return { error: normalizedIdentity.error } as const
  }

  const energyAndYearError = validateVehicleEnergyAndModelYear("CAR", make, model, year, fuelType)
  if (energyAndYearError) return { error: energyAndYearError } as const

  const images = Array.isArray(input.images)
    ? [...new Set(input.images.filter((value: unknown): value is string => typeof value === "string" && /^\/uploads\/[a-f0-9-]+\.(?:jpg|png|webp)$/i.test(value)))].slice(0, 12)
    : []

  return {
    data: {
      make,
      model,
      year,
      mileage,
      vin: normalizedIdentity?.vin || null,
      fuelType,
      transmission,
      bodyType: optionalText(input.bodyType, 40),
      color: optionalText(input.color, 40),
      doors: optionalInteger(input.doors, 1, 8),
      engineVolume: optionalDecimal(input.engineVolume, 0.1, 20),
      power: optionalInteger(input.power, 1, 5000),
      driveType: optionalText(input.driveType, 20),
      condition: optionalText(input.condition, 32) || "EXCELLENT",
      steeringWheel: optionalText(input.steeringWheel, 16),
      ownersCount: optionalInteger(input.ownersCount, 0, 100),
      documentsStatus: optionalText(input.documentsStatus, 24),
      damageInfo: optionalText(input.damageInfo, 24),
      sellerType: optionalText(input.sellerType, 20),
      availability: optionalText(input.availability, 24),
      customsCleared: typeof input.customsCleared === "boolean" ? input.customsCleared : null,
      generation: optionalText(input.generation, 80),
      keywords: optionalText(input.keywords, 500),
      location: optionalText(input.location, 120) || "",
      description: optionalText(input.description, 5000),
      images: images.length ? JSON.stringify(images) : null,
    },
  } as const
}

/** GET /api/garage — список или одна личная запись пользователя. */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Необходимо войти в аккаунт" }, { status: 401 })

    const id = request.nextUrl.searchParams.get("id")?.trim()
    if (id) {
      const vehicle = await prisma.vehicle.findFirst({
        where: { id, userId: session.user.id, category: { name: "Личный гараж" } },
        select: GARAGE_VEHICLE_SELECT,
      })
      return vehicle
        ? NextResponse.json({ vehicle: { ...vehicle, vin: vehicle.vin?.startsWith("GARAGE-") ? null : vehicle.vin } })
        : NextResponse.json({ error: "Автомобиль не найден в вашем гараже" }, { status: 404 })
    }

    const vehicles = await prisma.vehicle.findMany({
      where: { userId: session.user.id, category: { name: "Личный гараж" } },
      select: GARAGE_VEHICLE_SELECT,
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({
      vehicles: vehicles.map((vehicle) => ({ ...vehicle, vin: vehicle.vin?.startsWith("GARAGE-") ? null : vehicle.vin })),
    })
  } catch {
    return NextResponse.json({ error: "Не удалось загрузить автомобили из гаража" }, { status: 500 })
  }
}

/** POST /api/garage — добавить авто в гараж (без создания объявления) */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Необходимо войти в аккаунт" }, { status: 401 })

    const normalized = normalizeGarageVehiclePayload(await request.json().catch(() => null))
    if ("error" in normalized) return NextResponse.json({ error: normalized.error }, { status: 400 })

    const garageCategory = await prisma.category.upsert({
      where: { name: "Личный гараж" },
      update: {},
      create: {
        name: "Личный гараж",
        description: "Служебная категория личного гаража без публикации в каталоге",
        icon: "garage",
      },
    })

    // У гаражного автомобиля нет Listing, поэтому он не попадает в публичный каталог.
    const vehicle = await prisma.vehicle.create({
      data: {
        ...normalized.data,
        price: 0,
        vehicleType: "CAR",
        userId: session.user.id,
        categoryId: garageCategory.id,
      },
    })

    return NextResponse.json(vehicle, { status: 201 })
  } catch (error: unknown) {
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "VIN уже существует" }, { status: 409 })
    }
    return NextResponse.json({ error: "Не удалось добавить автомобиль в гараж" }, { status: 500 })
  }
}

/** PATCH /api/garage?id=... — обновить приватную карточку своего автомобиля. */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Необходимо войти в аккаунт" }, { status: 401 })

    const id = request.nextUrl.searchParams.get("id")?.trim()
    if (!id) return NextResponse.json({ error: "Не указан автомобиль" }, { status: 400 })

    const normalized = normalizeGarageVehiclePayload(await request.json().catch(() => null))
    if ("error" in normalized) return NextResponse.json({ error: normalized.error }, { status: 400 })

    const result = await prisma.vehicle.updateMany({
      where: { id, userId: session.user.id, category: { name: "Личный гараж" } },
      data: normalized.data,
    })
    if (result.count === 0) {
      return NextResponse.json({ error: "Автомобиль не найден в вашем гараже" }, { status: 404 })
    }

    const vehicle = await prisma.vehicle.findFirst({
      where: { id, userId: session.user.id, category: { name: "Личный гараж" } },
      select: GARAGE_VEHICLE_SELECT,
    })
    return NextResponse.json(vehicle)
  } catch (error: unknown) {
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "VIN уже существует" }, { status: 409 })
    }
    return NextResponse.json({ error: "Не удалось обновить автомобиль в гараже" }, { status: 500 })
  }
}

/** DELETE /api/garage?id=... — удалить только свой автомобиль из личного гаража. */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Необходимо войти в аккаунт" }, { status: 401 })

    const id = request.nextUrl.searchParams.get("id")?.trim()
    if (!id) return NextResponse.json({ error: "Не указан автомобиль" }, { status: 400 })

    const result = await prisma.vehicle.deleteMany({
      where: {
        id,
        userId: session.user.id,
        category: { name: "Личный гараж" },
      },
    })

    if (result.count === 0) {
      return NextResponse.json({ error: "Автомобиль не найден" }, { status: 404 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Не удалось удалить автомобиль из гаража" }, { status: 500 })
  }
}
