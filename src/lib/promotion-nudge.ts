/**
 * Рассылка напоминаний о продвижении.
 *
 * Продавец разместил машину, объявление висит неделю, покупатели не идут
 * — и он просто ждёт, не зная, что продажу можно ускорить. Предложение
 * звучало один раз, в уведомлении об одобрении, и человек его давно
 * пролистал.
 *
 * С 28.10.2026 напоминание — рекламная карточка: баннер сети чатов,
 * живые цифры (сколько чатов, сколько в них людей, сколько публикаций за
 * месяц) и две кнопки — продвинуть это объявление в приложении и
 * посмотреть тарифы на сайте. Владелец попросил, чтобы бот продавал
 * продвижение красиво, а не строкой текста.
 *
 * Правила — в promotion-nudge-rules: сроки и пороги проверяются тестами,
 * а не подбираются на живых людях.
 */

import { readFile } from "node:fs/promises"
import path from "node:path"
import { prisma } from "@/lib/prisma"
import { getTelegramMiniAppUrl, telegramApi, telegramPhotoApi } from "@/lib/telegram"
import { markTelegramContactBlocked } from "@/lib/telegram-contacts"
import { absoluteUrl } from "@/lib/site-url"
import { getChatNetworkStats } from "@/lib/chat-network-stats"
import { LOW_VIEWS_THRESHOLD, MAX_NUDGES, nudgeText, shouldNudge } from "@/lib/promotion-nudge-rules"
/* Цена берётся отсюда же, откуда её берёт страница оплаты: разойдись они
   — и человек увидит в сообщении одну сумму, а при оплате другую. */
import { PROMOTION_TARIFFS } from "@/lib/promotion-tariffs"

/** За раз — небольшая пачка: Telegram ограничивает частоту отправки. */
const BATCH_SIZE = 25

/** Баннер сети чатов: сцена scenic-v1/sell с подписью, без чисел — числа живые и идут в тексте. */
const PROMO_BANNER = path.join(process.cwd(), "public", "images", "telegram", "promo-chats.jpg")

export type PromotionNudgeResult = {
  checked: number
  sent: number
  skipped: number
  blocked: number
  failed: number
}

function nudgeKeyboard(listingId: string) {
  /* Прямо на страницу продвижения этого объявления: заставить человека
     искать её в кабинете значит потерять половину тех, кто согласился. */
  const promotePath = `/listings/${listingId}/promote`
  const rows: Array<Array<Record<string, unknown>>> = []
  const miniAppUrl = getTelegramMiniAppUrl()
  if (miniAppUrl) rows.push([{ text: "🚀 Продвинуть объявление", web_app: { url: new URL(promotePath, miniAppUrl).toString() } }])
  /* Та же страница на сайте — для тех, у кого приложение не открывается,
     и для тех, кто хочет сравнить тарифы на большом экране. */
  rows.push([{ text: "💎 Все тарифы на сайте", url: absoluteUrl(promotePath) }])
  return { inline_keyboard: rows }
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

  if (!candidates.length) return result

  const now = new Date()
  /* Цифры сети — один раз на прогон: они общие для всех сообщений. */
  const network = await getChatNetworkStats().catch(() => undefined)
  const banner = await readFile(PROMO_BANNER).catch(() => null)

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

    const text = nudgeText({
      index: decision.index,
      title: listing.title,
      views: listing.views,
      days,
      priceRub: PROMOTION_TARIFFS.CHATS.amountRub,
      planDays: PROMOTION_TARIFFS.CHATS.durationDays,
      network,
    })
    const reply_markup = nudgeKeyboard(listing.id)

    try {
      try {
        /* Сначала карточкой с баннером. Подпись к фото — до 1024 знаков,
           текст напоминания короче. Последнее напоминание — без баннера:
           оно прощается, а не продаёт. */
        if (!banner || decision.index >= 2) throw new Error("photo skipped")
        await telegramPhotoApi(
          { chat_id: telegramId, caption: text, reply_markup },
          { uploads: [{ field: "photo", filename: "lewheel-promo.jpg", contentType: "image/jpeg", data: banner }] },
        )
      } catch (photoError) {
        const message = photoError instanceof Error ? photoError.message : String(photoError)
        if (/blocked|deactivated|chat not found/i.test(message)) throw photoError
        /* Баннер не ушёл — сообщение всё равно доходит текстом. */
        await telegramApi("sendMessage", {
          chat_id: telegramId,
          text,
          reply_markup,
          /* Ссылка не должна разворачиваться в карточку: она отвлекает от
             кнопок, ради которых сообщение и отправлено. */
          disable_web_page_preview: true,
        })
      }
      result.sent += 1
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (/blocked|deactivated|chat not found/i.test(message)) {
        await markTelegramContactBlocked(telegramId).catch(() => undefined)
        result.blocked += 1
        continue
      }
      result.failed += 1
      console.error(`[promotion-nudge] Не доставлено ${telegramId}:`, message)
    }
  }

  return result
}
