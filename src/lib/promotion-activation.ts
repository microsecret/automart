/**
 * Активация оплаченного продвижения.
 *
 * Логика вынесена из обработчика Stripe без изменений, потому что она
 * не зависит от кассы: проверить заказ, пометить оплату, включить тариф
 * на объявлении, известить продавца. Касс стало две (Stripe и ЮKassa),
 * и держать два экземпляра этих проверок значит однажды исправить
 * ошибку только в одном.
 */

import { prisma } from "@/lib/prisma"
import { LISTING_STATUS } from "@/lib/listing-lifecycle"
import type { PromotionTariff } from "@/lib/promotion-tariffs"
import { accrueReferralReward } from "@/lib/referral-accrual"

export type PromotionPaymentInput = {
  orderId: string
  listingId: string
  userId: string
  tariff: PromotionTariff
  /** Идентификатор платежа у кассы. */
  providerPaymentId: string
  /**
   * Момент создания платежа по данным кассы — неизменяемый якорь срока.
   * Повторно присланное уведомление не может продлить продвижение.
   */
  paymentCreatedAt: Date
}

export type ActivationResult = "activated" | "already_active" | "order_mismatch" | "listing_inactive"

/**
 * Активирует продвижение по подтверждённому платежу.
 *
 * Вызывающий обязан сам убедиться, что платёж настоящий и сумма
 * совпадает с тарифом: здесь проверяется только соответствие заказу.
 */
export async function activatePaidPromotion(input: PromotionPaymentInput): Promise<ActivationResult> {
  const { orderId, listingId, userId, tariff, providerPaymentId, paymentCreatedAt } = input

  const order = await prisma.promotionOrder.findUnique({ where: { id: orderId } })
  if (
    !order
    || order.listingId !== listingId
    || order.userId !== userId
    || order.tariffId !== tariff.id
    || order.amountRub !== tariff.amountRub
    || order.durationDays !== tariff.durationDays
  ) {
    console.error(`Платёж ${providerPaymentId} не совпадает с заказом продвижения ${orderId}`)
    return "order_mismatch"
  }
  if (order.status === "PAID" && order.providerPaymentId === providerPaymentId) return "already_active"

  const promoUntil = new Date(paymentCreatedAt.getTime() + tariff.durationDays * 86_400_000)

  const activated = await prisma.$transaction(async (tx) => {
    const claimed = await tx.promotionOrder.updateMany({
      where: { id: orderId, status: { in: ["PENDING", "FAILED"] }, providerPaymentId: null },
      data: { status: "PAID", providerPaymentId, promoUntil, paidAt: new Date() },
    })
    if (!claimed.count) return false

    const updated = await tx.listing.updateMany({
      where: { id: listingId, userId, status: LISTING_STATUS.ACTIVE, deletedAt: null },
      data: { isFeatured: tariff.isFeatured, promoType: tariff.id, promoUntil },
    })
    if (!updated.count) {
      /* Деньги пришли, а объявление уже неактивно: заказ уходит на ручную
         проверку, продавцу — честное объяснение вместо тишины. */
      await tx.promotionOrder.update({ where: { id: orderId }, data: { status: "REVIEW_REQUIRED" } })
      await tx.notification.create({
        data: {
          userId,
          title: "Платёж требует проверки",
          content: "Оплата получена, но объявление уже не активно. Поддержка проверит активацию или возврат.",
          type: "WARNING",
          relatedId: listingId,
          relatedType: "LISTING",
        },
      })
      return false
    }

    await tx.notification.create({
      data: {
        userId,
        title: "Продвижение активировано",
        content: `Тариф «${tariff.title}» активен до ${promoUntil.toLocaleDateString("ru-RU")}`,
        type: "SUCCESS",
        relatedId: listingId,
        relatedType: "LISTING",
      },
    })
    return true
  })

  if (!activated) return "listing_inactive"

  /* Начисление партнёру идёт после активации и вне транзакции: сбой в
     партнёрской программе не должен отменять уже оплаченный тариф. */
  await accrueReferralReward(orderId)
  return "activated"
}

/** Помечает заказ несостоявшимся (отказ карты, истёкшая ссылка). */
export async function markPromotionOrderFailed(orderId: string, status: "FAILED" | "CANCELED"): Promise<void> {
  await prisma.promotionOrder.updateMany({
    where: { id: orderId, status: "PENDING" },
    data: { status },
  })
}
