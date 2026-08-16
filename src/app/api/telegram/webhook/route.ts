import crypto from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { canModerateTelegramChat, getTelegramBotUsername, getTelegramMiniAppUrl, isTelegramUserRegistered, linkTelegramIdentity, normalizePhone, telegramApi } from "@/lib/telegram"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

type TelegramMessage = {
  message_id: number
  text?: string
  from?: { id: number | string; is_bot?: boolean; first_name?: string; last_name?: string; username?: string }
  chat: { id: number | string; type: string }
  contact?: { phone_number?: string; user_id?: number | string; first_name?: string; last_name?: string }
}

type TelegramUpdate = { message?: TelegramMessage }

const MODERATION_NOTICE_COOLDOWN_MS = 60 * 60 * 1000
const moderationNoticeTimes = new Map<string, number>()

function hasValidWebhookSecret(request: NextRequest, secret: string) {
  const received = request.headers.get("x-telegram-bot-api-secret-token") || ""
  const expectedBuffer = Buffer.from(secret)
  const receivedBuffer = Buffer.from(received)
  return expectedBuffer.length === receivedBuffer.length && crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
}

function canSendModerationNotice(chatId: string, telegramId: string) {
  const now = Date.now()
  const key = `${chatId}:${telegramId}`
  const lastSentAt = moderationNoticeTimes.get(key)
  if (lastSentAt && now - lastSentAt < MODERATION_NOTICE_COOLDOWN_MS) return false
  moderationNoticeTimes.set(key, now)
  if (moderationNoticeTimes.size > 2_000) {
    for (const [noticeKey, sentAt] of moderationNoticeTimes) {
      if (now - sentAt > MODERATION_NOTICE_COOLDOWN_MS) moderationNoticeTimes.delete(noticeKey)
    }
  }
  return true
}

function getBotStartUrl() {
  const username = getTelegramBotUsername()
  return username ? `https://t.me/${username}?start=authorize` : null
}

async function sendMiniAppEntry(chatId: string, greeting: string) {
  const miniAppUrl = getTelegramMiniAppUrl()
  if (!miniAppUrl) return

  const catalogueUrl = new URL("/auctions", miniAppUrl).toString()

  await telegramApi("sendMessage", {
    chat_id: chatId,
    text: greeting,
    reply_markup: {
      inline_keyboard: [
        [{ text: "Открыть Mini App", web_app: { url: miniAppUrl } }],
        [{ text: "Смотреть автомобили", url: catalogueUrl }],
      ],
    },
  })
}

async function sendContactRequest(chatId: string) {
  await telegramApi("sendMessage", {
    chat_id: chatId,
    text: "Добро пожаловать! Подтвердите номер одной кнопкой — это откроет безопасный вход, Mini App, объявления и доступ к чатам.",
    reply_markup: {
      keyboard: [[{ text: "Отправить мой контакт", request_contact: true }]],
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  })
}

async function handleMessage(message: TelegramMessage) {
  if (!message.from || message.from.is_bot) return
  const telegramId = String(message.from.id)
  const chatId = String(message.chat.id)

  if (message.text?.trim().toLowerCase().startsWith("/start")) {
    if (message.chat.type === "private") {
      const user = await prisma.user.findUnique({ where: { telegramId }, select: { telegramVerifiedAt: true, phone: true } })
      if (isTelegramUserRegistered(user)) {
        await sendMiniAppEntry(chatId, "Вы уже подтверждены. В Mini App можно подать объявление, посмотреть аукционы, АЗС и продолжить сделку.")
        return
      }
      await sendContactRequest(chatId)
    }
    else await telegramApi("sendMessage", {
      chat_id: chatId,
      text: "Для доступа к этому чату откройте личный диалог с ботом, нажмите «Старт» и подтвердите свой контакт.",
      reply_markup: getBotStartUrl() ? { inline_keyboard: [[{ text: "Авторизоваться в боте", url: getBotStartUrl()! }]] } : undefined,
    })
    return
  }

  if (message.text?.trim().toLowerCase().startsWith("/help") && message.chat.type === "private") {
    const user = await prisma.user.findUnique({ where: { telegramId }, select: { telegramVerifiedAt: true, phone: true } })
    if (isTelegramUserRegistered(user)) {
      await sendMiniAppEntry(chatId, "Доступ активен. Откройте Mini App для объявлений, аукционов, избранного и доставок.")
    } else {
      await sendContactRequest(chatId)
    }
    return
  }

  if (message.contact) {
    if (message.chat.type !== "private" || String(message.contact.user_id) !== telegramId) {
      await telegramApi("sendMessage", { chat_id: chatId, text: "Отправьте именно свой контакт из личного чата с ботом." })
      return
    }
    const phone = normalizePhone(message.contact.phone_number)
    if (!phone) {
      await telegramApi("sendMessage", { chat_id: chatId, text: "Не удалось распознать номер. Попробуйте отправить контакт ещё раз." })
      return
    }

    const user = await linkTelegramIdentity({
      telegramId,
      phone,
      username: message.from.username,
      name: [message.contact.first_name || message.from.first_name, message.contact.last_name || message.from.last_name].filter(Boolean).join(" "),
    })
    await telegramApi("sendMessage", {
      chat_id: chatId,
      text: `Готово, ${user.name || "друг"}! Контакт подтверждён. Теперь доступны вход на сайт, Mini App и чаты.`,
      reply_markup: { remove_keyboard: true },
    })
    await sendMiniAppEntry(chatId, "Mini App готов: объявления, избранное, доставки и карта АЗС доступны в одном окне.")
    return
  }

  const user = await prisma.user.findUnique({ where: { telegramId }, select: { telegramVerifiedAt: true, phone: true } })
  if ((message.chat.type === "group" || message.chat.type === "supergroup") && !isTelegramUserRegistered(user) && await canModerateTelegramChat(chatId)) {
    let wasDeleted = false
    try {
      await telegramApi("deleteMessage", { chat_id: chatId, message_id: message.message_id })
      wasDeleted = true
    } catch (error) {
      console.error("Telegram message deletion failed:", error)
    }
    if (wasDeleted && canSendModerationNotice(chatId, telegramId)) {
      await telegramApi("sendMessage", {
        chat_id: chatId,
        text: "Сообщение удалено: сначала подтвердите контакт в личном чате с ботом. После этого доступ в группу откроется автоматически.",
        reply_markup: getBotStartUrl() ? { inline_keyboard: [[{ text: "Авторизоваться", url: getBotStartUrl()! }]] } : undefined,
      }).catch((error) => console.error("Telegram moderation notice failed:", error))
    }
  }
}

export async function POST(request: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!secret) return NextResponse.json({ error: "Telegram webhook is not configured" }, { status: 503 })
  if (!hasValidWebhookSecret(request, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const update = await request.json() as TelegramUpdate
    if (update.message) await handleMessage(update.message)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Telegram webhook error:", error)
    return NextResponse.json({ ok: true })
  }
}
