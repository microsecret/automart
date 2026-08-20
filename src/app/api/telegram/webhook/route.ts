import crypto from "crypto"
import { NextRequest, NextResponse } from "next/server"
import {
  canModerateTelegramChat,
  completeTelegramRegistration,
  getTelegramBotUsername,
  getTelegramMiniAppUrl,
  getTelegramRegistrationStep,
  isTelegramUserRegistered,
  linkTelegramIdentity,
  normalizePhone,
  saveTelegramRegistrationEmail,
  TelegramIdentityConflictError,
  TelegramRegistrationError,
  telegramApi,
  telegramPhotoApi,
  type TelegramRegistrationStep,
} from "@/lib/telegram"
import { prisma } from "@/lib/prisma"
import { scheduleTelegramMessageCleanup } from "@/lib/telegram-message-cleanup"
import { registerTelegramGroup, setTelegramChatMarketing } from "@/lib/telegram-marketing"
import { describePendingSteps, resumeButtonLabel } from "@/lib/telegram-registration-copy"

export const dynamic = "force-dynamic"

type TelegramMessage = {
  message_id: number
  text?: string
  caption?: string
  from?: { id: number | string; is_bot?: boolean; first_name?: string; last_name?: string; username?: string }
  chat: { id: number | string; type: string; title?: string }
  contact?: { phone_number?: string; user_id?: number | string; first_name?: string; last_name?: string }
  photo?: unknown
  video?: unknown
  animation?: unknown
  document?: unknown
  audio?: unknown
  voice?: unknown
  sticker?: unknown
  video_note?: unknown
  location?: unknown
  venue?: unknown
  poll?: unknown
  dice?: unknown
}

type TelegramUpdate = { message?: TelegramMessage }
type TelegramSentMessage = { message_id: number }

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
  return username ? `https://t.me/${username}?start=register` : null
}

/**
 * Ссылка на быструю подачу объявления в Mini App.
 *
 * Сообщение о регистрации видят как раз те, кто пришёл что-то продать или
 * купить. Одна кнопка «зарегистрируйтесь» объясняет требование, но не даёт
 * повода его пройти — вторая показывает, ради чего это делается.
 */
function getBotCreateUrl() {
  const username = getTelegramBotUsername()
  return username ? `https://t.me/${username}?startapp=create` : null
}

/** Клавиатура системных сообщений: регистрация плюс размещение объявления. */
function registrationKeyboard(registerLabel: string) {
  const startUrl = getBotStartUrl()
  if (!startUrl) return undefined
  const createUrl = getBotCreateUrl()
  return {
    inline_keyboard: [
      [{ text: registerLabel, style: "primary", url: startUrl }],
      ...(createUrl ? [[{ text: "🚗 Разместить объявление", url: createUrl }]] : []),
    ],
  }
}

function telegramUserMention(from: NonNullable<TelegramMessage["from"]>) {
  const displayName = [from.first_name, from.last_name].filter(Boolean).join(" ").trim() || "пользователь Telegram"
  const mention = `<a href="tg://user?id=${encodeURIComponent(String(from.id))}">${escapeTelegramHtml(displayName)}</a>`
  const username = from.username?.trim().replace(/^@/, "")
  return username ? `${mention} (@${escapeTelegramHtml(username)})` : mention
}

async function sendBrandedMessage(
  chatId: string,
  text: string,
  replyMarkup?: Record<string, unknown>,
) {
  try {
    return await telegramPhotoApi<TelegramSentMessage>({
      chat_id: chatId,
      caption: text,
      parse_mode: "HTML",
      reply_markup: replyMarkup,
    })
  } catch (error) {
    console.error("Telegram infographic delivery failed; sending text fallback:", error)
    return telegramApi<TelegramSentMessage>("sendMessage", {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      reply_markup: replyMarkup,
    })
  }
}

async function scheduleTemporarySystemMessage(chatId: string, message: TelegramSentMessage) {
  try {
    await scheduleTelegramMessageCleanup(chatId, message.message_id)
  } catch (error) {
    console.error("Telegram system message cleanup could not be scheduled:", error)
  }
}

async function sendMiniAppEntry(chatId: string, greeting: string) {
  const miniAppUrl = getTelegramMiniAppUrl()
  if (!miniAppUrl) {
    await telegramApi("sendMessage", { chat_id: chatId, text: greeting, parse_mode: "HTML" })
    return
  }

  const catalogueUrl = new URL("/auctions", miniAppUrl).toString()
  // Через точку входа Mini App, а не напрямую на форму: страница подачи
  // закрыта middleware, и гость улетел бы на форму пароля прямо внутри
  // Telegram. Точка входа авторизует по Telegram ID и сама доведёт до формы.
  const createUrl = new URL("/telegram?start=create", miniAppUrl).toString()

  await sendBrandedMessage(chatId, greeting, {
      inline_keyboard: [
        [{ text: "🚘 Открыть LeWheel", style: "success", web_app: { url: miniAppUrl } }],
        // Большинство приходит продавать, а не смотреть, — размещение должно
        // быть на виду сразу после регистрации.
        [{ text: "🚗 Разместить объявление", web_app: { url: createUrl } }],
        [{ text: "🌍 Смотреть автомобили", url: catalogueUrl }],
      ],
  })
}

async function sendContactRequest(chatId: string, firstName?: string) {
  const safeName = escapeTelegramHtml(firstName?.trim() || "друг")
  await telegramApi("sendMessage", {
    chat_id: chatId,
    text: [
      `🚘 <b>Добро пожаловать в LeWheel, ${safeName}!</b>`,
      "",
      "Регистрация займёт около минуты — всего <b>3 простых шага</b>.",
      "",
      "<b>Шаг 1 из 3 — подтвердите телефон</b> 📱",
      "Нажмите кнопку ниже и отправьте свой контакт. Номер будет привязан к вашему Telegram ID.",
      "",
      "🔒 <i>Мы принимаем только ваш собственный контакт.</i>",
    ].join("\n"),
    parse_mode: "HTML",
    reply_markup: {
      keyboard: [[{ text: "📱 Отправить мой контакт", style: "success", request_contact: true }]],
      resize_keyboard: true,
      one_time_keyboard: true,
      input_field_placeholder: "Нажмите кнопку для шага 1",
    },
  })
}

async function sendEmailRequest(chatId: string) {
  await telegramApi("sendMessage", {
    chat_id: chatId,
    text: [
      "📧 <b>Шаг 2 из 3 — укажите почту</b>",
      "",
      "<b>Просто напишите свой email в этот чат</b> — обычным сообщением, как пишете друзьям.",
      "",
      "<i>Например: ivan@mail.ru</i>",
    ].join("\n"),
    parse_mode: "HTML",
    reply_markup: {
      force_reply: true,
      // selective действует только в группах, а в приватном чате мешает
      // force_reply открыть поле ввода.
      input_field_placeholder: "ivan@mail.ru",
    },
  })
}

async function sendPasswordRequest(chatId: string) {
  await telegramApi("sendMessage", {
    chat_id: chatId,
    text: [
      "🔐 <b>Шаг 3 из 3 — придумайте пароль</b>",
      "",
      "<b>Напишите пароль в этот чат</b> — от <b>8 символов</b>. С ним и почтой вы будете входить на сайте.",
      "",
      "🛡 <i>В базе хранится только защищённый хэш пароля.</i>",
    ].join("\n"),
    parse_mode: "HTML",
    reply_markup: {
      force_reply: true,
      // selective действует только в группах и мешает force_reply в личке.
      input_field_placeholder: "Минимум 8 символов",
    },
  })
}

async function sendRegistrationComplete(chatId: string, name?: string | null) {
  const safeName = escapeTelegramHtml(name?.trim() || "друг")
  await sendMiniAppEntry(chatId, [
    `🎉 <b>${safeName}, регистрация завершена!</b>`,
    "",
    "✅ Телефон подтверждён",
    "✅ Почта сохранена",
    "✅ Пароль защищён",
    "",
    "Теперь Mini App будет узнавать вас по Telegram ID и входить автоматически. На сайте используйте почту или телефон и свой пароль.",
  ].join("\n"))
}

function escapeTelegramHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

function hasModeratableContent(message: TelegramMessage) {
  return Boolean(
    message.text || message.caption || message.photo || message.video || message.animation ||
    message.document || message.audio || message.voice || message.sticker || message.video_note ||
    message.contact || message.location || message.venue || message.poll || message.dice,
  )
}

async function getTelegramUser(telegramId: string) {
  return prisma.user.findUnique({
    where: { telegramId },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      phone: true,
      telegramVerifiedAt: true,
      hashedPassword: true,
    },
  })
}

async function sendRegistrationStep(chatId: string, step: TelegramRegistrationStep, firstName?: string, accountName?: string | null) {
  if (step === "contact") return sendContactRequest(chatId, firstName)
  if (step === "email") return sendEmailRequest(chatId)
  if (step === "password") return sendPasswordRequest(chatId)
  return sendRegistrationComplete(chatId, accountName || firstName)
}

async function handleMessage(message: TelegramMessage) {
  if (!message.from || message.from.is_bot) return
  const telegramId = String(message.from.id)
  const chatId = String(message.chat.id)

  if (message.chat.type === "group" || message.chat.type === "supergroup") {
    await registerTelegramGroup(message.chat)
    const command = message.text?.trim().toLowerCase().split(/\s+/)[0]?.split("@")[0]
    if (command === "/promo_on" || command === "/promo_off") {
      const member = await telegramApi<{ status: string }>("getChatMember", { chat_id: chatId, user_id: message.from.id }).catch(() => null)
      const allowed = member?.status === "creator" || member?.status === "owner" || member?.status === "administrator"
      const enabled = command === "/promo_on"
      const sentMessage = await telegramApi<TelegramSentMessage>("sendMessage", {
        chat_id: chatId,
        text: allowed
          ? enabled ? "✅ <b>Новости LeWheel включены.</b> Полезный обзор сервиса будет выходить не чаще одного раза в 8 часов." : "🔕 <b>Новости LeWheel отключены для этого чата.</b> Включить снова можно командой /promo_on."
          : "⚠️ Управлять рассылкой LeWheel могут только администраторы этого чата.",
        parse_mode: "HTML",
      })
      if (allowed) await setTelegramChatMarketing(chatId, enabled)
      await scheduleTemporarySystemMessage(chatId, sentMessage)
      return
    }
  }

  if (message.text?.trim().toLowerCase().startsWith("/start")) {
    if (message.chat.type === "private") {
      const user = await getTelegramUser(telegramId)
      await sendRegistrationStep(chatId, getTelegramRegistrationStep(user), message.from.first_name, user?.name)
    }
    else {
      const sentMessage = await telegramApi<TelegramSentMessage>("sendMessage", {
        chat_id: chatId,
        text: "🔐 <b>Регистрация проходит в личном чате с ботом.</b>\n\nПодтвердите телефон, укажите почту и придумайте пароль — после этого доступ к чату откроется автоматически.\n\n⏳ Это системное сообщение исчезнет через 5 минут.",
        parse_mode: "HTML",
        reply_markup: registrationKeyboard("🚀 Пройти регистрацию"),
      })
      await scheduleTemporarySystemMessage(chatId, sentMessage)
    }
    return
  }

  if (message.text?.trim().toLowerCase().startsWith("/help") && message.chat.type === "private") {
    const user = await getTelegramUser(telegramId)
    await sendRegistrationStep(chatId, getTelegramRegistrationStep(user), message.from.first_name, user?.name)
    return
  }

  if (message.contact) {
    if (message.chat.type !== "private" || String(message.contact.user_id) !== telegramId) {
      await telegramApi("sendMessage", { chat_id: chatId, text: "⚠️ Отправьте именно <b>свой контакт</b> из личного чата с ботом.", parse_mode: "HTML" })
      return
    }
    const phone = normalizePhone(message.contact.phone_number)
    if (!phone) {
      await telegramApi("sendMessage", { chat_id: chatId, text: "⚠️ Не удалось распознать номер. Попробуйте отправить контакт ещё раз." })
      return
    }

    try {
      const user = await linkTelegramIdentity({
        telegramId,
        phone,
        username: message.from.username,
        name: [message.contact.first_name || message.from.first_name, message.contact.last_name || message.from.last_name].filter(Boolean).join(" "),
      })
      const step = getTelegramRegistrationStep(user)
      if (step === "complete") {
        await telegramApi("sendMessage", {
          chat_id: chatId,
          text: "✅ <b>Контакт подтверждён.</b> Ваш Telegram ID уже связан с аккаунтом.",
          parse_mode: "HTML",
          reply_markup: { remove_keyboard: true },
        })
        await sendRegistrationComplete(chatId, user.name)
        return
      }
      await telegramApi("sendMessage", {
        chat_id: chatId,
        text: "✅ <b>Шаг 1 выполнен!</b> Телефон подтверждён и Telegram ID сохранён.",
        parse_mode: "HTML",
        reply_markup: { remove_keyboard: true },
      })
      await sendEmailRequest(chatId)
    } catch (error) {
      if (error instanceof TelegramIdentityConflictError) {
        await telegramApi("sendMessage", {
          chat_id: chatId,
          text: "⚠️ Этот Telegram ID и номер уже относятся к разным аккаунтам. Напишите в поддержку, чтобы безопасно объединить данные.",
          reply_markup: { remove_keyboard: true },
        })
        return
      }
      throw error
    }
    return
  }

  if (message.chat.type === "private" && message.text) {
    const user = await getTelegramUser(telegramId)
    const step = getTelegramRegistrationStep(user)
    if (step === "email") {
      try {
        await saveTelegramRegistrationEmail(telegramId, message.text)
        await telegramApi("sendMessage", {
          chat_id: chatId,
          text: "✅ <b>Шаг 2 выполнен!</b> Почта сохранена.",
          parse_mode: "HTML",
        })
        await sendPasswordRequest(chatId)
      } catch (error) {
        const text = error instanceof TelegramRegistrationError
          ? `⚠️ ${escapeTelegramHtml(error.message)}\n\nНапишите другой email в этот чат.`
          : "⚠️ Не удалось сохранить почту. Попробуйте ещё раз немного позже."
        // Поле ввода открывается снова: без него человек упирается в ту же
        // стену, что и в первый раз, и бросает регистрацию на этом шаге.
        await telegramApi("sendMessage", {
          chat_id: chatId,
          text,
          parse_mode: "HTML",
          reply_markup: { force_reply: true, input_field_placeholder: "ivan@mail.ru" },
        })
      }
      return
    }
    if (step === "password") {
      try {
        await completeTelegramRegistration(telegramId, message.text.trim())
        await telegramApi("deleteMessage", { chat_id: chatId, message_id: message.message_id }).catch(() => undefined)
        const completedUser = await getTelegramUser(telegramId)
        await sendRegistrationComplete(chatId, completedUser?.name)
      } catch (error) {
        const text = error instanceof TelegramRegistrationError
          ? `⚠️ ${escapeTelegramHtml(error.message)}. Напишите другой пароль в этот чат.`
          : "⚠️ Не удалось сохранить пароль. Попробуйте ещё раз немного позже."
        // Поле ввода открывается заново, иначе человек упирается в ту же стену.
        await telegramApi("sendMessage", {
          chat_id: chatId,
          text,
          parse_mode: "HTML",
          reply_markup: { force_reply: true, input_field_placeholder: "Минимум 8 символов" },
        })
      }
      return
    }
    await sendRegistrationStep(chatId, step, message.from.first_name, user?.name)
    return
  }

  const user = await getTelegramUser(telegramId)
  const pendingStep = getTelegramRegistrationStep(user)
  if (
    (message.chat.type === "group" || message.chat.type === "supergroup") &&
    hasModeratableContent(message) &&
    !isTelegramUserRegistered(user) &&
    await canModerateTelegramChat(chatId)
  ) {
    let wasDeleted = false
    try {
      await telegramApi("deleteMessage", { chat_id: chatId, message_id: message.message_id })
      wasDeleted = true
    } catch (error) {
      console.error("Telegram message deletion failed:", error)
    }
    if (wasDeleted && canSendModerationNotice(chatId, telegramId)) {
      const userMention = telegramUserMention(message.from)
      const sentMessage = await sendBrandedMessage(chatId, [
        `🔐 <b>${userMention}, сообщение скрыто</b>`,
        ...describePendingSteps(pendingStep),
        "",
        "✅ После регистрации сообщения и медиа будут публиковаться автоматически.",
        "⏳ Системное уведомление удалится через 5 минут.",
      ].join("\n"), registrationKeyboard(resumeButtonLabel(pendingStep)))
      await scheduleTemporarySystemMessage(chatId, sentMessage)
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
