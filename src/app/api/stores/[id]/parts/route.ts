import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

const PAGE_SIZE = 50

async function requireStore(storeId: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { error: NextResponse.json({ error: "Требуется вход" }, { status: 401 }) }

  const store = await prisma.partStore.findFirst({
    where: { id: storeId, ownerId: session.user.id },
    /* Настройки магазина нужны при создании позиции: незаполненные
       продавцом сроки, страна и город берутся отсюда — так же, как это
       делает импорт файла. */
    select: {
      id: true,
      ownerId: true,
      city: true,
      defaultLeadTimeDaysMin: true,
      defaultLeadTimeDaysMax: true,
      defaultOriginCountry: true,
    },
  })
  if (!store) return { error: NextResponse.json({ error: "Магазин не найден" }, { status: 404 }) }
  return { store }
}

/** Возвращает позиции магазина для правки владельцем. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const guard = await requireStore(id)
  if (guard.error) return guard.error

  const query = request.nextUrl.searchParams.get("q")?.trim().slice(0, 80) || ""
  const parts = await prisma.part.findMany({
    where: {
      storeId: guard.store.id,
      ...(query
        ? { OR: [{ name: { contains: query } }, { oemNumber: { contains: query } }, { brandName: { contains: query } }] }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE,
    select: {
      id: true, name: true, price: true, oemNumber: true, brandName: true, partType: true,
      condition: true, supplyMode: true, leadTimeDaysMin: true, leadTimeDaysMax: true,
      make: true, model: true, createdAt: true,
    },
  })

  return NextResponse.json({ parts })
}

/** Правит одну позицию: цену, срок или наличие. */
/**
 * Добавляет одну позицию в каталог магазина.
 *
 * Единственным способом наполнить каталог был импорт файла: продавец с
 * пятью деталями создавал магазин, видел «Позиций в каталоге: 0»,
 * упирался в заблокированную кнопку «Отправить на проверку» — и должен
 * был сверстать таблицу, чтобы продать одну колодку.
 *
 * Проверки те же, что при правке и при импорте: цена положительная,
 * сроки в днях от нуля до года, минимальный не больше максимального.
 * Незаполненное берётся из настроек магазина — так же, как это делает
 * импорт, чтобы позиции из разных источников выглядели одинаково.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const guard = await requireStore(id)
  if (guard.error) return guard.error

  const body = await request.json().catch(() => null)

  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 200) : ""
  if (!name) return NextResponse.json({ error: "Укажите название позиции" }, { status: 400 })

  const price = Number(body?.price)
  if (!Number.isFinite(price) || price <= 0 || price > 100_000_000) {
    return NextResponse.json({ error: "Цена должна быть положительным числом" }, { status: 400 })
  }

  const leadMin = body?.leadTimeDaysMin === undefined || body?.leadTimeDaysMin === null || body?.leadTimeDaysMin === ""
    ? null
    : Number(body.leadTimeDaysMin)
  const leadMax = body?.leadTimeDaysMax === undefined || body?.leadTimeDaysMax === null || body?.leadTimeDaysMax === ""
    ? null
    : Number(body.leadTimeDaysMax)
  if ((leadMin !== null && (!Number.isFinite(leadMin) || leadMin < 0 || leadMin > 365))
    || (leadMax !== null && (!Number.isFinite(leadMax) || leadMax < 0 || leadMax > 365))) {
    return NextResponse.json({ error: "Срок поставки указывается в днях, от 0 до 365" }, { status: 400 })
  }
  if (leadMin !== null && leadMax !== null && leadMin > leadMax) {
    return NextResponse.json({ error: "Минимальный срок не может быть больше максимального" }, { status: 400 })
  }

  const supplyMode = body?.supplyMode === "STOCK" ? "STOCK" : "ORDER"

  const part = await prisma.part.create({
    data: {
      userId: guard.store.ownerId,
      storeId: guard.store.id,
      name,
      price: Math.round(price),
      description: typeof body?.description === "string" ? body.description.trim().slice(0, 1_000) || null : null,
      condition: body?.condition === "USED" ? "USED" : "NEW",
      partType: typeof body?.partType === "string" && body.partType ? body.partType : "OTHER",
      oemNumber: typeof body?.oemNumber === "string" ? body.oemNumber.trim().slice(0, 64) || null : null,
      brandName: typeof body?.brandName === "string" ? body.brandName.trim().slice(0, 80) || null : null,
      /* Марка и модель обязательны у позиции, но продавец часто продаёт
         универсальную деталь. Импорт в таком случае пишет то же самое —
         пусть позиции из обоих источников выглядят одинаково. */
      make: typeof body?.make === "string" && body.make.trim() ? body.make.trim().slice(0, 60) : "Универсальная",
      model: typeof body?.model === "string" && body.model.trim() ? body.model.trim().slice(0, 60) : "—",
      supplyMode,
      /* Срок магазина подставляется, когда продавец его не указал:
         покупатель должен видеть срок у каждой позиции под заказ. */
      leadTimeDaysMin: leadMin ?? guard.store.defaultLeadTimeDaysMin,
      leadTimeDaysMax: leadMax ?? guard.store.defaultLeadTimeDaysMax,
      originCountry: guard.store.defaultOriginCountry,
      location: guard.store.city || "Уточняется",
      vehicleType: "CAR",
    },
    select: { id: true, name: true, price: true, supplyMode: true, leadTimeDaysMin: true, leadTimeDaysMax: true },
  })

  return NextResponse.json({ part }, { status: 201 })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const guard = await requireStore(id)
  if (guard.error) return guard.error

  const body = await request.json().catch(() => null)
  const partId = typeof body?.partId === "string" ? body.partId : ""
  if (!partId) return NextResponse.json({ error: "Позиция не указана" }, { status: 400 })

  // Позиция правится только внутри своего магазина: чужой каталог владельцу
  // недоступен даже по прямому идентификатору.
  const part = await prisma.part.findFirst({
    where: { id: partId, storeId: guard.store.id },
    select: { id: true },
  })
  if (!part) return NextResponse.json({ error: "Позиция не найдена" }, { status: 404 })

  const price = body?.price === undefined ? undefined : Number(body.price)
  if (price !== undefined && (!Number.isFinite(price) || price <= 0 || price > 100_000_000)) {
    return NextResponse.json({ error: "Цена должна быть положительным числом" }, { status: 400 })
  }

  const leadMin = body?.leadTimeDaysMin === undefined ? undefined : Number(body.leadTimeDaysMin)
  const leadMax = body?.leadTimeDaysMax === undefined ? undefined : Number(body.leadTimeDaysMax)
  if ((leadMin !== undefined && leadMin !== null && (!Number.isFinite(leadMin) || leadMin < 0 || leadMin > 365))
    || (leadMax !== undefined && leadMax !== null && (!Number.isFinite(leadMax) || leadMax < 0 || leadMax > 365))) {
    return NextResponse.json({ error: "Срок поставки указывается в днях, от 0 до 365" }, { status: 400 })
  }
  if (Number.isFinite(leadMin) && Number.isFinite(leadMax) && Number(leadMin) > Number(leadMax)) {
    return NextResponse.json({ error: "Минимальный срок не может быть больше максимального" }, { status: 400 })
  }

  const updated = await prisma.part.update({
    where: { id: partId },
    data: {
      ...(price !== undefined ? { price: Math.round(price) } : {}),
      ...(body?.name !== undefined ? { name: String(body.name).trim().slice(0, 200) } : {}),
      ...(body?.oemNumber !== undefined ? { oemNumber: String(body.oemNumber).trim().slice(0, 64) || null } : {}),
      ...(body?.supplyMode !== undefined ? { supplyMode: body.supplyMode === "STOCK" ? "STOCK" : "ORDER" } : {}),
      ...(leadMin !== undefined ? { leadTimeDaysMin: Number.isFinite(leadMin) ? Math.round(leadMin) : null } : {}),
      ...(leadMax !== undefined ? { leadTimeDaysMax: Number.isFinite(leadMax) ? Math.round(leadMax) : null } : {}),
    },
    select: { id: true, name: true, price: true, supplyMode: true, leadTimeDaysMin: true, leadTimeDaysMax: true },
  })

  return NextResponse.json({ part: updated })
}

/** Удаляет одну позицию из каталога магазина. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const guard = await requireStore(id)
  if (guard.error) return guard.error

  const partId = request.nextUrl.searchParams.get("partId")?.trim() || ""
  if (!partId) return NextResponse.json({ error: "Позиция не указана" }, { status: 400 })

  const removed = await prisma.part.deleteMany({ where: { id: partId, storeId: guard.store.id } })
  if (!removed.count) return NextResponse.json({ error: "Позиция не найдена" }, { status: 404 })

  return NextResponse.json({ removed: removed.count })
}
