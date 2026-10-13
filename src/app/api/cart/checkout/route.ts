import { NextRequest, NextResponse } from "next/server"
import { createHash, randomUUID } from "node:crypto"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit"
import { notifyStoreOwnerAboutCheckout } from "@/lib/part-order-notify"

export const dynamic = "force-dynamic"

const MAX_ITEMS = 50
const MAX_QUANTITY = 999

const readText = (value: unknown, limit: number) =>
  typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, limit) : ""

/**
 * Оформление корзины: позиции разных магазинов одним действием.
 *
 * Каждый магазин получает свои заказы — по одному на позицию, как при
 * заказе с карточки, — и одно сводное уведомление. Общий номер
 * оформления связывает их для покупателя.
 *
 * Цена берётся из базы, а не из браузера: корзина помнит цену на момент
 * добавления. Если цена изменилась, оформление не проходит молча —
 * покупатель получает новые цены и подтверждает их ещё раз.
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const buyerId = session?.user?.id || null
  const ip = getClientIp(request)

  const limit = rateLimit(`cart-checkout:${buyerId || ip}`, buyerId
    ? { windowMs: 60 * 60_000, maxRequests: 15 }
    : { windowMs: 60 * 60_000, maxRequests: 5 })
  if (!limit.success) {
    return NextResponse.json({ error: "Слишком много заказов подряд. Попробуйте позже." }, { status: 429, headers: rateLimitHeaders(limit) })
  }

  const body = await request.json().catch(() => null)
  const contactName = readText(body?.contactName, 120)
  const contactPhone = readText(body?.contactPhone, 40)
  const contactEmail = readText(body?.contactEmail, 120) || null
  const city = readText(body?.city, 80) || null
  const comment = readText(body?.comment, 1_000) || null

  const fieldErrors: Record<string, string> = {}
  if (contactName.length < 2) fieldErrors.contactName = "Укажите имя"
  if (contactPhone.replace(/\D/g, "").length < 10) fieldErrors.contactPhone = "Телефон для связи с магазином"
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) fieldErrors.contactEmail = "Проверьте адрес почты"
  if (Object.keys(fieldErrors).length) return NextResponse.json({ error: Object.values(fieldErrors)[0], fieldErrors }, { status: 422 })

  const rawItems = Array.isArray(body?.items) ? (body.items as Array<Record<string, unknown>>).slice(0, MAX_ITEMS) : []
  const wanted = new Map<string, { quantity: number; seenPrice: number | null }>()
  for (const item of rawItems) {
    const partId = typeof item?.partId === "string" ? item.partId.slice(0, 64) : ""
    const quantity = Number(item?.quantity)
    if (!partId || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) continue
    wanted.set(partId, { quantity, seenPrice: Number.isFinite(Number(item?.price)) ? Number(item.price) : null })
  }
  if (!wanted.size) return NextResponse.json({ error: "Корзина пуста" }, { status: 400 })

  const parts = await prisma.part.findMany({
    where: { id: { in: [...wanted.keys()] }, store: { status: "ACTIVE" } },
    select: {
      id: true, name: true, price: true, oemNumber: true, leadTimeDaysMin: true, leadTimeDaysMax: true,
      store: { select: { id: true, name: true } },
    },
  })
  const unavailable = [...wanted.keys()].filter((id) => !parts.some((part) => part.id === id))
  if (unavailable.length) {
    return NextResponse.json({ error: "Часть позиций больше не продаётся — уберите их из корзины", unavailable }, { status: 409 })
  }
  const changed = parts
    .filter((part) => {
      const seen = wanted.get(part.id)?.seenPrice
      return seen !== null && seen !== undefined && seen !== part.price
    })
    .map((part) => ({ partId: part.id, price: part.price }))
  if (changed.length) {
    return NextResponse.json({ error: "Цены изменились — проверьте корзину и оформите ещё раз", priceChanged: changed }, { status: 409 })
  }

  const checkoutId = randomUUID()
  const ipHash = createHash("sha256").update(`part-order:${ip}`).digest("hex").slice(0, 32)
  const created = await prisma.$transaction(parts.map((part) => prisma.partOrder.create({
    data: {
      storeId: part.store!.id,
      partId: part.id,
      buyerId,
      contactName, contactPhone, contactEmail, city, comment,
      quantity: wanted.get(part.id)!.quantity,
      itemName: part.name,
      itemPriceRub: part.price,
      itemOemNumber: part.oemNumber,
      leadTimeDaysMin: part.leadTimeDaysMin,
      leadTimeDaysMax: part.leadTimeDaysMax,
      ipHash,
      checkoutId,
    },
    select: { id: true, storeId: true, itemName: true, itemPriceRub: true, quantity: true },
  })))

  const byStore = new Map<string, { storeName: string; orders: typeof created }>()
  for (const order of created) {
    const storeName = parts.find((part) => part.store?.id === order.storeId)?.store?.name ?? ""
    const group = byStore.get(order.storeId) ?? { storeName, orders: [] }
    group.orders.push(order)
    byStore.set(order.storeId, group)
  }

  /* Уведомления — после записи заказов и параллельно: сбой Telegram у
     одного магазина не задерживает остальных и не отменяет заказ. */
  await Promise.all([...byStore.entries()].map(([storeId, group]) => notifyStoreOwnerAboutCheckout({
    orderId: group.orders[0].id,
    storeId,
    items: group.orders.map((order) => ({ itemName: order.itemName, quantity: order.quantity, itemPriceRub: order.itemPriceRub })),
    contactName, contactPhone, city, comment,
  })))

  return NextResponse.json({
    checkoutId,
    stores: [...byStore.entries()].map(([storeId, group]) => ({
      storeId,
      storeName: group.storeName,
      orders: group.orders.length,
      total: group.orders.reduce((sum, order) => sum + order.itemPriceRub * order.quantity, 0),
    })),
  }, { status: 201 })
}
