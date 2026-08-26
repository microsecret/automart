import { NextRequest, NextResponse } from "next/server"
import { getPromotionTariff } from "@/lib/promotion-tariffs"
import { activatePaidPromotion, markPromotionOrderFailed } from "@/lib/promotion-activation"
import { fetchYookassaPayment, paymentIdFromWebhook, paymentMatchesAmount, yookassaConfig } from "@/lib/yookassa"

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

    const orderId = payment.metadata?.orderId
    const listingId = payment.metadata?.listingId
    const userId = payment.metadata?.userId
    const tariff = getPromotionTariff(payment.metadata?.promotionType)

    if (!orderId || !listingId || !userId || !tariff) {
      console.error(`Платёж ЮKassa ${payment.id} без метаданных продвижения`)
      return NextResponse.json({ received: true })
    }

    if (payment.status === "canceled") {
      await markPromotionOrderFailed(orderId, "FAILED")
      return NextResponse.json({ received: true })
    }

    if (payment.status !== "succeeded" || !payment.paid) {
      return NextResponse.json({ received: true })
    }

    /* Сумма сверяется до копейки: платёж на 1 ₽ с чужими метаданными не
       должен активировать тариф за 3990. */
    if (!paymentMatchesAmount(payment, tariff.amountRub)) {
      console.error(`Платёж ЮKassa ${payment.id}: сумма не совпадает с тарифом ${tariff.id}`)
      return NextResponse.json({ received: true })
    }

    await activatePaidPromotion({
      orderId,
      listingId,
      userId,
      tariff,
      providerPaymentId: payment.id,
      paymentCreatedAt: new Date(payment.created_at),
    })

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error("Ошибка обработки уведомления ЮKassa:", error)
    /* 500 — чтобы ЮKassa повторила уведомление позже: сбой сети между
       нами и API кассы не должен терять оплату. */
    return NextResponse.json({ error: "Обработка не удалась" }, { status: 500 })
  }
}
