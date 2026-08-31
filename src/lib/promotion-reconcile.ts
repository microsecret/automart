import { prisma } from "@/lib/prisma"
import { getPromotionTariff } from "@/lib/promotion-tariffs"
import { activatePaidPromotion, markPromotionOrderFailed } from "@/lib/promotion-activation"
import { fetchYookassaPayment, paymentMatchesAmount, yookassaConfig } from "@/lib/yookassa"

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
  skipped: number
}

export async function reconcilePendingPromotions(): Promise<ReconcileResult> {
  const config = yookassaConfig()
  if (!config) return { checked: 0, activated: 0, failed: 0, skipped: 0 }

  const now = Date.now()
  const orders = await prisma.promotionOrder.findMany({
    where: {
      status: "PENDING",
      providerPaymentId: { not: null },
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
      providerPaymentId: true,
    },
    /* Ограничение бережёт и нас, и кассу: при сбое, накопившем сотни
       заказов, разберём их за несколько проходов, а не одним залпом. */
    take: 40,
    orderBy: { createdAt: "asc" },
  })

  const result: ReconcileResult = { checked: 0, activated: 0, failed: 0, skipped: 0 }

  for (const order of orders) {
    if (!order.providerPaymentId) continue
    result.checked += 1

    try {
      const payment = await fetchYookassaPayment(config, order.providerPaymentId)
      const tariff = getPromotionTariff(order.tariffId)

      if (!tariff) {
        result.skipped += 1
        continue
      }

      if (payment.status === "canceled") {
        await markPromotionOrderFailed(order.id, "FAILED")
        result.failed += 1
        continue
      }

      if (payment.status !== "succeeded" || !payment.paid) {
        /* Человек ещё не заплатил — это обычное дело, а не ошибка. */
        result.skipped += 1
        continue
      }

      /* Та же проверка суммы, что и в уведомлении: платёж на рубль с
         чужими метаданными не должен включить тариф за 3990. */
      if (!paymentMatchesAmount(payment, tariff.amountRub)) {
        console.error(`Сверка: платёж ${payment.id} не совпадает по сумме с тарифом ${tariff.id}`)
        result.skipped += 1
        continue
      }

      await activatePaidPromotion({
        orderId: order.id,
        listingId: order.listingId,
        userId: order.userId,
        tariff,
        providerPaymentId: payment.id,
        paymentCreatedAt: new Date(payment.created_at),
      })
      result.activated += 1
    } catch (error) {
      /* Сбой по одному заказу не должен ронять весь проход: следующий
         запуск попробует его снова. */
      console.error(`Сверка заказа ${order.id}:`, error instanceof Error ? error.message : error)
      result.skipped += 1
    }
  }

  return result
}
