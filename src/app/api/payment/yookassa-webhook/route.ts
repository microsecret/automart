import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { applyYookassaPromotionPayment } from "@/lib/promotion-reconcile"
import { fetchYookassaPayment, paymentIdFromWebhook, yookassaConfig } from "@/lib/yookassa"

export const dynamic = "force-dynamic"

/**
 * Уведомления ЮKassa о платежах.
 *
 * Уведомления ЮKassa не подписаны, поэтому им не верим: из тела берём
 * только id платежа, а сам платёж перечитываем напрямую из API кассы.
 * Подделанное уведомление в худшем случае заставит нас лишний раз
 * спросить API — активировать чужое продвижение оно не может.
 */
export async function POST(request: NextRequest) {
  const config = yookassaConfig()
  if (!config) return NextResponse.json({ error: "Касса не подключена" }, { status: 503 })

  const body = await request.json().catch(() => null)
  const paymentId = paymentIdFromWebhook(body)
  /* Непонятное уведомление подтверждаем с 200: иначе ЮKassa будет слать
     его повторно, а полезного в повторах ничего нет. */
  if (!paymentId) return NextResponse.json({ received: true })

  try {
    const payment = await fetchYookassaPayment(config, paymentId)

    const order = await prisma.promotionOrder.findFirst({
      where: { provider: "YOOKASSA", providerCheckoutId: payment.id },
      select: { id: true, listingId: true, userId: true, tariffId: true, providerCheckoutId: true },
    })
    if (order) {
      await applyYookassaPromotionPayment(order, payment)
    } else if (payment.metadata?.orderId) {
      // A notification can arrive before the checkout route saves its ID.
      const creating = await prisma.promotionOrder.findFirst({
        where: {
          id: payment.metadata.orderId, provider: "YOOKASSA", providerCheckoutId: null, status: "PENDING",
          listingId: payment.metadata.listingId || "", userId: payment.metadata.userId || "",
        },
        select: { id: true },
      })
      if (creating) return NextResponse.json({ error: "Заказ ещё создаётся" }, { status: 503 })
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error("Ошибка обработки уведомления ЮKassa:", error)
    /* 500 — чтобы ЮKassa повторила уведомление позже: сбой сети между
       нами и API кассы не должен терять оплату. */
    return NextResponse.json({ error: "Обработка не удалась" }, { status: 500 })
  }
}
