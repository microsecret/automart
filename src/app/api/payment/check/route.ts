import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit"
import { reconcileSingleOrder } from "@/lib/promotion-reconcile"

export const dynamic = "force-dynamic"

/**
 * Проверка своей оплаты сразу после возвращения из кассы.
 *
 * Уведомление ЮKassa приходит за секунды, но не всегда: адрес в кабинете
 * кассы может быть не указан. Сверка по расписанию догонит за пять
 * минут — а человек стоит на странице прямо сейчас и смотрит, включилось
 * ли то, за что он заплатил. Пять минут перед неизменившимся экраном —
 * это человек, который ушёл и написал в поддержку.
 *
 * Спрашиваем кассу сразу. Свой заказ ищется по владельцу: чужой
 * идентификатор не должен вызывать обращений к кассе.
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Требуется вход" }, { status: 401 })

  /* Обращение к кассе стоит времени: без ограничения страницу можно было
     бы превратить в источник запросов к ЮKassa. */
  const limit = rateLimit(`payment-check:${session.user.id}:${getClientIp(request)}`, {
    windowMs: 60_000,
    maxRequests: 12,
  })
  if (!limit.success) {
    return NextResponse.json(
      { error: "Слишком часто. Подождите минуту." },
      { status: 429, headers: rateLimitHeaders(limit) },
    )
  }

  const body = await request.json().catch(() => null)
  const listingId = typeof body?.listingId === "string" ? body.listingId : null
  if (!listingId) return NextResponse.json({ error: "Не указано объявление" }, { status: 400 })
  const orderId = typeof body?.orderId === "string" ? body.orderId : null
  const order = await prisma.promotionOrder.findFirst({
    where: { ...(orderId ? { id: orderId } : {}), listingId, userId: session.user.id },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { id: true, listingId: true, userId: true, status: true, tariffId: true, provider: true, providerCheckoutId: true },
  })
  const status = order ? await reconcileSingleOrder(order) : "unknown"
  return NextResponse.json({ status }, { headers: rateLimitHeaders(limit) })
}
