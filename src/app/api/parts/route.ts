import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { containsAnyCase } from "@/lib/search-terms"
import { prisma } from "@/lib/prisma"
import { LISTING_STATUS, publicListingWhere } from "@/lib/listing-lifecycle"
import { Prisma } from "@prisma/client"
import { PART_AVAILABILITY_TYPES, PART_CONDITIONS, PART_SUBCATEGORIES, PART_TYPES, SELLER_TYPES } from "@/lib/constants"
import { parseMarketplaceImages } from "@/lib/media-url"
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

const PART_TYPE_VALUES = new Set<string>(PART_TYPES.map((item) => item.value))
const PART_CONDITION_VALUES = new Set<string>(PART_CONDITIONS.map((item) => item.value))
const AVAILABILITY_VALUES = new Set<string>(PART_AVAILABILITY_TYPES.map((item) => item.value))
const SELLER_TYPE_VALUES = new Set<string>(SELLER_TYPES.map((item) => item.value))
const currentYear = new Date().getFullYear()

function normalizeOem(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9А-ЯЁ]/g, "")
}

function parsePartYear(value: unknown) {
  if (value === null || value === undefined || value === "") return null
  const year = Number.parseInt(String(value), 10)
  return Number.isInteger(year) && year >= 1886 && year <= currentYear + 1 ? year : null
}

function parseFilterValues(...values: Array<string | null>) {
  return Array.from(new Set(values.flatMap((value) => (value || "").split(",").map((item) => item.trim()).filter(Boolean))))
}

function normalizeOptionalText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null
  const normalized = value.trim().replace(/\s+/g, " ")
  return normalized ? normalized.slice(0, maxLength) : null
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
    // `condition` is kept for old links; new filter controls can select several values.
    const conditions = parseFilterValues(sp.get("conditions"), sp.get("condition"))
    const availability = parseFilterValues(sp.get("availability"))
    const saleFormat = sp.get("saleFormat")
    const oemNumber = sp.get("oemNumber")
    const sort = sp.get("sort") || "newest"

    // A Part is publicly visible only through an active, non-deleted Listing.
    // The nested relation keeps drafts and records awaiting moderation out of
    // catalog search even though their Part row already exists for the owner.
    // Позиция публична двумя путями: как частное объявление, прошедшее
    // модерацию, и как товар опубликованного магазина. Товары витрины
    // объявления не создают, поэтому без второго условия каталог их не
    // показывал и поиск по артикулу ничего не находил.
    const where: Prisma.PartWhereInput = {
      OR: [
        { listings: { some: publicListingWhere } },
        { store: { status: "ACTIVE" } },
      ],
    }
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
    if (subcategory && (!partType || !(PART_SUBCATEGORIES[partType] || []).includes(subcategory))) {
      return NextResponse.json({ error: "Подкатегория не соответствует выбранной категории" }, { status: 400 })
    }
    if (conditions.some((condition) => !PART_CONDITION_VALUES.has(condition))) {
      return NextResponse.json({ error: "Неизвестное состояние запчасти" }, { status: 400 })
    }
    if (availability.some((item) => !AVAILABILITY_VALUES.has(item))) {
      return NextResponse.json({ error: "Неизвестный статус наличия" }, { status: 400 })
    }
    if (saleFormat && saleFormat !== "FIXED" && saleFormat !== "AUCTION") {
      return NextResponse.json({ error: "Неизвестный формат продажи" }, { status: 400 })
    }

    if (q) {
      const normalizedQuery = normalizeOem(q)
      and.push({
        /* Без учёта регистра: в SQLite LIKE игнорирует регистр только для
           латиницы, поэтому «фара» не находила «Фара». Номера OEM уже
           приводятся к общему виду отдельно — им развороты не нужны. */
        OR: [
          ...containsAnyCase("name", q),
          ...containsAnyCase("description", q),
          ...containsAnyCase("keywords", q),
          { oemNumber: { contains: q } },
          ...(normalizedQuery ? [{ crossReferences: { some: { normalizedNumber: { contains: normalizedQuery } } } }] : []),
          { compatibility: { some: { OR: [...containsAnyCase("make", q), ...containsAnyCase("model", q)] } } },
        ] as Prisma.PartWhereInput["OR"],
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
    if (conditions.length) {
      const conditionValues = new Set(conditions)
      // Поддерживаем неочищенные архивные записи до применения миграции.
      if (conditionValues.has("USED")) ["LIKE_NEW", "EXCELLENT", "GOOD", "FAIR", "POOR"].forEach((item) => conditionValues.add(item))
      where.condition = { in: Array.from(conditionValues) }
    }
    // У старых записей availability не заполнялся: считаем их доступными,
    // не скрывая каталог при выборе «В наличии».
    if (availability.length) {
      const availabilityValues = new Set(availability)
      if (availabilityValues.has("IN_STOCK")) {
        and.push({ OR: [{ availability: { in: Array.from(availabilityValues) } }, { availability: null }] })
      } else {
        where.availability = { in: Array.from(availabilityValues) }
      }
    }
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

    /* Второй ключ — идентификатор: без него порядок между записями с
       одинаковой ценой или датой не определён, и они повторяются или
       пропадают на границе страниц. */
    const primaryOrderBy: Prisma.PartOrderByWithRelationInput =
      sort === "price_asc" ? { price: "asc" }
      : sort === "price_desc" ? { price: "desc" }
      : { createdAt: "desc" }

    const orderBy: Prisma.PartOrderByWithRelationInput[] = [primaryOrderBy, { id: "desc" }]

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
      parts: parts.map((part) => ({ ...part, availability: part.availability || "IN_STOCK" })),
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
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const limit = rateLimit(`part:create:user:${session.user.id}:ip:${getClientIp(request)}`, { windowMs: 60 * 60_000, maxRequests: 20 })
    if (!limit.success) return NextResponse.json({ error: "Слишком много объявлений. Повторите позже." }, { status: 429, headers: rateLimitHeaders(limit) })

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 })
    const { name, description, price, condition, partType, make, model, yearFrom, yearTo, location, images, subcategory, oemNumber, crossNumbers, suspensionType, brakeType, compatibility, sellerType, availability, saleFormat, auctionEndsAt, auctionStartPrice, auctionMinStep } = body as Record<string, unknown>

    const normalizedName = typeof name === "string" ? name.trim() : ""
    const normalizedDescription = normalizeOptionalText(description, 10_000)
    const normalizedPartType = typeof partType === "string" ? partType : "OTHER"
    const normalizedSubcategory = normalizeOptionalText(subcategory, 100)
    const normalizedMake = normalizeOptionalText(make, 80) || "Universal"
    const normalizedModel = normalizeOptionalText(model, 100) || "Universal"
    const normalizedLocation = normalizeOptionalText(location, 160) || "Москва"
    const normalizedOemNumber = normalizeOptionalText(oemNumber, 80)
    if (normalizedName.length < 2 || normalizedName.length > 200) return NextResponse.json({ error: "Название запчасти должно содержать от 2 до 200 символов" }, { status: 400 })
    const normalizedPrice = Math.trunc(Number(price))
    if (!Number.isFinite(normalizedPrice) || normalizedPrice < 0) return NextResponse.json({ error: "Укажите корректную цену" }, { status: 400 })
    if (!PART_TYPE_VALUES.has(normalizedPartType)) return NextResponse.json({ error: "Неизвестная категория запчасти" }, { status: 400 })
    if (normalizedSubcategory && !(PART_SUBCATEGORIES[normalizedPartType] || []).includes(normalizedSubcategory)) return NextResponse.json({ error: "Подкатегория не соответствует выбранному типу запчасти" }, { status: 400 })
    const normalizedImages = parseMarketplaceImages(images)
    if (!normalizedImages) return NextResponse.json({ error: "Допустимы до 12 корректных изображений" }, { status: 400 })

    const normalizedCondition = typeof condition === "string" ? condition : "USED"
    const normalizedAvailability = typeof availability === "string" ? availability : "IN_STOCK"
    const normalizedSellerType = typeof sellerType === "string" ? sellerType : "OWNER"
    if (!PART_CONDITION_VALUES.has(normalizedCondition)) return NextResponse.json({ error: "Неизвестное состояние запчасти" }, { status: 400 })
    if (!AVAILABILITY_VALUES.has(normalizedAvailability)) return NextResponse.json({ error: "Неизвестный статус наличия" }, { status: 400 })
    if (!SELLER_TYPE_VALUES.has(normalizedSellerType)) return NextResponse.json({ error: "Неизвестный тип продавца" }, { status: 400 })

    const parsedYearFrom = parsePartYear(yearFrom)
    const parsedYearTo = parsePartYear(yearTo)
    if ((yearFrom !== null && yearFrom !== undefined && yearFrom !== "" && parsedYearFrom === null) || (yearTo !== null && yearTo !== undefined && yearTo !== "" && parsedYearTo === null) || (parsedYearFrom !== null && parsedYearTo !== null && parsedYearFrom > parsedYearTo)) {
      return NextResponse.json({ error: "Проверьте диапазон годов применимости" }, { status: 400 })
    }

    const normalizedCrossNumbers = Array.from(new Set((Array.isArray(crossNumbers) ? crossNumbers : [])
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter((value) => value.length > 0 && value.length <= 80 && normalizeOem(value).length > 0)
      .slice(0, 40)))

    const normalizedSaleFormat = saleFormat === "AUCTION" ? "AUCTION" : "FIXED"
    const parsedEnd = typeof auctionEndsAt === "string" && auctionEndsAt.length <= 64 ? new Date(auctionEndsAt) : null
    if (normalizedSaleFormat === "AUCTION" && (!parsedEnd || Number.isNaN(parsedEnd.getTime()) || parsedEnd <= new Date())) {
      return NextResponse.json({ error: "Для аукциона укажите дату окончания в будущем" }, { status: 400 })
    }
    const startPrice = normalizedSaleFormat === "AUCTION" ? Math.trunc(Number(auctionStartPrice || price)) : null
    const minStep = normalizedSaleFormat === "AUCTION" ? Math.trunc(Number(auctionMinStep || Math.max(100, normalizedPrice * 0.01))) : null
    const hasValidAuctionPricing = typeof startPrice === "number"
      && typeof minStep === "number"
      && Number.isSafeInteger(startPrice)
      && Number.isSafeInteger(minStep)
      && startPrice >= 1
      && minStep >= 1
      && minStep <= startPrice
    if (normalizedSaleFormat === "AUCTION" && !hasValidAuctionPricing) {
      return NextResponse.json({ error: "Проверьте стартовую цену и шаг ставки" }, { status: 400 })
    }

    const normalizedCompatibility = Array.from(new Map((Array.isArray(compatibility) ? compatibility : [])
      .slice(0, 30)
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
      .map((item) => {
        const compatibleMake = typeof item.make === "string" ? item.make.trim() : ""
        const compatibleModel = typeof item.model === "string" ? item.model.trim() : ""
        const compatibleGeneration = typeof item.generation === "string" ? item.generation.trim() : ""
        const compatibleEngine = typeof item.engine === "string" ? item.engine.trim() : ""
        const compatibleYearFrom = item.yearFrom ? Number.parseInt(String(item.yearFrom), 10) : null
        const compatibleYearTo = item.yearTo ? Number.parseInt(String(item.yearTo), 10) : null
        if (!compatibleMake) return null
        if ((compatibleYearFrom !== null && !Number.isFinite(compatibleYearFrom)) || (compatibleYearTo !== null && !Number.isFinite(compatibleYearTo)) || (compatibleYearFrom !== null && compatibleYearTo !== null && compatibleYearFrom > compatibleYearTo)) return null
        return { make: compatibleMake.slice(0, 80), model: (compatibleModel || "Все модели").slice(0, 100), generation: compatibleGeneration.slice(0, 100) || null, engine: compatibleEngine.slice(0, 100) || null, yearFrom: compatibleYearFrom, yearTo: compatibleYearTo }
      })
      .filter((item): item is { make: string; model: string; generation: string | null; engine: string | null; yearFrom: number | null; yearTo: number | null } => item !== null)
      .map((item) => [`${item.make}|${item.model}|${item.generation || ""}|${item.engine || ""}|${item.yearFrom || ""}|${item.yearTo || ""}`, item])).values())

    const part = await prisma.part.create({
      data: {
        name: normalizedName,
        description: normalizedDescription,
        price: normalizedSaleFormat === "AUCTION" ? startPrice! : normalizedPrice,
        condition: normalizedCondition,
        sellerType: normalizedSellerType,
        availability: normalizedAvailability,
        saleFormat: normalizedSaleFormat,
        auctionStatus: normalizedSaleFormat === "AUCTION" ? "ACTIVE" : "NONE",
        auctionEndsAt: normalizedSaleFormat === "AUCTION" ? parsedEnd : null,
        auctionStartPrice: startPrice,
        auctionCurrentPrice: startPrice,
        auctionMinStep: minStep,
        partType: normalizedPartType,
        make: normalizedMake,
        model: normalizedModel,
        yearFrom: parsedYearFrom,
        yearTo: parsedYearTo,
        location: normalizedLocation,
        images: normalizedImages.length ? JSON.stringify(normalizedImages) : null,
        subcategory: normalizedSubcategory,
        oemNumber: normalizedOemNumber,
        suspensionType: normalizeOptionalText(suspensionType, 80),
        brakeType: normalizeOptionalText(brakeType, 80),
        crossReferences: normalizedCrossNumbers.length > 0 ? {
          create: normalizedCrossNumbers.map((number) => ({ number, normalizedNumber: normalizeOem(number) })),
        } : undefined,
        compatibility: normalizedCompatibility.length > 0 ? {
          create: normalizedCompatibility.map((item) => ({
            make: item.make,
            model: item.model,
            generation: item.generation,
            yearFrom: item.yearFrom,
            yearTo: item.yearTo,
            engine: item.engine,
          }))
        } : undefined,
        userId: session.user.id,
        // A part must have the same marketplace lifecycle as a vehicle. The
        // nested write keeps the part and its moderation record atomic.
        listings: {
          create: {
            title: normalizedName,
            description: normalizedDescription,
            price: normalizedSaleFormat === "AUCTION" ? startPrice! : normalizedPrice,
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
      include: { compatibility: true, crossReferences: true, listings: { select: { id: true, status: true } } },
    })

    return NextResponse.json(part, { status: 201 })
  } catch (error) {
    console.error("Parts POST error:", error)
    return NextResponse.json({ error: "Failed to create part" }, { status: 500 })
  }
}
