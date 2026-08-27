import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import type { Prisma } from "@prisma/client"
import { requireUser } from "@/lib/api-session-guard"
import { authOptions } from "@/lib/auth"
import {
  AVAILABILITY_TYPES,
  BODY_TYPES,
  CONDITIONS,
  DAMAGE_INFO,
  DOCUMENT_STATUSES,
  DRIVE_TYPES,
  SELLER_TYPES,
  STEERING_WHEELS,
  getSelectableFuelOptions,
  getSelectableTransmissionOptions,
  validateVehicleEnergyAndModelYear,
} from "@/lib/constants"
import { prisma } from "@/lib/prisma"
import { getVehiclePublicationReadiness, normalizeVehicleIdentity } from "@/lib/vehicle-publication-readiness"

export const dynamic = "force-dynamic"

const GARAGE_VEHICLE_SELECT = {
  id: true, make: true, model: true, year: true, mileage: true, vin: true,
  fuelType: true, transmission: true, bodyType: true, color: true,
  doors: true, engineVolume: true, power: true, driveType: true,
  condition: true, steeringWheel: true, ownersCount: true,
  documentsStatus: true, damageInfo: true, sellerType: true,
  availability: true, customsCleared: true, generation: true, keywords: true,
  location: true, description: true, images: true, createdAt: true,
} as const

type GarageVehicleRecord = Prisma.VehicleGetPayload<{ select: typeof GARAGE_VEHICLE_SELECT }>
type GarageOption = readonly { value: string; label: string }[]

function normalizeGarageOption(
  value: unknown,
  options: GarageOption,
  label: string,
  fallback: string | null = null,
): { value: string | null; error: string | null } {
  if (value == null || value === "") return { value: fallback, error: null }
  if (typeof value !== "string" || !options.some((option) => option.value === value)) {
    return { value: null, error: `Выберите ${label} из списка` }
  }
  return { value, error: null }
}

function serializeGarageVehicle(vehicle: GarageVehicleRecord) {
  const vin = vehicle.vin?.startsWith("GARAGE-") ? null : vehicle.vin
  return {
    ...vehicle,
    vin,
    publicationReadiness: getVehiclePublicationReadiness({
      ...vehicle,
      vehicleType: "CAR",
      vin,
      price: 0,
    }),
  }
}

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
  const fuelType = normalizeGarageOption(input.fuelType, getSelectableFuelOptions("CAR"), "тип топлива", "GASOLINE")
  const transmission = normalizeGarageOption(input.transmission, getSelectableTransmissionOptions("CAR"), "коробку передач", "MANUAL")
  const bodyType = normalizeGarageOption(input.bodyType, BODY_TYPES, "тип кузова")
  const driveType = normalizeGarageOption(input.driveType, DRIVE_TYPES, "привод")
  const condition = normalizeGarageOption(input.condition, CONDITIONS, "состояние", "EXCELLENT")
  const steeringWheel = normalizeGarageOption(input.steeringWheel, STEERING_WHEELS, "расположение руля")
  const documentsStatus = normalizeGarageOption(input.documentsStatus, DOCUMENT_STATUSES, "статус документов")
  const damageInfo = normalizeGarageOption(input.damageInfo, DAMAGE_INFO, "сведения о повреждениях")
  const sellerType = normalizeGarageOption(input.sellerType, SELLER_TYPES, "тип продавца")
  const availability = normalizeGarageOption(input.availability, AVAILABILITY_TYPES, "наличие автомобиля")
  const vin = optionalText(input.vin, 32)?.toUpperCase() || null
  const currentYear = new Date().getFullYear()

  if (!make || make.length < 2 || !model || !Number.isInteger(year) || year < 1900 || year > currentYear + 1) {
    return { error: "Марка, модель и год обязательны" } as const
  }
  if (mileage != null && (!Number.isInteger(mileage) || mileage < 0 || mileage > 3_000_000)) {
    return { error: "Проверьте пробег автомобиля" } as const
  }
  const invalidOption = [fuelType, transmission, bodyType, driveType, condition, steeringWheel, documentsStatus, damageInfo, sellerType, availability]
    .find((option) => option.error)
  if (invalidOption?.error) return { error: invalidOption.error } as const

  const normalizedIdentity = vin ? normalizeVehicleIdentity("CAR", vin, null, null) : null
  if (normalizedIdentity && "error" in normalizedIdentity) {
    return { error: normalizedIdentity.error } as const
  }

  const energyAndYearError = validateVehicleEnergyAndModelYear("CAR", make, model, year, fuelType.value || "GASOLINE")
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
      fuelType: fuelType.value || "GASOLINE",
      transmission: transmission.value || "MANUAL",
      bodyType: bodyType.value,
      color: optionalText(input.color, 40),
      doors: optionalInteger(input.doors, 1, 8),
      engineVolume: optionalDecimal(input.engineVolume, 0.1, 20),
      power: optionalInteger(input.power, 1, 5000),
      driveType: driveType.value,
      condition: condition.value || "EXCELLENT",
      steeringWheel: steeringWheel.value,
      ownersCount: optionalInteger(input.ownersCount, 0, 100),
      documentsStatus: documentsStatus.value,
      damageInfo: damageInfo.value,
      sellerType: sellerType.value,
      availability: availability.value,
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
        ? NextResponse.json({ vehicle: serializeGarageVehicle(vehicle) })
        : NextResponse.json({ error: "Автомобиль не найден в вашем гараже" }, { status: 404 })
    }

    const vehicles = await prisma.vehicle.findMany({
      where: { userId: session.user.id, category: { name: "Личный гараж" } },
      select: GARAGE_VEHICLE_SELECT,
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({
      vehicles: vehicles.map(serializeGarageVehicle),
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
      select: GARAGE_VEHICLE_SELECT,
    })

    return NextResponse.json(serializeGarageVehicle(vehicle), { status: 201 })
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
    const guard = await requireUser()
    if (guard.denied) return guard.denied
    const session = guard.session

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
    return NextResponse.json(vehicle ? serializeGarageVehicle(vehicle) : null)
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
    const guard = await requireUser()
    if (guard.denied) return guard.denied
    const session = guard.session

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
