import { plural as sharedPlural } from "@/lib/format"
import { prisma } from "@/lib/prisma"
import { telegramApi } from "@/lib/telegram"
import { markTelegramContactBlocked } from "@/lib/telegram-contacts"
import { publicListingWhere } from "@/lib/listing-lifecycle"
import { savedSearchHref, type SavedSearchScope } from "@/lib/saved-search"
import { getSiteUrl } from "@/lib/site-url"
import { newPartsSince, partsWhereFromQuery } from "@/lib/part-search-where"
import { auctionsWhereFromQuery, listingsWhereFromQuery } from "@/lib/saved-search-where"

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

/* Склонение берётся из общей функции: правило было написано в проекте
   трижды, и каждая копия — риск разойтись при следующей правке. */
function plural(count: number) {
  return sharedPlural(count, "новый вариант", "новых варианта", "новых вариантов")
}

/** Сколько подходящих записей появилось после указанного момента. */
async function countNewMatches(scope: SavedSearchScope, since: Date, query = "") {
  /* Запчасти считаются по фильтрам подписки: «Сообщить о поступлении»
     автоламп H7 не должно срабатывать на новый фильтр масляный. */
  if (scope === "PARTS") {
    return prisma.part.count({ where: { AND: [partsWhereFromQuery(query), newPartsSince(since)] } })
  }
  /* Счёт — по фильтрам подписки. Раньше считались все новые записи
     раздела: подписчик на «Toyota Camry» получал «5 новых вариантов» и
     не находил по ссылке ни одного. */
  if (scope === "AUCTIONS") {
    return prisma.auctionListing.count({
      // Только ACTIVE: истёкшие и исключённые политикой лоты в выдаче не
      // показываются, и уведомление привело бы человека в пустой список.
      where: { AND: [{ createdAt: { gt: since }, status: "ACTIVE", adminHiddenAt: null }, auctionsWhereFromQuery(query)] },
    })
  }
  return prisma.listing.count({
    where: { AND: [{ ...publicListingWhere, createdAt: { gt: since } }, listingsWhereFromQuery(query)] },
  })
}

/**
 * Сколько подписок разбирается за один прогон.
 *
 * Выборка шла без ограничения: при десяти тысячах подписок задача
 * тянула их все разом и на каждой делала запрос к базе. Одна долгая
 * рассылка блокировала следующие, а сбой в середине означал, что часть
 * людей осталась без уведомления.
 *
 * Полторы тысячи проходят за секунды, а cron идёт каждые несколько
 * минут: очередь разбирается, даже когда подписок станет вдесятеро
 * больше.
 */
const MAX_SEARCHES_PER_RUN = 1_500

export async function processSavedSearchNotifications(now = new Date()) {
  const searches = await prisma.savedSearch.findMany({
    where: { notifyTelegram: true },
    select: {
      id: true, title: true, scope: true, query: true, lastNotifiedAt: true,
      user: { select: { id: true, telegramId: true } },
    },
    /* Первыми — те, кого не уведомляли дольше всех: иначе при обрезании
       списка одни и те же подписки всегда оказывались бы в хвосте и не
       получали ничего. */
    orderBy: { lastNotifiedAt: "asc" },
    take: MAX_SEARCHES_PER_RUN,
  })

  /* Счёт новых записей кэшируется по паре «раздел и момент».

     Запрос шёл на каждую подписку отдельно, хотя считает он одно и то
     же: сколько объявлений появилось после такого-то времени. У
     большинства людей lastNotifiedAt совпадает с точностью до прогона
     рассылки, и десять тысяч подписок давали десять тысяч одинаковых
     запросов подряд.

     Момент округляется до минуты: отличие в секунды меняет ответ разве
     что на единицу, а совпадений становится на порядок больше. */
  const countCache = new Map<string, number>()
  const countNewMatchesCached = async (scope: SavedSearchScope, since: Date, query: string) => {
    const key = `${scope}:${query}:${Math.floor(since.getTime() / 60_000)}`
    const cached = countCache.get(key)
    if (cached !== undefined) return cached
    const value = await countNewMatches(scope, since, query)
    countCache.set(key, value)
    return value
  }

  const dayAgo = new Date(now.getTime() - 24 * 60 * 60_000)
  const sentToday = new Map<string, number>()

  let notified = 0
  let skipped = 0
  let failed = 0

  for (const search of searches) {
    const telegramId = search.user?.telegramId
    const since = search.lastNotifiedAt || dayAgo
    if (!telegramId) {
      /* Без Telegram подписка на запчасти уходит уведомлением на сайте:
         «сообщить о поступлении» нажимают и те, кто вошёл по почте. Для
         объявлений и аукционов прежнее правило — только Telegram. */
      if (search.scope === "PARTS" && search.user?.id) {
        const count = await countNewMatchesCached("PARTS", since, search.query)
        if (count > 0) {
          await prisma.notification.create({
            data: {
              userId: search.user.id,
              title: "Появились товары по подписке",
              content: `${count} ${plural(count)} по подписке «${search.title}»`,
              type: "INFO",
              relatedType: "SAVED_SEARCH",
              relatedId: search.id,
            },
          })
          await prisma.savedSearch.update({ where: { id: search.id }, data: { lastNotifiedAt: now, lastMatchCount: count } })
          notified += 1
          continue
        }
      }
      skipped += 1
      continue
    }

    const count = await countNewMatchesCached(search.scope as SavedSearchScope, since, search.query)
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
