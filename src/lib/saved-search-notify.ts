import { prisma } from "@/lib/prisma"
import { telegramApi } from "@/lib/telegram"
import { markTelegramContactBlocked } from "@/lib/telegram-contacts"
import { publicListingWhere } from "@/lib/listing-lifecycle"
import { savedSearchHref, type SavedSearchScope } from "@/lib/saved-search"
import { getSiteUrl } from "@/lib/site-url"

/**
 * Уведомления по сохранённым поискам.
 *
 * Проверяет, появились ли новые лоты с момента последней проверки, и шлёт
 * короткое сообщение в Telegram со ссылкой на выдачу.
 *
 * Считается именно количество новых, а не сами карточки: письмо с двадцатью
 * машинами человек не читает, а «появилось 3 новых» — открывает.
 */

/** Больше пяти сообщений в сутки одному человеку — это уже спам. */
const MAX_NOTIFICATIONS_PER_DAY = 5

/** Пауза между отправками, чтобы не упереться в лимит Telegram. */
const SEND_PAUSE_MS = 60

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function plural(count: number) {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return "новый вариант"
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "новых варианта"
  return "новых вариантов"
}

/** Сколько подходящих записей появилось после указанного момента. */
async function countNewMatches(scope: SavedSearchScope, since: Date) {
  if (scope === "AUCTIONS") {
    return prisma.auctionListing.count({
      // Только ACTIVE: истёкшие и исключённые политикой лоты в выдаче не
      // показываются, и уведомление привело бы человека в пустой список.
      where: { createdAt: { gt: since }, status: "ACTIVE" },
    })
  }
  return prisma.listing.count({
    where: { ...publicListingWhere, createdAt: { gt: since } },
  })
}

export async function processSavedSearchNotifications(now = new Date()) {
  const searches = await prisma.savedSearch.findMany({
    where: { notifyTelegram: true },
    select: {
      id: true, title: true, scope: true, query: true, lastNotifiedAt: true,
      user: { select: { telegramId: true } },
    },
  })

  const dayAgo = new Date(now.getTime() - 24 * 60 * 60_000)
  const sentToday = new Map<string, number>()

  let notified = 0
  let skipped = 0
  let failed = 0

  for (const search of searches) {
    const telegramId = search.user?.telegramId
    if (!telegramId) {
      // Без привязанного Telegram доставлять некуда.
      skipped += 1
      continue
    }

    const since = search.lastNotifiedAt || dayAgo
    const count = await countNewMatches(search.scope as SavedSearchScope, since)
    if (count === 0) {
      skipped += 1
      continue
    }

    // Несколько подписок одного человека не должны превращаться в очередь
    // сообщений подряд.
    const already = sentToday.get(telegramId) || 0
    if (already >= MAX_NOTIFICATIONS_PER_DAY) {
      skipped += 1
      continue
    }

    const href = new URL(savedSearchHref(search.scope as SavedSearchScope, search.query), getSiteUrl()).toString()
    const text = [
      `🔔 <b>${count} ${plural(count)}</b> по подписке «${search.title}»`,
      "",
      "Открыть выдачу с вашими фильтрами:",
    ].join("\n")

    try {
      await telegramApi("sendMessage", {
        chat_id: telegramId,
        text,
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [[{ text: "🔍 Посмотреть", url: href }]] },
      })
      notified += 1
      sentToday.set(telegramId, already + 1)

      await prisma.savedSearch.update({
        where: { id: search.id },
        data: { lastNotifiedAt: now, lastMatchCount: count },
      })
      await sleep(SEND_PAUSE_MS)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (/blocked by the user|chat not found|user is deactivated/i.test(message)) {
        await markTelegramContactBlocked(telegramId)
        // Отметку тоже двигаем: иначе на каждом запуске будет одна и та же
        // неудачная попытка.
        await prisma.savedSearch.update({
          where: { id: search.id },
          data: { lastNotifiedAt: now, notifyTelegram: false },
        })
      } else {
        console.error(`[saved-search] Не доставлено ${search.id}:`, message)
      }
      failed += 1
    }
  }

  return { searches: searches.length, notified, skipped, failed }
}
