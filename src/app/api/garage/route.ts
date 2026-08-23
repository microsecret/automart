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

    const body = await request.json().catch(() => null)
    const make = optionalText(body?.make, 60)
    const model = optionalText(body?.model, 80)
    const year = Number(body?.year)
    const mileage = body?.mileage === "" || body?.mileage == null ? null : Number(body.mileage)
    const fuelType = typeof body?.fuelType === "string" && FUEL_TYPES.has(body.fuelType) ? body.fuelType : "GASOLINE"
    const transmission = typeof body?.transmission === "string" && TRANSMISSION_TYPES.has(body.transmission) ? body.transmission : "MANUAL"
    const bodyType = optionalText(body?.bodyType, 40)
    const color = optionalText(body?.color, 40)
    const condition = optionalText(body?.condition, 32) || "EXCELLENT"
    const vin = optionalText(body?.vin, 32)?.toUpperCase() || null
    const location = optionalText(body?.location, 120) || ""
    const doors = optionalInteger(body?.doors, 1, 8)
    const engineVolume = optionalDecimal(body?.engineVolume, 0.1, 20)
    const power = optionalInteger(body?.power, 1, 5000)
    const ownersCount = optionalInteger(body?.ownersCount, 0, 100)
    const images = Array.isArray(body?.images)
      ? [...new Set(body.images.filter((value: unknown): value is string => typeof value === "string" && /^\/uploads\/[a-f0-9-]+\.(?:jpg|png|webp)$/i.test(value)))].slice(0, 12)
      : []
    const currentYear = new Date().getFullYear()

    if (!make || make.length < 2 || !model || model.length < 1 || !Number.isInteger(year) || year < 1900 || year > currentYear + 1) {
      return NextResponse.json({ error: "Марка, модель и год обязательны" }, { status: 400 })
    }

    if (mileage != null && (!Number.isInteger(mileage) || mileage < 0 || mileage > 3_000_000)) {
      return NextResponse.json({ error: "Проверьте пробег автомобиля" }, { status: 400 })
    }

    const normalizedIdentity = vin ? normalizeVehicleIdentity("CAR", vin, null, null) : null
    if (normalizedIdentity && "error" in normalizedIdentity) {
      return NextResponse.json({ error: normalizedIdentity.error }, { status: 400 })
    }

    const energyAndYearError = validateVehicleEnergyAndModelYear("CAR", make, model, year, fuelType)
    if (energyAndYearError) {
      return NextResponse.json({ error: energyAndYearError }, { status: 400 })
    }

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
        make, model, year,
        price: 0,
        mileage,
        // Отсутствующий VIN остаётся честным null. Прежняя синтетическая
        // строка выглядела как идентификатор и мешала безопасно переиспользовать
        // запись при создании объявления.
        vin: normalizedIdentity?.vin || null,
        fuelType,
        transmission,
        bodyType,
        color,
        doors,
        engineVolume,
        power,
        driveType: optionalText(body?.driveType, 20),
        condition,
        steeringWheel: optionalText(body?.steeringWheel, 16),
        ownersCount,
        documentsStatus: optionalText(body?.documentsStatus, 24),
        damageInfo: optionalText(body?.damageInfo, 24),
        sellerType: optionalText(body?.sellerType, 20),
        availability: optionalText(body?.availability, 24),
        customsCleared: typeof body?.customsCleared === "boolean" ? body.customsCleared : null,
        generation: optionalText(body?.generation, 80),
        keywords: optionalText(body?.keywords, 500),
        location,
        description: optionalText(body?.description, 5000),
        images: images.length ? JSON.stringify(images) : null,
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
