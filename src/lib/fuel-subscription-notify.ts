/**
 * Уведомление подписчиков о появлении топлива.
 *
 * Вызывается из маршрута отметок: как только человек отметил «есть 92»,
 * подписчики на эту марку узнают об этом. Ждать расписания нельзя —
 * топливо разбирают за час, и уведомление через полчаса приходит уже к
 * пустой колонке.
 *
 * Правила отбора — в fuel-subscription: они проверяются тестами без базы
 * и сети.
 */

import { prisma } from "@/lib/prisma"
import { telegramApi } from "@/lib/telegram"
import { markTelegramContactBlocked } from "@/lib/telegram-contacts"
import { absoluteUrl } from "@/lib/site-url"
import {
  buildNotificationText,
  shouldNotify,
  type AvailabilityChange,
  type SubscriptionKind,
} from "@/lib/fuel-subscription"

/**
 * Сколько подписчиков обслуживать за один вызов.
 *
 * Отметка сохраняется в том же запросе, и человек ждёт ответа. Полсотни
 * сообщений Telegram принимает за пару секунд, а больше — уже заметная
 * задержка, из-за которой отметить топливо станет неприятно.
 */
const MAX_PER_CHANGE = 50

/**
 * Оповещает подписчиков о появлении топлива.
 *
 * Ответа не ждут: отправка не должна задерживать сохранение отметки, а
 * её неудача — отменять саму отметку.
 */
export async function notifyFuelSubscribers(change: AvailabilityChange): Promise<number> {
  try {
    /* Ищем оба вида подписок разом: на эту точку и на марку по городу.
       Условие по городу нестрогое — он приходит из справочника точек, а
       подписка заводится из выбранного человеком города. */
    const candidates = await prisma.fuelSubscription.findMany({
      where: {
        OR: [
          { kind: "STATION", stationId: change.stationId },
          { kind: "STATION_FUEL", stationId: change.stationId, fuel: change.fuel },
          { kind: "CITY_FUEL", fuel: change.fuel, city: { contains: change.city } },
        ],
      },
      take: MAX_PER_CHANGE,
      select: {
        id: true,
        kind: true,
        stationId: true,
        fuel: true,
        city: true,
        lastNotifiedAt: true,
        createdAt: true,
        user: { select: { telegramId: true } },
      },
    })

    if (candidates.length === 0) return 0

    const now = new Date()
    const siteUrl = absoluteUrl("/services/fuel-map")
    let sent = 0

    for (const subscription of candidates) {
      const telegramId = subscription.user.telegramId
      if (!telegramId) continue

      const decision = shouldNotify(
        {
          kind: subscription.kind,
          stationId: subscription.stationId,
          fuel: subscription.fuel,
          city: subscription.city,
          lastNotifiedAt: subscription.lastNotifiedAt,
          createdAt: subscription.createdAt,
        },
        change,
        now,
      )
      if (!decision.send) continue

      /* Отметка о рассылке ставится до отправки: сбой Telegram не должен
         приводить к пяти сообщениям подряд тому же человеку. */
      await prisma.fuelSubscription.update({
        where: { id: subscription.id },
        data: { lastNotifiedAt: now },
      })

      try {
        await telegramApi("sendMessage", {
          chat_id: telegramId,
          text: buildNotificationText(change, subscription.kind as SubscriptionKind),
          parse_mode: "HTML",
          disable_web_page_preview: true,
          reply_markup: {
            inline_keyboard: [[{ text: "🗺 Открыть карту", url: siteUrl }]],
          },
        })
        sent += 1
      } catch (error) {
        const text = error instanceof Error ? error.message : String(error)
        /* Человек заблокировал бота или удалил учётную запись — обычное
           дело, а не сбой: помечаем и больше не пишем. */
        if (/blocked|deactivated|chat not found/i.test(text)) {
          await markTelegramContactBlocked(telegramId).catch(() => undefined)
          continue
        }
        console.error(`[fuel-subscription] Не доставлено ${telegramId}:`, text)
      }
    }

    return sent
  } catch (error) {
    console.error("Уведомление подписчиков о топливе:", error)
    return 0
  }
}
