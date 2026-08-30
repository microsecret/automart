import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notifyBuyerAboutOrderStatus, notifyStoreOwnerAboutCancellation } from "@/lib/part-order-notify"

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
    select: { id: true, status: true, buyerId: true, store: { select: { ownerId: true } } },
  })
  if (!order) return NextResponse.json({ error: "Заказ не найден" }, { status: 404 })

  /* Заказ ведёт продавец, но отменить его может и покупатель.

     Раньше проверка пропускала только владельца магазина, и покупатель
     получал «Заказ не найден» на собственный заказ. Передумал, нашёл
     дешевле, ошибся с количеством — оставалось звонить в магазин и
     просить отменить, а пока продавец не нажмёт кнопку, заказ висел в
     «Отправлен» бесконечно.

     Покупателю доступна только отмена и только пока заказ не уехал:
     остальные переходы описывают работу магазина, и распоряжаться ими
     он не может. */
  const isSeller = order.store.ownerId === session.user.id
  const isBuyer = Boolean(order.buyerId) && order.buyerId === session.user.id
  if (!isSeller && !isBuyer) {
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

  /* Покупателю доступна отмена, и только до отправки: после неё товар
     уже в пути, и решение остаётся за магазином. */
  if (!isSeller) {
    if (nextStatus !== "CANCELLED") {
      return NextResponse.json({ error: "Статус заказа меняет магазин" }, { status: 403 })
    }
    if (order.status !== "NEW" && order.status !== "CONFIRMED") {
      return NextResponse.json({ error: "Заказ уже в доставке — отмену согласуйте с магазином" }, { status: 409 })
    }
    if (sellerNotes !== undefined) {
      return NextResponse.json({ error: "Заметку продавца меняет магазин" }, { status: 403 })
    }
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
      /* Причина не стирается на обычных переходах.

         Здесь стояло `: null` — и подтверждение заказа затирало
         пояснение, которое продавец написал раньше. Причина пишется
         только там, где она есть, а отмена без неё не проходит
         проверкой выше. */
      ...(nextStatus === "CANCELLED" ? { statusReason } : {}),
      ...(sellerNotes !== undefined ? { sellerNotes: sellerNotes || null } : {}),
    },
    select: { id: true, status: true, statusReason: true, sellerNotes: true },
  })

  /* Кому сообщать, зависит от того, кто менял.

     Продавец двигает заказ — узнаёт покупатель. Покупатель отменяет —
     узнаёт магазин: иначе он соберёт посылку по отменённой заявке. */
  if (isSeller) {
    await notifyBuyerAboutOrderStatus(id, nextStatus, statusReason)
  } else {
    await notifyStoreOwnerAboutCancellation(id, statusReason)
  }

  return NextResponse.json({ order: updated })
}
