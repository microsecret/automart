import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notifyBuyerAboutOrderStatus } from "@/lib/part-order-notify"

export const dynamic = "force-dynamic"

// Заказ движется от обращения к завершённой сделке. Отменить можно на любом
// шаге до завершения, а вернуть завершённый заказ в работу нельзя: это
// исказило бы историю магазина.
const ALLOWED_TRANSITIONS: Readonly<Record<string, readonly string[]>> = {
  NEW: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["IN_DELIVERY", "CANCELLED"],
  IN_DELIVERY: ["DONE", "CANCELLED"],
  DONE: [],
  CANCELLED: [],
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Требуется вход" }, { status: 401 })

  const order = await prisma.partOrder.findUnique({
    where: { id },
    select: { id: true, status: true, store: { select: { ownerId: true } } },
  })
  if (!order || order.store.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Заказ не найден" }, { status: 404 })
  }

  const body = await request.json().catch(() => null)
  const nextStatus = typeof body?.status === "string" ? body.status : null
  const sellerNotes = typeof body?.sellerNotes === "string" ? body.sellerNotes.trim().slice(0, 1_000) : undefined
  const statusReason = typeof body?.statusReason === "string" ? body.statusReason.trim().replace(/\s+/g, " ").slice(0, 500) : null

  if (!nextStatus) {
    if (sellerNotes === undefined) return NextResponse.json({ error: "Нечего сохранять" }, { status: 400 })
    const updated = await prisma.partOrder.update({
      where: { id },
      data: { sellerNotes: sellerNotes || null },
      select: { id: true, sellerNotes: true },
    })
    return NextResponse.json({ order: updated })
  }

  const allowed = ALLOWED_TRANSITIONS[order.status] || []
  if (!allowed.includes(nextStatus)) {
    return NextResponse.json({ error: "Такой переход статуса недоступен" }, { status: 409 })
  }
  // Отмена без причины оставляет покупателя без объяснения, поэтому она
  // обязательна именно здесь, а не на каждом переходе.
  if (nextStatus === "CANCELLED" && !statusReason) {
    return NextResponse.json({ error: "Укажите причину отмены" }, { status: 400 })
  }

  const updated = await prisma.partOrder.update({
    where: { id },
    data: {
      status: nextStatus,
      statusReason: nextStatus === "CANCELLED" ? statusReason : null,
      ...(sellerNotes !== undefined ? { sellerNotes: sellerNotes || null } : {}),
    },
    select: { id: true, status: true, statusReason: true, sellerNotes: true },
  })

  // Покупатель узнаёт о продвижении заказа сразу, а не при следующем визите.
  await notifyBuyerAboutOrderStatus(id, nextStatus, statusReason)

  return NextResponse.json({ order: updated })
}
