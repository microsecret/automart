import { prisma } from "@/lib/prisma"
import { absoluteUrl } from "@/lib/site-url"
import { getTelegramBotUsername, isTelegramChatAdministrator, telegramApi, telegramPhotoApi } from "@/lib/telegram"
import { readLocalPhotos, photoMime } from "@/lib/telegram-photo-files"
import { buildCommunityPost, communityChatUrl, communityIntervalMs } from "@/lib/telegram-community-post"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { buildPromotionOfferPost } from "@/lib/chat-promotion-post"
import { getChatNetworkStats } from "@/lib/chat-network-stats"
import { CHAT_PROMOTION_OPTIONS, PROMOTION_PAYMENT_SUPPORT } from "@/lib/promotion-tariffs"
import { yookassaConfig } from "@/lib/yookassa"

const PROMO_BATCH_SIZE = 20
type SentMessage = { message_id: number; photo?: Array<{ file_id: string }> }
const PROMOTION_IMAGE = path.join(process.cwd(), "public", "images", "telegram", "promo-chats-week.jpg")
const PROMOTION_OFFER_INTERVAL_MS = 8 * 60 * 60 * 1000
const PROMOTION_OFFER_BATCH_SIZE = 4

export async function registerTelegramGroup(chat: { id: number | string; type: string; title?: string }) {
  if (chat.type !== "group" && chat.type !== "supergroup") return
  await prisma.telegramChat.upsert({
    where: { id: String(chat.id) },
    create: { id: String(chat.id), type: chat.type, title: chat.title?.trim() || null },
    update: { type: chat.type, title: chat.title?.trim() || null, active: true, lastSeenAt: new Date(), lastError: null },
  })
}

export async function setTelegramChatMarketing(chatId: string, enabled: boolean) {
  return prisma.telegramChat.update({
    where: { id: chatId }, data: { marketingEnabled: enabled, active: true, lastError: null },
  })
}

async function processPromotionOffers() {
  if (!yookassaConfig() && !process.env.STRIPE_SECRET_KEY) return null
  const botUsername = getTelegramBotUsername()
  if (!botUsername) return null

  const eligible = { active: true, marketingEnabled: true }
  const cutoff = new Date(Date.now() - PROMOTION_OFFER_INTERVAL_MS)
  const chats = await prisma.telegramChat.findMany({
    where: { ...eligible, OR: [{ lastPromotionOfferAt: null }, { lastPromotionOfferAt: { lte: cutoff } }] },
    orderBy: [{ lastPromotionOfferAt: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    select: { id: true, lastPromotionOfferAt: true },
    take: PROMOTION_OFFER_BATCH_SIZE,
  })
  if (!chats.length) return null

  const image = await readFile(PROMOTION_IMAGE).catch(() => null)
  if (!image) return null
  const network = await getChatNetworkStats().catch(() => null)
  const post = buildPromotionOfferPost({
    siteUrl: absoluteUrl("/"),
    chatCount: network?.chats ?? await prisma.telegramChat.count({ where: eligible }),
    audience: network?.members && network.checkedAt
      ? { members: network.members, checkedAt: network.checkedAt } : undefined,
    botUsername,
    supportUsername: PROMOTION_PAYMENT_SUPPORT,
    plans: CHAT_PROMOTION_OPTIONS,
  })
  const replyMarkup = { inline_keyboard: post.buttons.map((button) => [button]) }
  const result = { kind: "promotion", due: chats.length, delivered: 0, failed: 0, skipped: 0 }
  let fileId: string | undefined
  for (const chat of chats) {
    const claimed = await prisma.telegramChat.updateMany({
      where: { id: chat.id, ...eligible, lastPromotionOfferAt: chat.lastPromotionOfferAt },
      data: { lastPromotionOfferAt: new Date(), lastPromotionOfferMessage: null },
    })
    if (claimed.count !== 1) continue
    try {
      if (!(await isTelegramChatAdministrator(chat.id))) {
        result.skipped += 1
        continue
      }
      const sent = await telegramPhotoApi<SentMessage>({
        chat_id: chat.id, parse_mode: "HTML", caption: post.caption,
        disable_notification: true, reply_markup: replyMarkup,
        ...(fileId ? { photo: fileId } : {}),
      }, {
        uploads: fileId ? [] : [{ field: "photo", filename: "promo-chats-week.jpg", contentType: "image/jpeg", data: image }],
      })
      fileId = sent.photo?.at(-1)?.file_id || fileId
      await prisma.telegramChat.update({
        where: { id: chat.id },
        data: { lastPromotionOfferMessage: sent.message_id },
      })
      result.delivered += 1
    } catch {
      // Telegram may have accepted a timed-out request. Keep the slot claimed.
      result.failed += 1
    }
  }
  console.info("[promotion-offer]", JSON.stringify(result))
  return result
}

export async function processTelegramMarketingCampaign() {
  const promotion = await processPromotionOffers()
  if (promotion) return promotion

  const dueBefore = new Date(Date.now() - communityIntervalMs(process.env.TELEGRAM_PROMO_INTERVAL_MS))
  const chats = await prisma.telegramChat.findMany({
    where: { active: true, marketingEnabled: true, OR: [{ lastPromoAt: null }, { lastPromoAt: { lte: dueBefore } }] },
    orderBy: [{ lastPromoAt: "asc" }, { createdAt: "asc" }], take: PROMO_BATCH_SIZE,
  })
  const image = process.env.COMMUNITY_INVITE_IMAGE?.trim() || ""
  // Only an operator-configured local upload, never a user-supplied URL.
  const imagePath = /^\/uploads\/[A-Za-z0-9._-]+$/.test(image) && !image.includes("..") ? image : ""
  const imageData = imagePath ? (await readLocalPhotos([imagePath])).get(imagePath) : undefined
  let photoFileId: string | undefined
  let delivered = 0, failed = 0, skipped = 0
  for (const chat of chats) {
    const claimedAt = new Date()
    const claimed = await prisma.telegramChat.updateMany({
      where: { id: chat.id, active: true, marketingEnabled: true, lastPromoAt: chat.lastPromoAt || null },
      data: { lastPromoAt: claimedAt },
    })
    if (claimed.count !== 1) continue
    try {
      if (!(await isTelegramChatAdministrator(chat.id))) { skipped += 1; continue }
      const details = await telegramApi<{ id: number | string; username?: string; invite_link?: string }>("getChat", { chat_id: chat.id })
      // Never export/create a link or accidentally share another chat.
      const chatUrl = String(details.id) === chat.id ? communityChatUrl(details) : null
      if (!chatUrl) { skipped += 1; continue }
      const current = await prisma.telegramChat.findUnique({ where: { id: chat.id }, select: { active: true, marketingEnabled: true } })
      if (!current?.active || !current.marketingEnabled) { skipped += 1; continue }
      const post = buildCommunityPost({ title: chat.title, chatUrl, siteUrl: absoluteUrl("/"), botUsername: getTelegramBotUsername() })
      const payload = { chat_id: chat.id, parse_mode: "HTML", reply_markup: post.keyboard }
      let sent: SentMessage
      if (imageData || photoFileId) {
        sent = await telegramPhotoApi<SentMessage>({ ...payload, caption: post.text, ...(photoFileId ? { photo: photoFileId } : {}) }, {
          uploads: photoFileId ? [] : [{ field: "photo", filename: imagePath.slice("/uploads/".length), contentType: photoMime(imagePath), data: imageData! }],
        })
        photoFileId = sent.photo?.at(-1)?.file_id || photoFileId
      } else {
        sent = await telegramApi<SentMessage>("sendMessage", { ...payload, text: post.text, disable_web_page_preview: true })
      }
      await prisma.telegramChat.update({ where: { id: chat.id }, data: { lastPromoMessage: sent.message_id, lastError: null } })
      delivered += 1
    } catch (error) {
      // Keep the attempt after uncertain delivery: a fallback could duplicate
      // an accepted photo whose response was lost.
      const inactive = /kicked|chat not found|bot was blocked|forbidden/i.test(error instanceof Error ? error.message : "")
      await prisma.telegramChat.update({ where: { id: chat.id }, data: {
        lastError: "Не удалось отправить сообщение в чат", ...(inactive ? { active: false } : {}),
      } }).catch(() => undefined)
      failed += 1
    }
  }
  return { due: chats.length, delivered, failed, skipped }
}
