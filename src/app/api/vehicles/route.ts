import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import axios from "axios"
import { prisma } from "@/lib/prisma"
import { BODY_TYPES, DRIVE_TYPES, getFuelOptions, getTransmissionOptions, getVehicleIdentityMeta, supportsTransmission, validateVehicleEnergyAndModelYear } from "@/lib/constants"
import { isVehicleCategoryCompatible } from "@/lib/vehicleCategories"
import { getVehicleSubtypeConfig, inferVehicleSubtype, isValidVehicleSubtype, type VehicleTypeDetails } from "@/lib/vehicleSubtypes"
import { parseMarketplaceImages } from "@/lib/media-url"
import { LISTING_STATUS } from "@/lib/listing-lifecycle"
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit"

const TYPE_DETAIL_KEYS: Record<string, Set<string>> = {
  MOTORCYCLE: new Set(["motorcycleType", "finalDrive", "strokeCycle"]),
  TRUCK: new Set(["truckBodyType", "axleFormula", "ecoClass", "payloadKg", "grossWeightKg", "transmissionVariant"]),
  SPECIAL: new Set(["specialType", "operatingWeightKg", "bucketVolumeM3", "diggingDepthM", "payloadKg"]),
  WATER: new Set(["waterType", "hullMaterial", "hullLengthM", "waterEngineType"]),
  AIR: new Set(["airType", "airEngineType", "engineCount", "mtowKg", "passengerCapacity"]),
  CAR: new Set(),
}

function normalizeOptionalNonNegativeInteger(value: unknown) {
  if (value === undefined || value === null || value === "") return null
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : undefined
}

function normalizeOptionalText(value: unknown, maxLength: number) {
  if (value === undefined || value === null) return null
  if (typeof value !== "string") return undefined
  const normalized = value.trim()
  return normalized ? normalized.slice(0, maxLength) : null
}

const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/
const TRANSPORT_IDENTIFIER_PATTERN = /^[A-ZА-ЯЁ0-9][A-ZА-ЯЁ0-9 .\/-]{1,31}$/

type VehicleIdentity = {
  vin: string | null
  serialNumber: string | null
  registrationNumber: string | null
}

function normalizeVehicleIdentity(vehicleType: string, vin: unknown, serialNumber: unknown, registrationNumber: unknown): VehicleIdentity | { error: string } {
  const identityMeta = getVehicleIdentityMeta(vehicleType)
  const normalized = {
    vin: typeof vin === "string" ? vin.trim().toUpperCase() : "",
    serialNumber: typeof serialNumber === "string" ? serialNumber.trim().toUpperCase() : "",
    registrationNumber: typeof registrationNumber === "string" ? registrationNumber.trim().toUpperCase() : "",
  }
  const selectedValue = normalized[identityMeta.field]

  if (!selectedValue) return { error: `Укажите: ${identityMeta.label}` }
  if (identityMeta.field === "vin") {
    if (!VIN_PATTERN.test(selectedValue)) return { error: "VIN должен содержать 17 латинских символов и цифр без I, O и Q" }
    return { vin: selectedValue, serialNumber: null, registrationNumber: null }
  }
  if (!TRANSPORT_IDENTIFIER_PATTERN.test(selectedValue)) {
    return { error: `${identityMeta.label} должен содержать от 3 до 32 букв, цифр, пробелов, точек, слэшей или дефисов` }
  }

  // У спецтехники иногда указан полноценный VIN. Сохраняем его в отдельном
  // уникальном поле, чтобы прежняя антидубль-проверка продолжала работать.
  if (vehicleType === "SPECIAL" && VIN_PATTERN.test(selectedValue)) {
    return { vin: selectedValue, serialNumber: null, registrationNumber: null }
  }
  return {
    vin: null,
    serialNumber: identityMeta.field === "serialNumber" ? selectedValue : null,
    registrationNumber: identityMeta.field === "registrationNumber" ? selectedValue : null,
  }
}

function normalizeTypeDetails(value: unknown, vehicleType: string) {
  const raw = typeof value === "string" ? (() => {
    try { return JSON.parse(value) } catch { return null }
  })() : value
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {} as VehicleTypeDetails

  const allowed = TYPE_DETAIL_KEYS[vehicleType] || new Set<string>()
  const details = Object.fromEntries(Object.entries(raw).filter(([key, item]) =>
    allowed.has(key) && (typeof item === "string" || typeof item === "number" || typeof item === "boolean"),
  )) as VehicleTypeDetails
  return details
}

/** GET /api/vehicles — собственные легковые авто для защищённых сервисов. */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Необходимо войти в аккаунт" }, { status: 401 })

    const vehicles = await prisma.vehicle.findMany({
      where: { userId: session.user.id, vehicleType: "CAR" },
      select: {
        id: true,
        make: true,
        model: true,
        year: true,
        price: true,
        mileage: true,
        condition: true,
        location: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    })

    return NextResponse.json({ vehicles })
  } catch (error) {
    console.error("Owned vehicles GET error:", error)
    return NextResponse.json({ error: "Не удалось загрузить ваши автомобили" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { error: "Необходимо войти в аккаунт" },
        { status: 401 }
      )
    }
    const createLimit = rateLimit(`vehicle-create:user:${session.user.id}:ip:${getClientIp(request)}`, { windowMs: 60 * 60 * 1000, maxRequests: 15 })
    if (!createLimit.success) {
      return NextResponse.json(
        { error: "Слишком много новых объявлений. Попробуйте позднее." },
        { status: 429, headers: rateLimitHeaders(createLimit) },
      )
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Некорректные данные объявления" }, { status: 400 })
    }
    const {
      make,
      model,
      year,
      price,
      mileage,
      operatingHours,
      flightHours,
      vin,
      serialNumber,
      registrationNumber,
      fuelType,
      transmission,
      bodyType,
      color,
      doors,
      engineVolume,
      power,
      driveType,
      condition,
      steeringWheel,
      ownersCount,
      documentsStatus,
      damageInfo,
      sellerType,
      availability,
      customsCleared,
      generation,
      keywords,
      vehicleType,
      typeDetails,
      location,
      description,
      images,
      categoryId,
      title,
    } = body

    // Validation
    const normalizedMake = normalizeOptionalText(make, 80)
    const normalizedModel = normalizeOptionalText(model, 100)
    if (!normalizedMake) {
      return NextResponse.json(
        { error: "Укажите марку" },
        { status: 400 }
      )
    }

    if (!normalizedModel) {
      return NextResponse.json(
        { error: "Укажите модель" },
        { status: 400 }
      )
    }

    const normalizedYear = Number(year)
    const maxVehicleYear = new Date().getFullYear() + 1
    if (!Number.isInteger(normalizedYear) || normalizedYear < 1886 || normalizedYear > maxVehicleYear) {
      return NextResponse.json(
        { error: `Год выпуска должен быть целым числом от 1886 до ${maxVehicleYear}` },
        { status: 400 }
      )
    }

    const normalizedPrice = Number(price)
    if (!Number.isSafeInteger(normalizedPrice) || normalizedPrice < 0) {
      return NextResponse.json(
        { error: "Укажите корректную цену в рублях" },
        { status: 400 }
      )
    }

    if (!categoryId) {
      return NextResponse.json(
        { error: "Укажите категорию транспорта" },
        { status: 400 }
      )
    }

    const allowedVehicleTypes = new Set(["CAR", "MOTORCYCLE", "TRUCK", "SPECIAL", "WATER", "AIR"])
    const normalizedVehicleType = allowedVehicleTypes.has(String(vehicleType)) ? String(vehicleType) : "CAR"
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true, name: true },
    })
    if (!category) {
      return NextResponse.json({ error: "Категория не найдена" }, { status: 404 })
    }
    const normalizedTitle = typeof title === "string" ? title.trim() : `${normalizedYear} ${normalizedMake} ${normalizedModel}`.trim()
    if (normalizedTitle.length < 3 || normalizedTitle.length > 200) {
      return NextResponse.json({ error: "Заголовок должен содержать от 3 до 200 символов" }, { status: 400 })
    }
    if (!isVehicleCategoryCompatible(category.name, normalizedVehicleType)) {
      return NextResponse.json({ error: "Категория не соответствует типу транспорта" }, { status: 400 })
    }
    const normalizedLocation = normalizeOptionalText(location, 120)
    if (!normalizedLocation) return NextResponse.json({ error: "Укажите город размещения" }, { status: 400 })

    // Geocode location if provided
    let lat = null
    let lng = null
    if (process.env.GOOGLE_MAPS_API_KEY) {
      try {
        const geocodeResponse = await axios.get("https://maps.googleapis.com/maps/api/geocode/json", {
          params: {
            address: normalizedLocation,
            key: process.env.GOOGLE_MAPS_API_KEY
          }
        })

        if (geocodeResponse.data.status === "OK" && geocodeResponse.data.results.length > 0) {
          const { lat: latitude, lng: longitude } = geocodeResponse.data.results[0].geometry.location
          lat = latitude
          lng = longitude
        }
      } catch (geocodeError) {
        console.error("Geocoding error:", geocodeError)
        // Continue without lat/lng if geocoding fails
      }
    }

    // Create the transport record and its moderation listing atomically. A
    // network error or a failed listing validation can no longer leave an
    // unpublished orphan vehicle in the catalogue database.
    const inferredSubtype = inferVehicleSubtype(normalizedVehicleType, normalizedMake, normalizedModel)
    const submittedTypeDetails = normalizeTypeDetails(typeDetails, normalizedVehicleType)
    const subtypeConfig = getVehicleSubtypeConfig(normalizedVehicleType)
    const submittedSubtype = subtypeConfig && normalizedVehicleType !== "CAR"
      ? submittedTypeDetails[subtypeConfig.field]
      : null
    if (typeof submittedSubtype === "string" && !isValidVehicleSubtype(normalizedVehicleType, submittedSubtype)) {
      return NextResponse.json({ error: "Выбранный подтип не подходит для этой категории транспорта" }, { status: 400 })
    }
    const normalizedTypeDetails = Object.keys({ ...inferredSubtype.typeDetails, ...submittedTypeDetails }).length > 0
      ? JSON.stringify({ ...inferredSubtype.typeDetails, ...submittedTypeDetails })
      : null
    const normalizedMileage = normalizeOptionalNonNegativeInteger(mileage)
    const normalizedOperatingHours = normalizeOptionalNonNegativeInteger(operatingHours)
    const normalizedFlightHours = normalizeOptionalNonNegativeInteger(flightHours)
    const normalizedImages = parseMarketplaceImages(images)
    const normalizedIdentity = normalizeVehicleIdentity(normalizedVehicleType, vin, serialNumber, registrationNumber)
    const normalizedDescription = normalizeOptionalText(description, 10_000)

    if (normalizedMileage === undefined || normalizedOperatingHours === undefined || normalizedFlightHours === undefined) {
      return NextResponse.json({ error: "Пробег и наработка должны быть неотрицательными целыми числами" }, { status: 400 })
    }
    if (!normalizedImages) return NextResponse.json({ error: "Допустимы до 12 корректных изображений" }, { status: 400 })
    if (normalizedImages.length === 0) return NextResponse.json({ error: "Добавьте хотя бы одну фотографию транспорта" }, { status: 400 })
    if ("error" in normalizedIdentity) return NextResponse.json({ error: normalizedIdentity.error }, { status: 400 })

    const allowedFuelTypes = new Set<string>(getFuelOptions(normalizedVehicleType).map((item) => item.value))
    if (!fuelType || !allowedFuelTypes.has(String(fuelType))) {
      return NextResponse.json({ error: "Выбранный тип топлива не подходит для этой категории транспорта" }, { status: 400 })
    }
    const energyAndYearError = validateVehicleEnergyAndModelYear(
      normalizedVehicleType,
      normalizedMake,
      normalizedModel,
      normalizedYear,
      String(fuelType),
      typeof transmission === "string" ? transmission : null,
    )
    if (energyAndYearError) return NextResponse.json({ error: energyAndYearError }, { status: 400 })

    const transmissionOptions = getTransmissionOptions(normalizedVehicleType)
    if (supportsTransmission(normalizedVehicleType) && (!transmission || !transmissionOptions.some((item) => item.value === transmission))) {
      return NextResponse.json({ error: "Выбранный тип КПП не подходит для этой категории транспорта" }, { status: 400 })
    }

    const allowedDriveTypes = new Set<string>(DRIVE_TYPES.map((item) => item.value))
    if (normalizedVehicleType === "CAR" && driveType && !allowedDriveTypes.has(String(driveType))) {
      return NextResponse.json({ error: "Выбранный тип привода не подходит для легкового автомобиля" }, { status: 400 })
    }
    const allowedBodyTypes = new Set<string>(BODY_TYPES.map((item) => item.value))
    if (normalizedVehicleType === "CAR" && bodyType && !allowedBodyTypes.has(String(bodyType))) {
      return NextResponse.json({ error: "Выбранный тип кузова не подходит для легкового автомобиля" }, { status: 400 })
    }
    const normalizedBodyType = normalizedVehicleType === "CAR"
      ? String(bodyType || inferredSubtype.bodyType || "").trim() || null
      : null

    const vehicle = await prisma.vehicle.create({
      data: {
        make: normalizedMake,
        model: normalizedModel,
        year: normalizedYear,
        price: normalizedPrice,
        mileage: ["SPECIAL", "WATER", "AIR"].includes(normalizedVehicleType) ? null : normalizedMileage,
        operatingHours: ["SPECIAL", "WATER"].includes(normalizedVehicleType) ? normalizedOperatingHours : null,
        flightHours: normalizedVehicleType === "AIR" ? normalizedFlightHours : null,
        vin: normalizedIdentity.vin,
        serialNumber: normalizedIdentity.serialNumber,
        registrationNumber: normalizedIdentity.registrationNumber,
        fuelType: String(fuelType).trim(),
        transmission: supportsTransmission(normalizedVehicleType) ? String(transmission).trim() : "NOT_APPLICABLE",
        bodyType: normalizedBodyType,
        color: color ? color.trim() : null,
        doors: doors ? parseInt(doors) : null,
        engineVolume: engineVolume ? parseFloat(engineVolume) : null,
        power: power ? parseInt(power) : null,
        driveType: normalizedVehicleType === "CAR" && driveType ? driveType.trim() : null,
        condition: condition ? condition.trim() : null,
        steeringWheel: steeringWheel ? steeringWheel.trim() : null,
        ownersCount: ownersCount ? parseInt(ownersCount) : null,
        documentsStatus: documentsStatus ? documentsStatus.trim() : null,
        damageInfo: damageInfo ? damageInfo.trim() : null,
        sellerType: sellerType ? sellerType.trim() : null,
        availability: availability ? availability.trim() : null,
        customsCleared: customsCleared !== undefined ? Boolean(customsCleared) : null,
        generation: generation ? generation.trim() : null,
        keywords: keywords ? keywords.trim() : null,
        vehicleType: normalizedVehicleType,
        typeDetails: normalizedTypeDetails,
        location: normalizedLocation,
        description: normalizedDescription,
        images: normalizedImages.length ? JSON.stringify(normalizedImages) : null,
        userId: session.user.id,
        categoryId,
        lat,
        lng,
        listings: {
          create: {
            title: normalizedTitle,
            description: normalizedDescription,
            price: normalizedPrice,
            userId: session.user.id,
            status: LISTING_STATUS.PENDING_MODERATION,
            lastStatusChangedAt: new Date(),
            statusEvents: {
              create: {
                toStatus: LISTING_STATUS.PENDING_MODERATION,
                actorId: session.user.id,
                reason: "Отправлено владельцем на модерацию",
              },
            },
          },
        },
      },
      include: { listings: { select: { id: true, status: true } } },
    })

    return NextResponse.json(vehicle, { status: 201 })
  } catch (error) {
    console.error("Error creating vehicle:", error)
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "Транспорт с таким VIN уже размещён. Проверьте номер или обратитесь в поддержку." }, { status: 409 })
    }
    return NextResponse.json(
      { error: "Не удалось создать объявление" },
      { status: 500 }
    )
  }
}
