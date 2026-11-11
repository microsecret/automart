import { prisma } from "@/lib/prisma"
import { getPromotionTariff } from "@/lib/promotion-tariffs"
import { activatePaidPromotion, markPromotionOrderFailed } from "@/lib/promotion-activation"
import { fetchYookassaPayment, paymentMatchesAmount, yookassaConfig, type YookassaPayment } from "@/lib/yookassa"

export type PromotionPaymentStatus = "activated" | "pending" | "canceled" | "review_required" | "unknown"

type YookassaOrder = {
  id: string
  listingId: string
  userId: string
  tariffId: string
  providerCheckoutId: string | null
}

export async function applyYookassaPromotionPayment(
  order: YookassaOrder,
  payment: YookassaPayment,
): Promise<PromotionPaymentStatus> {
  const tariff = getPromotionTariff(order.tariffId)
  if (payment.id !== order.providerCheckoutId || !tariff || !paymentMatchesAmount(payment, tariff.amountRub)) {
    console.warn(`Сверка оплаты: платёж не соответствует заказу ${order.id}`)
    return "unknown"
  }
  if (payment.status === "canceled") {
    await markPromotionOrderFailed(order.id, "FAILED")
    return "canceled"
  }
  if (payment.status !== "succeeded" || !payment.paid) return "pending"

  const paymentCreatedAt = new Date(payment.created_at)
  if (Number.isNaN(+paymentCreatedAt)) return "unknown"
  const result = await activatePaidPromotion({
    orderId: order.id, listingId: order.listingId, userId: order.userId,
    tariff, providerPaymentId: payment.id, paymentCreatedAt,
  })
  if (result === "activated" || result === "already_active") return "activated"
  return result === "listing_inactive" ? "review_required" : "unknown"
}

/**
 * Сверка неоплаченных заказов с кассой.
 *
 * Продвижение включается по уведомлению ЮKassa, и это единственная нить,
 * на которой держится весь заработок площадки. Нить тонкая: адрес
 * уведомлений задаётся руками в кабинете кассы, его легко не указать
 * или сбить при смене домена, а ЮKassa о такой ошибке не сообщает — она
 * просто шлёт уведомления в пустоту.
 *
 * Человек тогда платит, деньги списываются, а объявление не
 * продвигается. Он пишет в поддержку и уходит, решив, что его обманули.
 *
 * Сверка закрывает эту дыру: раз в несколько минут мы сами спрашиваем
 * кассу о заказах, которые висят неоплаченными. Уведомление остаётся
 * основным путём — оно быстрее, — а сверка ловит то, что через него не
 * прошло.
 */

/** Заказы старше этого срока уже неинтересны: человек ушёл со страницы оплаты. */
const MAX_AGE_HOURS = 72

/** Моложе минуты не трогаем: человек ещё на странице оплаты. */
const MIN_AGE_MINUTES = 1

export type ReconcileResult = {
  checked: number
  activated: number
  failed: number
  reviewRequired: number
  skipped: number
}

export async function reconcilePendingPromotions(): Promise<ReconcileResult> {
  const config = yookassaConfig()
  if (!config) return { checked: 0, activated: 0, failed: 0, reviewRequired: 0, skipped: 0 }

  const now = Date.now()
  const orders = await prisma.promotionOrder.findMany({
    where: {
      status: "PENDING",
      provider: "YOOKASSA",
      /* Номер платежа ЮKassa до оплаты лежит в providerCheckoutId — его
         пишет создание платежа. providerPaymentId заполняет только
         активация, и у ждущих заказов он всегда пуст: прежний отбор по
         нему не находил ни одного заказа, и сверка годами отвечала
         «проверено 0» (аудит 28.10.2026). */
      providerCheckoutId: { not: null },
      createdAt: {
        gte: new Date(now - MAX_AGE_HOURS * 3_600_000),
        lte: new Date(now - MIN_AGE_MINUTES * 60_000),
      },
    },
    select: {
      id: true,
      listingId: true,
      userId: true,
      /* Хранится строчными («chats»), а поиск тарифа приводит к
         верхнему регистру — ключи совпадают. */
      tariffId: true,
      providerCheckoutId: true,
    },
    /* Ограничение бережёт и нас, и кассу: при сбое, накопившем сотни
       заказов, разберём их за несколько проходов, а не одним залпом. */
    take: 40,
    orderBy: { createdAt: "asc" },
  })

  const result: ReconcileResult = { checked: 0, activated: 0, failed: 0, reviewRequired: 0, skipped: 0 }

  for (const order of orders) {
    if (!order.providerCheckoutId) continue
    result.checked += 1

    try {
      const payment = await fetchYookassaPayment(config, order.providerCheckoutId)
      const status = await applyYookassaPromotionPayment(order, payment)
      if (status === "activated") result.activated += 1
      else if (status === "canceled") result.failed += 1
      else if (status === "review_required") result.reviewRequired += 1
      else result.skipped += 1
    } catch (error) {
      /* Сбой по одному заказу не должен ронять весь проход: следующий
         запуск попробует его снова. */
      console.error(`Сверка заказа ${order.id}:`, error instanceof Error ? error.message : error)
      result.skipped += 1
    }
  }

  return result
}

/**
 * Сверка одного заказа — по возвращении человека со страницы кассы.
 *
 * Уведомление приходит за секунды, но не всегда: адрес в кабинете кассы
 * может быть не указан. Сверка по расписанию догонит за пять минут, а
 * человек стоит на странице прямо сейчас и смотрит, включилось ли то,
 * за что он заплатил. Пять минут ожидания перед пустым экраном — это
 * человек, который ушёл и написал в поддержку.
 *
 * Поэтому спрашиваем кассу сразу, как только он вернулся.
 */
export async function reconcileSingleOrder(
  order: YookassaOrder & { provider: string; status: string },
): Promise<PromotionPaymentStatus> {
  if (order.status === "PAID") return "activated"
  if (order.status === "REVIEW_REQUIRED") return "review_required"
  if (order.status === "FAILED" || order.status === "CANCELED") return "canceled"
  if (order.status !== "PENDING") return "unknown"
  const config = yookassaConfig()
  if (!config || order.provider !== "YOOKASSA" || !order.providerCheckoutId) return "pending"

  try {
    const payment = await fetchYookassaPayment(config, order.providerCheckoutId)
    return await applyYookassaPromotionPayment(order, payment)
  } catch (error) {
    console.error(`Сверка заказа ${order.id}:`, error instanceof Error ? error.message : error)
    return "pending"
  }
}
