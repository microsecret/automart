import { prisma } from "@/lib/prisma"
import { absoluteUrl } from "@/lib/site-url"
import { getTelegramBotUsername, isTelegramChatAdministrator, telegramApi, telegramPhotoApi } from "@/lib/telegram"
import { readLocalPhotos, photoMime } from "@/lib/telegram-photo-files"
import { buildCommunityPost, communityChatUrl, communityIntervalMs } from "@/lib/telegram-community-post"

const PROMO_BATCH_SIZE = 20
type SentMessage = { message_id: number; photo?: Array<{ file_id: string }> }

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

/** Existing polling route: durable six-hour attempt gate, independent of paid
 * listing delivery. Community invitations intentionally have no cleanup. */
export async function processTelegramMarketingCampaign() {
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
        lastError: "Не удалось отправить приглашение в сообщество", ...(inactive ? { active: false } : {}),
      } }).catch(() => undefined)
      failed += 1
    }
  }
  return { due: chats.length, delivered, failed, skipped }
}
