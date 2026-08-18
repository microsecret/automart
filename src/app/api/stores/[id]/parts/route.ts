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
    select: { id: true },
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
