import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { containsAnyCase } from "@/lib/search-terms"
import { CITY_COORDINATES } from "@/lib/cities"
import { citiesWithinRadius, parseRadius } from "@/lib/geo-distance"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { getFuelOptions, getTransmissionOptions, supportsTransmission } from "@/lib/constants"
import { getVehicleSubtypeConfig, isValidVehicleSubtype } from "@/lib/vehicleSubtypes"
import { LISTING_STATUS, publicListingWhere } from "@/lib/listing-lifecycle"
import { readStoredVehicleSubtype, validateVehiclePublication } from "@/lib/vehicle-publication-readiness"
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

function parseInteger(value: string | null, fallback?: number) {
  if (!value) return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback
}

type NumericRange = { from?: number; to?: number; error?: string }

function parseNumericRange(input: {
  from: string | null
  to: string | null
  label: string
  min?: number
  max?: number
  integer?: boolean
}): NumericRange {
  const { from: rawFrom, to: rawTo, label, min = 0, max, integer = true } = input
  const parse = (value: string | null) => {
    if (value === null || value.trim() === "") return undefined
    const parsed = Number(value)
    if (!Number.isFinite(parsed) || (integer && !Number.isSafeInteger(parsed)) || parsed < min || (max !== undefined && parsed > max)) return null
    return parsed
  }

  const from = parse(rawFrom)
  const to = parse(rawTo)
  if (from === null || to === null) return { error: `${label}: укажите корректное значение` }
  if (from !== undefined && to !== undefined && from > to) return { error: `${label}: значение «от» не может быть больше значения «до»` }
  return { from, to }
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
  vehicle?: { location?: string | null; vehicleType?: string | null; transmission?: string | null; fuelType?: string | null } | null
  part?: { location?: string | null } | null
}>(listing: T) {
  const vehicle = listing.vehicle
  const vehicleType = vehicle?.vehicleType || "CAR"
  const allowedFuelTypes = new Set<string>(getFuelOptions(vehicleType).map((item) => item.value))
  const normalizedVehicle = vehicle ? {
    ...vehicle,
    transmission: supportsTransmission(vehicleType) ? vehicle.transmission : null,
    fuelType: vehicle.fuelType && allowedFuelTypes.has(vehicle.fuelType) ? vehicle.fuelType : null,
  } : null

  return {
    ...listing,
    vehicle: normalizedVehicle,
    location: normalizedVehicle?.location || listing.part?.location || null,
  }
}

/** GET /api/listings — список объявлений с фильтрами и пагинацией */
export async function GET(request: NextRequest) {
  try {
    const sp = new URL(request.url).searchParams
    const page = Math.min(10_000, Math.max(1, parseInteger(sp.get("page"), 1) || 1))
    const limit = Math.min(50, Math.max(1, parseInteger(sp.get("limit"), 12) || 12))
    const skip = (page - 1) * limit

    const type = sp.get("type") // "vehicle" | "part" | undefined (оба)
    if (type && type !== "vehicle" && type !== "part") return NextResponse.json({ error: "Некорректный тип объявления" }, { status: 400 })
    const q = sp.get("q")?.trim()
    const ids = sp.get("ids") // список ID через запятую для сравнения
    const priceFrom = sp.get("priceFrom")
    const priceTo = sp.get("priceTo")
    const city = sp.get("city")?.trim()
    const radiusKm = parseRadius(sp.get("radius"))
    const sort = sp.get("sort") || "newest"

    const priceRange = parseNumericRange({ from: priceFrom, to: priceTo, label: "Цена" })
    if (priceRange.error) return NextResponse.json({ error: priceRange.error }, { status: 400 })

    // Фильтры ТС
    const make = sp.get("make")
    const model = sp.get("model")
    const yearFrom = sp.get("yearFrom")
    const yearTo = sp.get("yearTo")
    const fuelType = sp.get("fuelType")
    const transmission = sp.get("transmission")
    const bodyType = sp.get("bodyType")
    const subtype = sp.get("subtype")
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
    const operatingHoursFrom = sp.get("operatingHoursFrom")
    const operatingHoursTo = sp.get("operatingHoursTo")
    const flightHoursFrom = sp.get("flightHoursFrom")
    const flightHoursTo = sp.get("flightHoursTo")
    const keywords = sp.get("keywords")
    const vehicleType = sp.get("vehicleType") // CAR, MOTORCYCLE, TRUCK, SPECIAL, WATER, AIR
    const allowedVehicleTypes = new Set(["CAR", "MOTORCYCLE", "TRUCK", "SPECIAL", "WATER", "AIR"])
    if (vehicleType && !allowedVehicleTypes.has(vehicleType)) return NextResponse.json({ error: "Некорректный тип транспорта" }, { status: 400 })
    if (type === "part" && vehicleType) return NextResponse.json({ error: "Тип транспорта нельзя использовать для выдачи запчастей" }, { status: 400 })

    const maxVehicleYear = new Date().getFullYear() + 1
    const yearRange = parseNumericRange({ from: yearFrom, to: yearTo, label: "Год выпуска", min: 1886, max: maxVehicleYear })
    const ownersRange = parseNumericRange({ from: ownersCountFrom, to: ownersCountTo, label: "Количество владельцев" })
    const mileageRange = parseNumericRange({ from: mileageFrom, to: mileageTo, label: "Пробег" })
    const operatingHoursRange = parseNumericRange({ from: operatingHoursFrom, to: operatingHoursTo, label: "Наработка" })
    const flightHoursRange = parseNumericRange({ from: flightHoursFrom, to: flightHoursTo, label: "Налёт" })
    const engineVolumeRange = parseNumericRange({ from: engineVolumeFrom, to: engineVolumeTo, label: "Объём двигателя", integer: false })
    const powerRange = parseNumericRange({ from: powerFrom, to: powerTo, label: "Мощность" })
    const invalidRange = [yearRange, ownersRange, mileageRange, operatingHoursRange, flightHoursRange, engineVolumeRange, powerRange].find((range) => range.error)
    if (invalidRange?.error) return NextResponse.json({ error: invalidRange.error }, { status: 400 })

    // The public endpoint is also called directly from shared links. Do not
    // silently apply car-only fields to water, air or heavy equipment when a
    // visitor changes the URL by hand — those values make the result and UI
    // contradict the category-specific form.
    const hasMileageRange = mileageRange.from !== undefined || mileageRange.to !== undefined
    const hasOperatingHoursRange = operatingHoursRange.from !== undefined || operatingHoursRange.to !== undefined
    const hasFlightHoursRange = flightHoursRange.from !== undefined || flightHoursRange.to !== undefined
    if (vehicleType && ["SPECIAL", "WATER", "AIR"].includes(vehicleType) && hasMileageRange) {
      return NextResponse.json({ error: "Для выбранного типа используйте наработку или налёт, а не пробег" }, { status: 400 })
    }
    if (vehicleType && !["SPECIAL", "WATER"].includes(vehicleType) && hasOperatingHoursRange) {
      return NextResponse.json({ error: "Наработка доступна только для спецтехники и водного транспорта" }, { status: 400 })
    }
    if (vehicleType && vehicleType !== "AIR" && hasFlightHoursRange) {
      return NextResponse.json({ error: "Налёт доступен только для воздушного транспорта" }, { status: 400 })
    }

    const requestedFuelTypes = parseValues(fuelType)
    if (vehicleType && requestedFuelTypes.some((value) => !getFuelOptions(vehicleType).some((item) => item.value === value))) {
      return NextResponse.json({ error: "Выбранный тип топлива не подходит для этой категории транспорта" }, { status: 400 })
    }
    if (vehicleType && transmission) {
      if (!supportsTransmission(vehicleType)) {
        return NextResponse.json({ error: "Фильтр КПП неприменим к выбранной категории транспорта" }, { status: 400 })
      }
      if (!getTransmissionOptions(vehicleType).some((item) => item.value === transmission)) {
        return NextResponse.json({ error: "Выбранный тип КПП не подходит для этой категории транспорта" }, { status: 400 })
      }
    }

    // Фильтры запчастей
    const partType = sp.get("partType")
    const partCondition = sp.get("partCondition")

    // The public API is the catalogue boundary: drafts, rejected, archived and
    // soft-deleted records must never leak through search, comparison or map.
    const where: Prisma.ListingWhereInput = { ...publicListingWhere }
    if (ids) {
      /* Идентификаторы объявлений, а не машин.

         Список сравнения хранит то, что сохраняет карточка — id
         объявления. Здесь же поиск шёл по vehicleId, и страница
         сравнения всегда показывала «Объявления не найдены». Проверено
         на боевом API: по id объявления находилось ноль, по id машины —
         один и тот же лот.

         Условие ставится отдельным полем: ниже `type === "vehicle"`
         перезаписывал vehicleId и стирал список. */
      const idArr = ids.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 50)
      where.id = { in: idArr }
    }

    if (type === "vehicle") {
      where.vehicleId = { not: null }
    } else if (type === "part") {
      where.partId = { not: null }
    }

    // Фильтр по типу транспорта (категории) — аккумулируем в vehicleFilters
    const vehicleFilters: Prisma.VehicleWhereInput = {}
    if (vehicleType) vehicleFilters.vehicleType = vehicleType

    if (priceRange.from !== undefined || priceRange.to !== undefined) {
      where.price = {}
      if (priceRange.from !== undefined) where.price.gte = priceRange.from
      if (priceRange.to !== undefined) where.price.lte = priceRange.to
    }

    if (q) {
      /* Поиск без учёта регистра.

         База — SQLite: Prisma не поддерживает здесь `mode: "insensitive"`, а
         встроенный LIKE игнорирует регистр только для латиницы. Замер на
         живом сайте: «КАМАЗ» находил объявление, «камаз» — нет; «Lada» —
         два, «лада» — ноль. Люди пишут строчными, то есть поиск не работал
         для большинства реальных запросов.

         Запрос разворачивается в несколько написаний — их не больше четырёх,
         условие остаётся обычным `contains`. */
      where.OR = [
        ...containsAnyCase("title", q),
        ...containsAnyCase("description", q),
        { vehicle: { OR: [...containsAnyCase("make", q), ...containsAnyCase("model", q), ...containsAnyCase("vin", q)] } },
        { part: { OR: [...containsAnyCase("name", q), ...containsAnyCase("make", q), ...containsAnyCase("model", q)] } },
      ] as Prisma.ListingWhereInput["OR"]
    }

    /* Марка и модель ищутся без учёта регистра — «лада» должна находить
       «Lada». Условия складываются в общий AND: раньше марка занимала
       vehicleFilters.OR, а подтип кузова ниже перезаписывал то же поле, и
       выбор двух фильтров сразу давал неверную выдачу. */
    const vehicleAnd: Prisma.VehicleWhereInput[] = []
    if (make) vehicleAnd.push({ OR: containsAnyCase("make", make) as Prisma.VehicleWhereInput["OR"] })
    if (model) vehicleAnd.push({ OR: containsAnyCase("model", model) as Prisma.VehicleWhereInput["OR"] })
    if (yearRange.from !== undefined || yearRange.to !== undefined) {
      vehicleFilters.year = {}
      if (yearRange.from !== undefined) vehicleFilters.year.gte = yearRange.from
      if (yearRange.to !== undefined) vehicleFilters.year.lte = yearRange.to
    }
    const fuelTypes = oneOrMany(fuelType)
    if (fuelTypes) vehicleFilters.fuelType = fuelTypes
    if (transmission) vehicleFilters.transmission = transmission
    const bodyTypes = oneOrMany(bodyType)
    if (bodyTypes) {
      // Body styles are a passenger-car vocabulary.  The homepage exposes
      // this filter before a category is selected, so keep equipment, water
      // and aircraft out of the result even if legacy data has a bodyType.
      if (!vehicleType) vehicleFilters.vehicleType = "CAR"
      vehicleFilters.bodyType = bodyTypes
    }
    const subtypeValues = parseValues(subtype)
    if (subtypeValues.length > 0 && vehicleType && vehicleType !== "CAR") {
      const subtypeConfig = getVehicleSubtypeConfig(vehicleType)
      if (!subtypeConfig || subtypeValues.some((value) => !isValidVehicleSubtype(vehicleType, value))) {
        return NextResponse.json({ error: "Некорректный подтип транспорта" }, { status: 400 })
      }
      const typeDetailChecks = subtypeValues.map((value) => ({
        typeDetails: { contains: `\"${subtypeConfig.field}\":\"${value}\"` },
      }))
      if (typeDetailChecks.length === 1) vehicleFilters.typeDetails = typeDetailChecks[0].typeDetails
      else vehicleAnd.push({ OR: typeDetailChecks })
    }
    if (driveType && (!vehicleType || vehicleType === "CAR")) {
      if (!vehicleType) vehicleFilters.vehicleType = "CAR"
      vehicleFilters.driveType = driveType
    }
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
    if (ownersRange.from !== undefined || ownersRange.to !== undefined) {
      vehicleFilters.ownersCount = {}
      if (ownersRange.from !== undefined) vehicleFilters.ownersCount.gte = ownersRange.from
      if (ownersRange.to !== undefined) vehicleFilters.ownersCount.lte = ownersRange.to
    }
    if (mileageRange.from !== undefined || mileageRange.to !== undefined) {
      vehicleFilters.mileage = {}
      if (mileageRange.from !== undefined) vehicleFilters.mileage.gte = mileageRange.from
      if (mileageRange.to !== undefined) vehicleFilters.mileage.lte = mileageRange.to
    }
    if (operatingHoursRange.from !== undefined || operatingHoursRange.to !== undefined) {
      vehicleFilters.operatingHours = {}
      if (operatingHoursRange.from !== undefined) vehicleFilters.operatingHours.gte = operatingHoursRange.from
      if (operatingHoursRange.to !== undefined) vehicleFilters.operatingHours.lte = operatingHoursRange.to
    }
    if (flightHoursRange.from !== undefined || flightHoursRange.to !== undefined) {
      vehicleFilters.flightHours = {}
      if (flightHoursRange.from !== undefined) vehicleFilters.flightHours.gte = flightHoursRange.from
      if (flightHoursRange.to !== undefined) vehicleFilters.flightHours.lte = flightHoursRange.to
    }
    if (engineVolumeRange.from !== undefined || engineVolumeRange.to !== undefined) {
      vehicleFilters.engineVolume = {}
      if (engineVolumeRange.from !== undefined) vehicleFilters.engineVolume.gte = engineVolumeRange.from
      if (engineVolumeRange.to !== undefined) vehicleFilters.engineVolume.lte = engineVolumeRange.to
    }
    if (powerRange.from !== undefined || powerRange.to !== undefined) {
      vehicleFilters.power = {}
      if (powerRange.from !== undefined) vehicleFilters.power.gte = powerRange.from
      if (powerRange.to !== undefined) vehicleFilters.power.lte = powerRange.to
    }
    /* Поиск «в радиусе N километров от города».

       Раньше фильтр искал точное вхождение названия: человек из Тулы видел
       только тульские объявления, хотя до Москвы ему два часа езды. На
       крупных площадках радиус — привычный фильтр, и за хорошим вариантом
       в соседний город ездят охотно.

       Радиус принимается только из известного набора: произвольное число
       из адреса развернулось бы в запрос по сотням городов. */
    const nearbyCities = radiusKm && city && CITY_COORDINATES[city]
      ? citiesWithinRadius(CITY_COORDINATES[city], radiusKm, CITY_COORDINATES)
      : null

    if (vehicleAnd.length) vehicleFilters.AND = vehicleAnd

    if (Object.keys(vehicleFilters).length > 0) {
      where.vehicle = vehicleFilters
    }

    const partFilters: Prisma.PartWhereInput = {}
    if (partType) partFilters.partType = partType
    if (partCondition) partFilters.condition = partCondition
    if (Object.keys(partFilters).length > 0) {
      where.part = partFilters
    }

    /* Город — условие «или»: он есть либо у транспорта, либо у запчасти.

       Раньше оно ставилось сразу в оба фильтра, а Prisma соединяет их через
       «и»: объявление о машине отсеивалось, потому что запчасти у него нет и
       её условие не выполнялось. Проверка на живом сайте: четыре объявления
       с городом «Казань», фильтр по Казани возвращал ноль. */
    const cityNames = nearbyCities?.length ? nearbyCities : city ? [city] : []
    if (cityNames.length) {
      /* Все города — внутри одного условия на связь.

         Каждое условие вида `{ vehicle: { … } }` порождает у SQLite отдельное
         соединение таблиц, а их не может быть больше 64. При поиске в радиусе
         городов набирается до двухсот, и запрос падал с ошибкой «at most 64
         tables in a join» — проверка на живом сайте это показала.

         Здесь связей ровно две: одна к транспорту, одна к запчасти, а города
         перечислены внутри них. */
      const locationOr = cityNames.map((name) => ({ location: { contains: name } }))
      const cityCondition: Prisma.ListingWhereInput = {
        OR: [
          { vehicle: { OR: locationOr } },
          { part: { OR: locationOr } },
        ],
      }
      where.AND = [...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []), cityCondition]
    }

    /* Порядок задаётся двумя ключами: выбранным и идентификатором.

       Одного ключа мало. Записи с одинаковой ценой или датой база
       возвращает в произвольном порядке, и он меняется между запросами:
       листая каталог, покупатель видел одни объявления дважды, а другие
       не видел вовсе. Проверено на копии базы: одна вставка между
       страницами — и запись со страницы 1 появляется на странице 2.

       Идентификатор уникален, поэтому порядок становится определённым. */
    const primaryOrderBy: Prisma.ListingOrderByWithRelationInput =
      sort === "price_asc" ? { price: "asc" }
      : sort === "price_desc" ? { price: "desc" }
      : sort === "oldest" ? { createdAt: "asc" }
      : sort === "year_desc" ? { vehicle: { year: "desc" } }
      : sort === "mileage_asc" && vehicleType === "AIR" ? { vehicle: { flightHours: "asc" } }
      : sort === "mileage_asc" && (vehicleType === "SPECIAL" || vehicleType === "WATER") ? { vehicle: { operatingHours: "asc" } }
      : sort === "mileage_asc" ? { vehicle: { mileage: "asc" } }
      : { createdAt: "desc" }

    const orderBy: Prisma.ListingOrderByWithRelationInput[] = [primaryOrderBy, { id: "desc" }]

    const [listings, total] = await prisma.$transaction([
      prisma.listing.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          title: true,
          description: true,
          price: true,
          status: true,
          isFeatured: true,
          promoUntil: true,
          views: true,
          createdAt: true,
          publishedAt: true,
          userId: true,
          /* Поля перечислены поимённо, а не через `vehicle: true`.

             Раньше отдавались все сорок колонок, включая VIN, госномер,
             серийный номер и координаты: один проход по каталогу собирал
             готовую базу VIN всех объявлений площадки.

             Здесь остаётся то, что показывает витрина: карточка, страница
             сравнения и подсказки поиска. Точный адрес и опознавательные
             номера машины к ним не относятся — они открываются вместе с
             контактом продавца, а не всем подряд. */
          vehicle: {
            select: {
              id: true, make: true, model: true, year: true, price: true,
              mileage: true, operatingHours: true, flightHours: true,
              fuelType: true, transmission: true, driveType: true,
              bodyType: true, vehicleType: true, typeDetails: true,
              engineVolume: true, power: true, doors: true, generation: true,
              color: true, condition: true, steeringWheel: true,
              documentsStatus: true, damageInfo: true, customsCleared: true,
              ownersCount: true, sellerType: true, availability: true,
              location: true, images: true, description: true,
              categoryId: true, createdAt: true,
            },
          },
          part: {
            select: {
              id: true, name: true, price: true, condition: true,
              partType: true, images: true, description: true,
              brandName: true, oemNumber: true, availability: true,
              make: true, yearFrom: true, yearTo: true, vehicleType: true,
              saleFormat: true, auctionStatus: true, auctionEndsAt: true,
              auctionCurrentPrice: true, auctionStartPrice: true,
              location: true, storeId: true, createdAt: true,
            },
          },
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
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const limit = rateLimit(`listing:create:user:${session.user.id}:ip:${getClientIp(request)}`, { windowMs: 60 * 60_000, maxRequests: 20 })
    if (!limit.success) return NextResponse.json({ error: "Слишком много объявлений. Повторите позже." }, { status: 429, headers: rateLimitHeaders(limit) })

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 })
    const { title, description, price, vehicleId, partId } = body as Record<string, unknown>
    const normalizedTitle = typeof title === "string" ? title.trim() : ""
    const normalizedDescription = typeof description === "string" ? description.trim() : null
    const normalizedPrice = Number(price)
    const normalizedVehicleId = typeof vehicleId === "string" && vehicleId.length <= 100 ? vehicleId : null
    const normalizedPartId = typeof partId === "string" && partId.length <= 100 ? partId : null

    if ((normalizedVehicleId && normalizedPartId) || (!normalizedVehicleId && !normalizedPartId)) {
      return NextResponse.json(
        { error: "Укажите либо vehicleId, либо partId" },
        { status: 400 }
      )
    }
    if (normalizedTitle.length < 2 || normalizedTitle.length > 160) {
      return NextResponse.json({ error: "Заголовок должен содержать от 2 до 160 символов" }, { status: 400 })
    }
    if (normalizedDescription && normalizedDescription.length > 10_000) {
      return NextResponse.json({ error: "Описание не должно превышать 10 000 символов" }, { status: 400 })
    }
    if (!Number.isSafeInteger(normalizedPrice) || normalizedPrice < 0 || normalizedPrice > 2_000_000_000) {
      return NextResponse.json({ error: "Цена обязательна" }, { status: 400 })
    }

    let resolvedVehicleDescription = normalizedDescription
    if (normalizedVehicleId) {
      const v = await prisma.vehicle.findUnique({ where: { id: normalizedVehicleId } })
      if (!v) return NextResponse.json({ error: "ТС не найдено" }, { status: 404 })
      if (v.userId !== session.user.id) return NextResponse.json({ error: "Нет прав" }, { status: 403 })
      const duplicate = await prisma.listing.findFirst({
        where: { deletedAt: null, vehicleId: normalizedVehicleId },
        select: { id: true },
      })
      if (duplicate) return NextResponse.json({ error: "Для этого объекта объявление уже создано", listingId: duplicate.id }, { status: 409 })
      resolvedVehicleDescription = normalizedDescription ?? v.description
      const publicationError = validateVehiclePublication({
        ...v,
        price: normalizedPrice,
        description: resolvedVehicleDescription,
        subtype: readStoredVehicleSubtype(v.vehicleType, v.typeDetails),
      })
      if (publicationError) return NextResponse.json({ error: publicationError }, { status: 400 })
    }
    if (normalizedPartId) {
      const p = await prisma.part.findUnique({ where: { id: normalizedPartId }, select: { id: true, userId: true } })
      if (!p) return NextResponse.json({ error: "Запчасть не найдена" }, { status: 404 })
      if (p.userId !== session.user.id) return NextResponse.json({ error: "Нет прав" }, { status: 403 })
      const duplicate = await prisma.listing.findFirst({
        where: { deletedAt: null, partId: normalizedPartId },
        select: { id: true },
      })
      if (duplicate) return NextResponse.json({ error: "Для этого объекта объявление уже создано", listingId: duplicate.id }, { status: 409 })
    }

    const listing = await prisma.$transaction(async (tx) => {
      if (normalizedVehicleId) {
        await tx.vehicle.update({
          where: { id: normalizedVehicleId },
          data: { price: Math.trunc(normalizedPrice), description: resolvedVehicleDescription },
        })
      }
      return tx.listing.create({
        data: {
          title: normalizedTitle,
          description: resolvedVehicleDescription || null,
          price: Math.trunc(normalizedPrice),
          status: LISTING_STATUS.PENDING_MODERATION,
          lastStatusChangedAt: new Date(),
          userId: session.user.id,
          vehicleId: normalizedVehicleId,
          partId: normalizedPartId,
          statusEvents: {
            create: {
              toStatus: LISTING_STATUS.PENDING_MODERATION,
              actorId: session.user.id,
              reason: "Отправлено владельцем на модерацию",
            },
          },
        },
        include: {
          vehicle: true,
          part: true,
          user: { select: { id: true, name: true, image: true } },
        },
      })
    })

    return NextResponse.json(normalizeListing(listing), { status: 201 })
  } catch (error) {
    console.error("Error creating listing:", error)
    return NextResponse.json({ error: "Failed to create listing" }, { status: 500 })
  }
}
