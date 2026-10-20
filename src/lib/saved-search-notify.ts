import { plural } from "@/lib/format"
import { prisma } from "@/lib/prisma"
import { telegramApi } from "@/lib/telegram"
import { publicListingWhere } from "@/lib/listing-lifecycle"
import { savedSearchHref, SAVED_SEARCH_SCOPES, type SavedSearchScope } from "@/lib/saved-search"
import { getSiteUrl } from "@/lib/site-url"
import { newPartsSince, partsWhereFromQuery } from "@/lib/part-search-where"
import { auctionsWhereFromQuery, listingsWhereFromQuery } from "@/lib/saved-search-where"
import { buildPublicAuctionPolicy } from "@/lib/auction-public-catalog"
import { savedSearchTelegramText } from "@/lib/saved-search-message.mjs"

const MAX_NOTIFICATIONS_PER_DAY = 5
const MAX_SEARCHES_PER_RUN = 1500
const RUN_BUDGET_MS = 120_000
const SEND_PAUSE_MS = 60
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Count only the interval whose checkpoint will be committed. */
async function countNewMatches(scope: SavedSearchScope, since: Date, until: Date, query: string) {
  const createdAt = { gt: since, lte: until }
  if (scope === "PARTS") {
    return prisma.part.count({ where: { AND: [partsWhereFromQuery(query), { createdAt: { lte: until } }, newPartsSince(since, until)] } })
  }
  if (scope === "AUCTIONS") {
    return prisma.auctionListing.count({ where: { AND: [buildPublicAuctionPolicy(until).where, { createdAt }, auctionsWhereFromQuery(query)] } })
  }
  return prisma.listing.count({ where: { AND: [publicListingWhere, { createdAt }, listingsWhereFromQuery(query)] } })
}

/**
 * The site notification, quota reservation and checkpoint commit atomically.
 * Telegram is optional and outside the transaction. Ambiguous Telegram sends
 * are not replayed automatically: the site notification is already available.
 */
export async function processSavedSearchNotifications(now = new Date()) {
  const started = Date.now()
  const searches = await prisma.savedSearch.findMany({
    where: { notifyTelegram: true, user: { accountStatus: { not: "BANNED" } } },
    select: { id: true, title: true, scope: true, query: true, createdAt: true, lastNotifiedAt: true, user: { select: { id: true, telegramId: true } } },
    orderBy: [{ lastCheckedAt: "asc" }, { id: "asc" }],
    take: MAX_SEARCHES_PER_RUN,
  })
  const telegramIds = searches.flatMap((search) => search.user.telegramId ? [search.user.telegramId] : [])
  const blocked = new Set((await prisma.telegramContact.findMany({ where: { telegramId: { in: telegramIds }, blocked: true }, select: { telegramId: true } })).map((contact) => contact.telegramId))
  const countCache = new Map<string, number>()
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60_000)
  let notified = 0, skipped = 0, failed = 0, telegramSent = 0, processed = 0

  for (const search of searches) {
    if (Date.now() - started >= RUN_BUDGET_MS) break
    processed++
    const since = search.lastNotifiedAt || search.createdAt
    if (since >= now || !SAVED_SEARCH_SCOPES.includes(search.scope as SavedSearchScope)) { skipped++; continue }
    const unchanged = { id: search.id, notifyTelegram: true, query: search.query, scope: search.scope, lastNotifiedAt: search.lastNotifiedAt, user: { accountStatus: { not: "BANNED" } } }
    try {
      // Rotate the queue even when a daily budget is exhausted, without
      // advancing the matching watermark and losing pending matches.
      await prisma.savedSearch.updateMany({ where: unchanged, data: { lastCheckedAt: now } })
      // Exact times matter: two subscribers in one minute can have different
      // new lots. Cache size remains bounded by this selected batch.
      const key = JSON.stringify([search.scope, search.query, since.toISOString()])
      let count = countCache.get(key)
      if (count === undefined) {
        count = await countNewMatches(search.scope as SavedSearchScope, since, now, search.query)
        countCache.set(key, count)
      }
      if (count === 0) {
        // Empty subscriptions must leave the head of the bounded queue too.
        await prisma.savedSearch.updateMany({ where: unchanged, data: { lastNotifiedAt: now, lastMatchCount: 0 } })
        skipped++
        continue
      }

      const telegramId = search.user.telegramId
      const sendTelegram = Boolean(telegramId && !blocked.has(telegramId))
      const noun = plural(count, "новый вариант", "новых варианта", "новых вариантов")
      const message = `${count} ${noun} по подписке «${search.title}»`
      const matchCount = count
      const delivery = await prisma.$transaction(async (tx) => {
        const used = await tx.savedSearchDelivery.count({ where: { userId: search.user.id, createdAt: { gt: dayAgo, lte: now } } })
        if (used >= MAX_NOTIFICATIONS_PER_DAY) return null
        const claim = await tx.savedSearch.updateMany({ where: unchanged, data: { lastNotifiedAt: now, lastMatchCount: matchCount } })
        if (!claim.count) return null
        const reserved = await tx.savedSearchDelivery.create({ data: { userId: search.user.id, searchId: search.id, windowStart: since, windowEnd: now, matchCount, telegramStatus: sendTelegram ? "RESERVED" : "NOT_REQUESTED", createdAt: now } })
        await tx.notification.create({ data: { userId: search.user.id, title: "Новые предложения по подписке", content: message, type: "INFO", relatedType: "SAVED_SEARCH", relatedId: search.id, createdAt: now } })
        return reserved
      })
      if (!delivery) { skipped++; continue }
      notified++

      if (sendTelegram && telegramId) {
        try {
          const href = new URL(savedSearchHref(search.scope as SavedSearchScope, search.query), getSiteUrl()).toString()
          await telegramApi("sendMessage", { chat_id: telegramId, text: savedSearchTelegramText(search.title, count, noun), parse_mode: "HTML", reply_markup: { inline_keyboard: [[{ text: "🔍 Посмотреть", url: href }]] } })
          await prisma.savedSearchDelivery.update({ where: { id: delivery.id }, data: { telegramStatus: "SENT" } })
          telegramSent++
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          await prisma.savedSearchDelivery.update({ where: { id: delivery.id }, data: { telegramStatus: "FAILED" } })
          if (/blocked by the user|chat not found|user is deactivated/i.test(message)) {
            blocked.add(telegramId)
            await prisma.telegramContact.upsert({ where: { telegramId }, update: { blocked: true }, create: { telegramId, blocked: true, registered: true } })
          }
          failed++
        }
        await sleep(SEND_PAUSE_MS)
      }
    } catch (error) {
      console.error(`[saved-search] Processing failed for ${search.id}:`, error instanceof Error ? error.name : "Unknown error")
      failed++
    }
  }
  return { searches: searches.length, processed, deferred: searches.length - processed, notified, telegramSent, skipped, failed }
}
