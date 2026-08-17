import { prisma } from "@/lib/prisma"
import { absoluteUrl } from "@/lib/site-url"
import { getTelegramBotUsername, telegramApi, telegramPhotoApi } from "@/lib/telegram"
import { scheduleTelegramMessageCleanup } from "@/lib/telegram-message-cleanup"

const PROMO_INTERVAL_MS = 12 * 60 * 60 * 1000
const PROMO_BATCH_SIZE = 20

type TelegramSentMessage = { message_id: number }

export const TELEGRAM_PROMO_TEXT = [
  "🚘 <b>LeWheel — весь путь к автомобилю в одном сервисе</b>",
  "",
  "Ищете авто из <b>Японии, Кореи или Китая</b> — либо хотите продать свою машину без лишней рутины? Мы собрали всё необходимое рядом:",
  "",
  "🔨 аукционы с подробными данными источника",
  "📝 бесплатная подача объявления",
  "🛡 проверка автомобиля и безопасная сделка",
  "🚚 расчёт и сопровождение доставки",
  "🏠 личный гараж, избранное и документы",
  "🔧 поиск запчастей по вашему автомобилю",
  "",
  "✨ <b>Откройте LeWheel и найдите свой вариант прямо сейчас.</b>",
  "",
  "🤝 Выкупаете и доставляете автомобили? Станьте партнёром — передаём целевые заявки из вашего региона.",
].join("\n")

function promoKeyboard() {
  const botUsername = getTelegramBotUsername()
  const miniAppUrl = botUsername ? `https://t.me/${botUsername}?startapp=promo` : absoluteUrl("/telegram")
  return {
    inline_keyboard: [
      [{ text: "🚘 Открыть Mini App", url: miniAppUrl }, { text: "🌍 Аукционы", url: absoluteUrl("/auctions?utm_source=telegram&utm_campaign=service_promo") }],
      [{ text: "➕ Подать объявление", url: absoluteUrl("/listings/create/vehicle?utm_source=telegram&utm_campaign=service_promo") }],
      [{ text: "🤝 Стать партнёром", url: absoluteUrl("/dashboard/deliveries?partner=apply&utm_source=telegram&utm_campaign=service_promo") }, { text: "🌐 Перейти на сайт", url: absoluteUrl("/?utm_source=telegram&utm_campaign=service_promo") }],
    ],
  }
}

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
    where: { id: chatId },
    data: { marketingEnabled: enabled, active: true, lastError: null },
  })
}

export async function processTelegramMarketingCampaign() {
  const dueBefore = new Date(Date.now() - PROMO_INTERVAL_MS)
  const chats = await prisma.telegramChat.findMany({
    where: {
      active: true,
      marketingEnabled: true,
      OR: [{ lastPromoAt: null }, { lastPromoAt: { lte: dueBefore } }],
    },
    orderBy: [{ lastPromoAt: "asc" }, { createdAt: "asc" }],
    take: PROMO_BATCH_SIZE,
  })

  let delivered = 0
  let failed = 0
  for (const chat of chats) {
    const claimedAt = new Date()
    const claimed = await prisma.telegramChat.updateMany({
      where: {
        id: chat.id,
        active: true,
        marketingEnabled: true,
        ...(chat.lastPromoAt ? { lastPromoAt: chat.lastPromoAt } : { lastPromoAt: null }),
      },
      data: { lastPromoAt: claimedAt },
    })
    if (claimed.count !== 1) continue

    try {
      let sent: TelegramSentMessage
      try {
        sent = await telegramPhotoApi<TelegramSentMessage>({
          chat_id: chat.id,
          caption: TELEGRAM_PROMO_TEXT,
          parse_mode: "HTML",
          reply_markup: promoKeyboard(),
        })
      } catch {
        sent = await telegramApi<TelegramSentMessage>("sendMessage", {
          chat_id: chat.id,
          text: TELEGRAM_PROMO_TEXT,
          parse_mode: "HTML",
          reply_markup: promoKeyboard(),
        })
      }
      await prisma.telegramChat.update({
        where: { id: chat.id },
        data: { lastPromoAt: claimedAt, lastPromoMessage: sent.message_id, lastError: null },
      })
      await scheduleTelegramMessageCleanup(chat.id, sent.message_id)
      delivered += 1
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 500) : "Неизвестная ошибка Telegram"
      const inactive = /kicked|chat not found|bot was blocked|forbidden/i.test(message)
      await prisma.telegramChat.update({
        where: { id: chat.id },
        data: { lastPromoAt: chat.lastPromoAt, lastError: message, active: inactive ? false : true },
      }).catch(() => undefined)
      failed += 1
    }
  }

  return { due: chats.length, delivered, failed }
}
