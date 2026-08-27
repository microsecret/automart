import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { requireUser } from "@/lib/api-session-guard"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { AVAILABILITY_TYPES, BODY_TYPES, CONDITIONS, DAMAGE_INFO, DOCUMENT_STATUSES, DRIVE_TYPES, SELLER_TYPES, STEERING_WHEELS, getSelectableFuelOptions, getSelectableTransmissionOptions, supportsTransmission, validateVehicleEnergyAndModelYear } from "@/lib/constants"
import { isVehicleCategoryCompatible } from "@/lib/vehicleCategories"
import { getVehicleSubtypeConfig, inferVehicleSubtype, isValidVehicleSubtype, type VehicleTypeDetails } from "@/lib/vehicleSubtypes"
import { parseMarketplaceImages } from "@/lib/media-url"
import { LISTING_STATUS } from "@/lib/listing-lifecycle"
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit"
import { normalizeVehicleIdentity, validateVehiclePublication } from "@/lib/vehicle-publication-readiness"

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

function normalizeOptionalPositiveNumber(value: unknown, max: number) {
  if (value === undefined || value === null || value === "") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 && parsed <= max ? parsed : undefined
}

function isAllowedValue(value: string | null | undefined, options: readonly { value: string }[]) {
  return Boolean(value && options.some((option) => option.value === value))
}

function normalizeOptionalText(value: unknown, maxLength: number) {
  if (value === undefined || value === null) return null
  if (typeof value !== "string") return undefined
  const normalized = value.trim()
  return normalized ? normalized.slice(0, maxLength) : null
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
    const guard = await requireUser()
    if (guard.denied) return guard.denied
    const session = guard.session

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
      garageVehicleId,
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
    if (!Number.isSafeInteger(normalizedPrice) || normalizedPrice <= 0) {
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
    const normalizedGarageVehicleId = normalizeOptionalText(garageVehicleId, 64)
    if (garageVehicleId != null && !normalizedGarageVehicleId) {
      return NextResponse.json({ error: "Некорректный автомобиль гаража" }, { status: 400 })
    }
    if (normalizedGarageVehicleId && normalizedVehicleType !== "CAR") {
      return NextResponse.json({ error: "Из личного гаража можно подать только легковой автомобиль" }, { status: 400 })
    }
    const garageVehicle = normalizedGarageVehicleId
      ? await prisma.vehicle.findFirst({
          where: {
            id: normalizedGarageVehicleId,
            userId: session.user.id,
            category: { name: "Личный гараж" },
            listings: { none: {} },
          },
          select: { id: true, categoryId: true },
        })
      : null
    if (normalizedGarageVehicleId && !garageVehicle) {
      return NextResponse.json({ error: "Автомобиль не найден в личном гараже или уже превращён в объявление" }, { status: 409 })
    }
    const normalizedLocation = normalizeOptionalText(location, 120)
    if (!normalizedLocation) return NextResponse.json({ error: "Укажите город размещения" }, { status: 400 })

    // Geocode location if provided
    let lat = null
    let lng = null
    if (process.env.GOOGLE_MAPS_API_KEY) {
      try {
        const geocodeUrl = new URL("https://maps.googleapis.com/maps/api/geocode/json")
        geocodeUrl.search = new URLSearchParams({
          address: normalizedLocation,
          key: process.env.GOOGLE_MAPS_API_KEY,
        }).toString()
        const geocodeResponse = await fetch(geocodeUrl, {
          cache: "no-store",
          signal: AbortSignal.timeout(5_000),
        })
        if (geocodeResponse.ok) {
          const geocode = await geocodeResponse.json() as {
            status?: string
            results?: Array<{ geometry?: { location?: { lat?: number; lng?: number } } }>
          }
          const location = geocode.results?.[0]?.geometry?.location
          if (geocode.status === "OK" && Number.isFinite(location?.lat) && Number.isFinite(location?.lng)) {
            lat = location!.lat!
            lng = location!.lng!
          }
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
    const normalizedColor = normalizeOptionalText(color, 40)
    const normalizedCondition = normalizeOptionalText(condition, 24)
    const normalizedSteeringWheel = normalizeOptionalText(steeringWheel, 16)
    const normalizedDocumentsStatus = normalizeOptionalText(documentsStatus, 24)
    const normalizedDamageInfo = normalizeOptionalText(damageInfo, 24)
    const normalizedSellerType = normalizeOptionalText(sellerType, 20)
    const normalizedAvailability = normalizeOptionalText(availability, 24)
    const normalizedGeneration = normalizeOptionalText(generation, 80)
    const normalizedKeywords = normalizeOptionalText(keywords, 500)
    const normalizedOwnersCount = normalizeOptionalNonNegativeInteger(ownersCount)
    const normalizedDoors = normalizeOptionalNonNegativeInteger(doors)
    const normalizedEngineVolume = normalizeOptionalPositiveNumber(engineVolume, 100)
    const normalizedPower = normalizeOptionalNonNegativeInteger(power)
    const normalizedCustomsCleared = typeof customsCleared === "boolean" ? customsCleared : null

    if (normalizedMileage === undefined || normalizedOperatingHours === undefined || normalizedFlightHours === undefined
      || normalizedOwnersCount === undefined || normalizedDoors === undefined || normalizedEngineVolume === undefined
      || normalizedPower === undefined) {
      return NextResponse.json({ error: "Пробег и наработка должны быть неотрицательными целыми числами" }, { status: 400 })
    }
    if ([normalizedDescription, normalizedColor, normalizedCondition, normalizedSteeringWheel, normalizedDocumentsStatus,
      normalizedDamageInfo, normalizedSellerType, normalizedAvailability, normalizedGeneration, normalizedKeywords].includes(undefined)) {
      return NextResponse.json({ error: "Проверьте текстовые поля объявления" }, { status: 400 })
    }
    if (normalizedOwnersCount !== null && normalizedOwnersCount > 100) {
      return NextResponse.json({ error: "Количество владельцев должно быть от 0 до 100" }, { status: 400 })
    }
    if (normalizedDoors !== null && (normalizedDoors < 1 || normalizedDoors > 20)) {
      return NextResponse.json({ error: "Количество дверей должно быть от 1 до 20" }, { status: 400 })
    }
    if (normalizedPower !== null && (normalizedPower < 1 || normalizedPower > 100_000)) {
      return NextResponse.json({ error: "Мощность должна быть от 1 до 100 000 л.с." }, { status: 400 })
    }
    if (!normalizedImages) return NextResponse.json({ error: "Допустимы до 12 корректных изображений" }, { status: 400 })
    if (normalizedImages.length === 0) return NextResponse.json({ error: "Добавьте хотя бы одну фотографию транспорта" }, { status: 400 })
    if ("error" in normalizedIdentity) return NextResponse.json({ error: normalizedIdentity.error }, { status: 400 })

    // «Другое» доступно только импорту: на площадке четыре активных объявления
    // из пяти были поданы с ним и в топливе, и в коробке — продавцы так
    // пропускали поля, а покупатель оставался без данных, ради которых открыл
    // карточку. Проверка стоит на сервере, потому что форму можно обойти.
    const allowedFuelTypes = new Set<string>(getSelectableFuelOptions(normalizedVehicleType).map((item) => item.value))
    const normalizedFuelType = normalizeOptionalText(fuelType, 20)
    if (!normalizedFuelType || !allowedFuelTypes.has(normalizedFuelType)) {
      return NextResponse.json(
        { error: String(fuelType) === "OTHER"
          ? "Укажите тип топлива: бензин, дизель, гибрид, электро или газ"
          : "Выбранный тип топлива не подходит для этой категории транспорта" },
        { status: 400 },
      )
    }
    const energyAndYearError = validateVehicleEnergyAndModelYear(
      normalizedVehicleType,
      normalizedMake,
      normalizedModel,
      normalizedYear,
      normalizedFuelType,
      typeof transmission === "string" ? transmission : null,
    )
    if (energyAndYearError) return NextResponse.json({ error: energyAndYearError }, { status: 400 })

    const transmissionOptions = getSelectableTransmissionOptions(normalizedVehicleType)
    const normalizedTransmission = normalizeOptionalText(transmission, 24)
    if (supportsTransmission(normalizedVehicleType) && (!normalizedTransmission || !transmissionOptions.some((item) => item.value === normalizedTransmission))) {
      return NextResponse.json(
        { error: String(transmission) === "OTHER"
          ? "Укажите коробку передач: механика, автомат, вариатор или робот"
          : "Выбранный тип КПП не подходит для этой категории транспорта" },
        { status: 400 },
      )
    }

    // Освобождения от силовых полей завязаны на надстройку грузовика и
    // категорию ВС, поэтому берётся подтип из typeDetails; у легкового
    // послаблений по кузову нет и подтип на набор не влияет.
    const subtypeField = normalizedVehicleType === "CAR" ? null : subtypeConfig?.field
    const resolvedSubtype = subtypeField
      ? String({ ...inferredSubtype.typeDetails, ...submittedTypeDetails }[subtypeField] ?? "")
      : ""

    const allowedDriveTypes = new Set<string>(DRIVE_TYPES.map((item) => item.value))
    const normalizedDriveType = normalizeOptionalText(driveType, 20)
    if (normalizedVehicleType === "CAR" && normalizedDriveType && !allowedDriveTypes.has(normalizedDriveType)) {
      return NextResponse.json({ error: "Выбранный тип привода не подходит для легкового автомобиля" }, { status: 400 })
    }
    const allowedBodyTypes = new Set<string>(BODY_TYPES.map((item) => item.value))
    const submittedBodyType = normalizeOptionalText(bodyType, 24)
    if (normalizedVehicleType === "CAR" && submittedBodyType && !allowedBodyTypes.has(submittedBodyType)) {
      return NextResponse.json({ error: "Выбранный тип кузова не подходит для легкового автомобиля" }, { status: 400 })
    }
    const normalizedBodyType = normalizedVehicleType === "CAR"
      ? submittedBodyType || inferredSubtype.bodyType || null
      : null

    if (normalizedCondition && !isAllowedValue(normalizedCondition, CONDITIONS)) {
      return NextResponse.json({ error: "Выберите состояние из списка" }, { status: 400 })
    }
    if (normalizedSteeringWheel && !isAllowedValue(normalizedSteeringWheel, STEERING_WHEELS)) {
      return NextResponse.json({ error: "Выберите расположение руля из списка" }, { status: 400 })
    }
    if (normalizedDocumentsStatus && !isAllowedValue(normalizedDocumentsStatus, DOCUMENT_STATUSES)) {
      return NextResponse.json({ error: "Выберите статус документов из списка" }, { status: 400 })
    }
    if (normalizedDamageInfo && !isAllowedValue(normalizedDamageInfo, DAMAGE_INFO)) {
      return NextResponse.json({ error: "Выберите сведения о повреждениях из списка" }, { status: 400 })
    }
    if (normalizedSellerType && !isAllowedValue(normalizedSellerType, SELLER_TYPES)) {
      return NextResponse.json({ error: "Выберите тип продавца из списка" }, { status: 400 })
    }
    if (normalizedAvailability && !isAllowedValue(normalizedAvailability, AVAILABILITY_TYPES)) {
      return NextResponse.json({ error: "Выберите наличие транспорта из списка" }, { status: 400 })
    }

    /* Единый шлюз перед PENDING_MODERATION.

       Он проверяет не только мотор и пробег, но и данные, которые стабильно
       показывают Auto.ru и Drom: мощность, кузов, привод, цвет, руль,
       владельцев, поколение, документы, повреждения и таможенный статус.
       Тот же контракт стоит на повторной отправке и одобрении модератором. */
    const publicationError = validateVehiclePublication({
      make: normalizedMake,
      model: normalizedModel,
      year: normalizedYear,
      price: normalizedPrice,
      location: normalizedLocation,
      ...normalizedIdentity,
      images: normalizedImages,
      description: normalizedDescription,
      vehicleType: normalizedVehicleType,
      mileage: normalizedMileage,
      operatingHours: normalizedOperatingHours,
      flightHours: normalizedFlightHours,
      transmission: normalizedTransmission,
      fuelType: normalizedFuelType,
      engineVolume: normalizedEngineVolume,
      power: normalizedPower,
      subtype: resolvedSubtype,
      bodyType: normalizedBodyType,
      driveType: normalizedDriveType,
      color: normalizedColor,
      condition: normalizedCondition,
      steeringWheel: normalizedSteeringWheel,
      ownersCount: normalizedOwnersCount,
      documentsStatus: normalizedDocumentsStatus,
      damageInfo: normalizedDamageInfo,
      sellerType: normalizedSellerType,
      availability: normalizedAvailability,
      customsCleared: normalizedCustomsCleared,
      generation: normalizedGeneration,
    })
    if (publicationError) return NextResponse.json({ error: publicationError }, { status: 400 })

    const vehicleData = {
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
      fuelType: normalizedFuelType,
      transmission: supportsTransmission(normalizedVehicleType) ? normalizedTransmission! : "NOT_APPLICABLE",
      bodyType: normalizedBodyType,
      color: normalizedColor,
      doors: normalizedDoors,
      engineVolume: normalizedEngineVolume,
      power: normalizedPower,
      driveType: normalizedVehicleType === "CAR" ? normalizedDriveType : null,
      condition: normalizedCondition!,
      steeringWheel: normalizedSteeringWheel,
      ownersCount: normalizedOwnersCount,
      documentsStatus: normalizedDocumentsStatus,
      damageInfo: normalizedDamageInfo,
      sellerType: normalizedSellerType,
      availability: normalizedAvailability,
      customsCleared: normalizedCustomsCleared,
      generation: normalizedGeneration,
      keywords: normalizedKeywords,
      vehicleType: normalizedVehicleType,
      typeDetails: normalizedTypeDetails,
      location: normalizedLocation,
      description: normalizedDescription,
      images: normalizedImages.length ? JSON.stringify(normalizedImages) : null,
      userId: session.user.id,
      categoryId,
      lat,
      lng,
    }
    const listingData = {
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
    }

    const vehicle = garageVehicle
      ? await prisma.$transaction(async (tx) => {
          // categoryId is a compare-and-swap guard: two вкладки не смогут
          // одновременно превратить одну приватную запись в два объявления.
          const claimed = await tx.vehicle.updateMany({
            where: {
              id: garageVehicle.id,
              userId: session.user.id,
              categoryId: garageVehicle.categoryId,
              listings: { none: {} },
            },
            data: vehicleData,
          })
          if (claimed.count !== 1) return null

          const listing = await tx.listing.create({
            data: { ...listingData, vehicleId: garageVehicle.id },
            select: { id: true, status: true },
          })
          const updatedVehicle = await tx.vehicle.findUniqueOrThrow({ where: { id: garageVehicle.id } })
          return { ...updatedVehicle, listings: [listing] }
        })
      : await prisma.vehicle.create({
          data: {
            ...vehicleData,
            listings: {
              create: listingData,
            },
          },
          include: { listings: { select: { id: true, status: true } } },
        })

    if (!vehicle) {
      return NextResponse.json({ error: "Автомобиль гаража уже изменён или отправлен на модерацию" }, { status: 409 })
    }

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
