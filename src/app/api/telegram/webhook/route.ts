import { NextRequest, NextResponse } from "next/server"
import { isModeratedChat, isTelegramUserRegistered, linkTelegramIdentity, normalizePhone, telegramApi } from "@/lib/telegram"
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

async function sendContactRequest(chatId: string) {
  await telegramApi("sendMessage", {
    chat_id: chatId,
    text: "Добро пожаловать в Авторынок. Нажмите кнопку ниже — так мы подтвердим номер и откроем доступ к сайту и чатам.",
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
    if (message.chat.type === "private") await sendContactRequest(chatId)
    else await telegramApi("sendMessage", { chat_id: chatId, text: "Для регистрации откройте личный чат с ботом и отправьте контакт." })
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
      text: `Готово, ${user.name || "друг"}! Вы авторизованы в Авторынке. Теперь можно открыть сайт, Mini App и писать в наши чаты.`,
      reply_markup: { remove_keyboard: true },
    })
    return
  }

  const user = await prisma.user.findUnique({ where: { telegramId }, select: { telegramVerifiedAt: true, phone: true } })
  if (isModeratedChat(chatId) && !isTelegramUserRegistered(user)) {
    try {
      await telegramApi("deleteMessage", { chat_id: chatId, message_id: message.message_id })
    } catch (error) {
      console.error("Telegram message deletion failed:", error)
    }
    await telegramApi("sendMessage", {
      chat_id: chatId,
      text: "Сообщение удалено: сначала зарегистрируйтесь через @бота Авторынка и подтвердите контакт.",
    }).catch((error) => console.error("Telegram moderation notice failed:", error))
  }
}

export async function POST(request: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!secret) return NextResponse.json({ error: "Telegram webhook is not configured" }, { status: 503 })
  if (request.headers.get("x-telegram-bot-api-secret-token") !== secret) {
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
