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

  const result = await prisma.$transaction(async (tx): Promise<ActivationResult> => {
    // Acquire the SQLite write transaction before reading the current expiry.
    // Distinct payments cannot both extend the same stale pre-transaction date.
    const claimed = await tx.promotionOrder.updateMany({
      where: { id: orderId, status: { in: ["PENDING", "FAILED"] }, providerPaymentId: null },
      data: { status: "PAID", providerPaymentId, paidAt: new Date() },
    })
    if (!claimed.count) {
      const settled = await tx.promotionOrder.findUnique({
        where: { id: orderId }, select: { status: true, providerPaymentId: true },
      })
      return settled?.status === "PAID" && settled.providerPaymentId === providerPaymentId
        ? "already_active" : "listing_inactive"
    }

    const current = await tx.listing.findFirst({
      where: { id: listingId, userId, status: LISTING_STATUS.ACTIVE, deletedAt: null },
      select: { promoType: true, promoUntil: true },
    })
    if (!current) {
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
      return "listing_inactive"
    }

    const isChatPromotion = tariff.id === "chats"
    const previousChatOrder = isChatPromotion ? await tx.promotionOrder.findFirst({
      where: {
        listingId, userId, tariffId: tariff.id, status: "PAID", id: { not: orderId },
        promoUntil: { gt: paymentCreatedAt },
      },
      orderBy: { promoUntil: "desc" }, select: { promoUntil: true },
    }) : null
    // Chat visibility belongs to paid orders, independently of website badges.
    // Legacy chat orders keep their stored terms; this read does not mutate them.
    const previousExpiry = isChatPromotion ? previousChatOrder?.promoUntil
      : current.promoType === tariff.id ? current.promoUntil : null
    const anchor = previousExpiry && previousExpiry > paymentCreatedAt ? previousExpiry : paymentCreatedAt
    const promoUntil = new Date(anchor.getTime() + tariff.durationDays * 86_400_000)
    await tx.promotionOrder.update({ where: { id: orderId }, data: { promoUntil } })
    if (!isChatPromotion) {
      await tx.listing.update({
        where: { id: listingId },
        data: { isFeatured: tariff.isFeatured, promoType: tariff.id, promoUntil },
      })
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
    return "activated"
  })

  /* Начисление партнёру идёт после активации и вне транзакции: сбой в
     партнёрской программе не должен отменять уже оплаченный тариф. */
  if (result === "activated") await accrueReferralReward(orderId)
  return result
}

/** Помечает заказ несостоявшимся (отказ карты, истёкшая ссылка). */
export async function markPromotionOrderFailed(orderId: string, status: "FAILED" | "CANCELED"): Promise<void> {
  await prisma.promotionOrder.updateMany({
    where: { id: orderId, status: "PENDING" },
    data: { status },
  })
}
