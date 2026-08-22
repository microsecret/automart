import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit"
import { LISTING_STATUS } from "@/lib/listing-lifecycle"
import { CONDITIONS, getSelectableFuelOptions, getSelectableTransmissionOptions, supportsTransmission } from "@/lib/constants"

export const dynamic = "force-dynamic"

// Полная форма подачи содержит четыре десятка полей. Для продавца, который
// хочет просто выставить машину, это заградительный барьер: он бросает форму
// на середине. Быстрая подача берёт только то, без чего объявление
// бессмысленно, а остальное владелец дополняет уже после публикации.

// Названия должны совпадать с записями в таблице категорий: расхождение
// ломает подачу целиком, потому что категория обязательна для объявления.
const CATEGORY_BY_VEHICLE_TYPE: Readonly<Record<string, string>> = {
  CAR: "Легковые автомобили",
  MOTORCYCLE: "Мототехника",
  TRUCK: "Грузовой транспорт",
  SPECIAL: "Спецтехника",
  WATER: "Водный транспорт",
  AIR: "Воздушный транспорт",
}

function readText(value: unknown, limit: number) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, limit) : ""
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Требуется вход" }, { status: 401 })

  const limit = rateLimit(`vehicle-quick:${session.user.id}`, { windowMs: 60 * 60 * 1_000, maxRequests: 15 })
  if (!limit.success) {
    return NextResponse.json(
      { error: "Слишком много объявлений подряд. Попробуйте позже." },
      { status: 429, headers: rateLimitHeaders(limit) },
    )
  }

  const body = await request.json().catch(() => null)
  const make = readText(body?.make, 60)
  const model = readText(body?.model, 60)
  const location = readText(body?.location, 120)
  const description = readText(body?.description, 2_000) || null
  const year = Number(body?.year)
  const price = Number(body?.price)
  const mileage = body?.mileage === undefined || body?.mileage === null || body?.mileage === "" ? null : Number(body.mileage)
  const vehicleType = typeof body?.vehicleType === "string" && CATEGORY_BY_VEHICLE_TYPE[body.vehicleType] ? body.vehicleType : "CAR"
  const images = Array.isArray(body?.images)
    ? body.images.filter((value: unknown): value is string => typeof value === "string" && value.length < 2_000).slice(0, 12)
    : []

  const currentYear = new Date().getFullYear()
  if (!make) return NextResponse.json({ error: "Укажите марку" }, { status: 400 })
  if (!model) return NextResponse.json({ error: "Укажите модель" }, { status: 400 })
  if (!Number.isInteger(year) || year < 1886 || year > currentYear + 1) {
    return NextResponse.json({ error: `Год выпуска — от 1886 до ${currentYear + 1}` }, { status: 400 })
  }
  if (!Number.isSafeInteger(price) || price <= 0) {
    return NextResponse.json({ error: "Укажите цену в рублях" }, { status: 400 })
  }
  if (!location) return NextResponse.json({ error: "Укажите город" }, { status: 400 })
  // Объявление без фотографий покупателю бесполезно: он не может оценить
  // состояние и уходит, а карточка занимает место в каталоге.
  if (!images.length) {
    return NextResponse.json({ error: "Добавьте хотя бы одну фотографию" }, { status: 400 })
  }
  if (mileage !== null && (!Number.isFinite(mileage) || mileage < 0 || mileage > 2_000_000)) {
    return NextResponse.json({ error: "Проверьте пробег" }, { status: 400 })
  }

  /* Главные характеристики обязательны.

     Раньше топливо и коробка подставлялись значением «OTHER», а состояние —
     «GOOD». В карточке это выглядело как «КПП Другая», «Топливо Другое»:
     покупатель видел объявление, где из характеристик заполнены только год
     и цена. У пяти из шести активных объявлений было именно так.

     Полная форма подачи запрещает «OTHER» с тем же обоснованием — здесь та
     же проверка, чтобы быстрая подача не оставалась лазейкой. */
  const fuelType = readText(body?.fuelType, 20)
  const transmission = readText(body?.transmission, 20)
  const condition = readText(body?.condition, 20)

  const allowedFuel = getSelectableFuelOptions(vehicleType).map((option) => option.value)
  if (!fuelType || !allowedFuel.includes(fuelType)) {
    return NextResponse.json({ error: "Укажите тип топлива" }, { status: 400 })
  }

  if (supportsTransmission(vehicleType)) {
    const allowedTransmission = getSelectableTransmissionOptions(vehicleType).map((option) => option.value)
    if (!transmission || !allowedTransmission.includes(transmission)) {
      return NextResponse.json({ error: "Укажите коробку передач" }, { status: 400 })
    }
  }

  if (!condition || !CONDITIONS.some((option) => option.value === condition)) {
    return NextResponse.json({ error: "Укажите состояние" }, { status: 400 })
  }

  // Пробег обязателен у техники, у которой он есть: по машине без пробега
  // решение не принимают.
  if (["CAR", "MOTORCYCLE", "TRUCK"].includes(vehicleType) && mileage === null) {
    return NextResponse.json({ error: "Укажите пробег" }, { status: 400 })
  }

  // Категория подбирается по типу транспорта: спрашивать её у продавца
  // отдельно незачем, он уже выбрал, что размещает.
  const categoryName = CATEGORY_BY_VEHICLE_TYPE[vehicleType]
  const category = await prisma.category.findFirst({
    where: { name: categoryName },
    select: { id: true },
  })
    // Названия категорий редактируются администратором, поэтому точное
    // совпадение может пропасть: запасной поиск по началу строки не даёт
    // подаче упасть из-за переименования.
    || await prisma.category.findFirst({
      where: { name: { startsWith: categoryName.split(" ")[0] } },
      select: { id: true },
    })
  if (!category) {
    return NextResponse.json({ error: "Категория транспорта недоступна. Обратитесь в поддержку." }, { status: 503 })
  }

  const title = `${year} ${make} ${model}`.trim().slice(0, 200)

  // Транспорт и объявление создаются вместе: карточка без объявления не
  // попадёт на модерацию и потеряется в кабинете.
  const vehicle = await prisma.vehicle.create({
    data: {
      make,
      model,
      year,
      price,
      mileage,
      fuelType,
      transmission: supportsTransmission(vehicleType) ? transmission : "OTHER",
      condition,
      vehicleType,
      location,
      description,
      images: images.length ? JSON.stringify(images) : null,
      userId: session.user.id,
      categoryId: category.id,
      listings: {
        create: {
          title,
          description,
          price,
          status: LISTING_STATUS.PENDING_MODERATION,
          userId: session.user.id,
        },
      },
    },
    include: { listings: { select: { id: true } } },
  })

  return NextResponse.json({
    vehicleId: vehicle.id,
    listingId: vehicle.listings[0]?.id || null,
    // Продавцу нужно знать, что объявление ещё не в каталоге.
    status: LISTING_STATUS.PENDING_MODERATION,
  }, { status: 201 })
}
