/**
 * Рассылка напоминаний о продвижении.
 *
 * Продавец разместил машину, объявление висит неделю, покупатели не идут
 * — и он просто ждёт, не зная, что продажу можно ускорить. Предложение
 * звучало один раз, в уведомлении об одобрении, и человек его давно
 * пролистал.
 *
 * Правила — в promotion-nudge-rules: сроки и пороги проверяются тестами,
 * а не подбираются на живых людях.
 */

import { prisma } from "@/lib/prisma"
import { getTelegramMiniAppUrl, telegramApi } from "@/lib/telegram"
import { markTelegramContactBlocked } from "@/lib/telegram-contacts"
import { LOW_VIEWS_THRESHOLD, MAX_NUDGES, nudgeText, shouldNudge } from "@/lib/promotion-nudge-rules"
/* Цена берётся отсюда же, откуда её берёт страница оплаты: разойдись они
   — и человек увидит в сообщении одну сумму, а при оплате другую. */
import { PROMOTION_TARIFFS } from "@/lib/promotion-tariffs"

/** За раз — небольшая пачка: Telegram ограничивает частоту отправки. */
const BATCH_SIZE = 25

export type PromotionNudgeResult = {
  checked: number
  sent: number
  skipped: number
  blocked: number
  failed: number
}

function nudgeKeyboard(listingId: string) {
  const miniAppUrl = getTelegramMiniAppUrl()
  if (!miniAppUrl) return undefined

  /* Прямо на страницу продвижения этого объявления: заставить человека
     искать её в кабинете значит потерять половину тех, кто согласился. */
  const promoteUrl = new URL(`/listings/${listingId}/promote`, miniAppUrl).toString()

  return {
    inline_keyboard: [[{ text: "🚀 Ускорить продажу", web_app: { url: promoteUrl } }]],
  }
}

/**
 * Рассылает напоминания тем, у кого объявление висит без покупателей.
 *
 * Отметка ставится до отправки: сбой Telegram не должен приводить к
 * повторному напоминанию тому же человеку через минуту.
 */
export async function processPromotionNudges(): Promise<PromotionNudgeResult> {
  const result: PromotionNudgeResult = { checked: 0, sent: 0, skipped: 0, blocked: 0, failed: 0 }

  const candidates = await prisma.listing.findMany({
    where: {
      status: "ACTIVE",
      deletedAt: null,
      publishedAt: { not: null },
      /* Отсев по числу напоминаний и просмотрам делается запросом, а не
         в памяти: иначе пришлось бы тянуть все объявления площадки ради
         десятка подходящих. */
      promotionNudges: { lt: MAX_NUDGES },
      views: { lte: LOW_VIEWS_THRESHOLD },
      user: { telegramId: { not: null } },
    },
    orderBy: { publishedAt: "asc" },
    take: BATCH_SIZE * 4,
    select: {
      id: true,
      title: true,
      views: true,
      publishedAt: true,
      promotionNudges: true,
      lastPromotionNudgeAt: true,
      user: { select: { telegramId: true } },
      /* Оплаченное продвижение: одна запись достаточна, чтобы понять, что
         напоминать не о чем. */
      promotionOrders: {
        where: { status: "PAID", promoUntil: { gt: new Date() } },
        select: { id: true },
        take: 1,
      },
    },
  })

  const now = new Date()

  for (const listing of candidates) {
    if (result.sent >= BATCH_SIZE) break
    result.checked += 1

    const decision = shouldNudge({
      publishedAt: listing.publishedAt,
      views: listing.views,
      hasActivePromotion: listing.promotionOrders.length > 0,
      nudgesSent: listing.promotionNudges,
      lastNudgeAt: listing.lastPromotionNudgeAt,
      now,
    })

    if (!decision.send) {
      result.skipped += 1
      continue
    }

    const telegramId = listing.user.telegramId
    if (!telegramId) {
      result.skipped += 1
      continue
    }

    /* Отметка до отправки: сбой Telegram не должен приводить к повторному
       напоминанию тому же человеку через минуту. */
    await prisma.listing.update({
      where: { id: listing.id },
      data: { promotionNudges: { increment: 1 }, lastPromotionNudgeAt: now },
    })

    const days = listing.publishedAt
      ? Math.floor((now.getTime() - listing.publishedAt.getTime()) / (24 * 60 * 60 * 1000))
      : 0

    try {
      await telegramApi("sendMessage", {
        chat_id: telegramId,
        text: nudgeText({
          index: decision.index,
          title: listing.title,
          views: listing.views,
          days,
          priceRub: PROMOTION_TARIFFS.CHATS.amountRub,
          planDays: PROMOTION_TARIFFS.CHATS.durationDays,
        }),
        reply_markup: nudgeKeyboard(listing.id),
        /* Ссылка не должна разворачиваться в карточку: она отвлекает от
           кнопки, ради которой сообщение и отправлено. */
        disable_web_page_preview: true,
      })
      result.sent += 1
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error)
      if (/blocked|deactivated|chat not found/i.test(text)) {
        await markTelegramContactBlocked(telegramId).catch(() => undefined)
        result.blocked += 1
        continue
      }
      result.failed += 1
      console.error(`[promotion-nudge] Не доставлено ${telegramId}:`, text)
    }
  }

  return result
}
