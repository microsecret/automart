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
  type TelegramRegistrationStep,
} from "@/lib/telegram"
import { prisma } from "@/lib/prisma"
import { scheduleTelegramMessageCleanup } from "@/lib/telegram-message-cleanup"
import { registerTelegramGroup, setTelegramChatMarketing } from "@/lib/telegram-marketing"
import { describePendingSteps, resumeButtonLabel } from "@/lib/telegram-registration-copy"
import { touchTelegramContact } from "@/lib/telegram-contacts"
import { absoluteUrl } from "@/lib/site-url"
import { forwardNoticeText, isChannelForward } from "@/lib/telegram-forward-guard"

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

  /* Пересылка приходит двумя способами: forward_origin в новом формате
     Bot API и forward_from_chat в старом. Клиенты обновляются вразнобой,
     поэтому смотрим оба. */
  forward_origin?: {
    type?: string
    chat?: { id?: number | string; type?: string; title?: string; username?: string }
    sender_chat?: { id?: number | string; type?: string; title?: string; username?: string }
    sender_user_name?: string
  }
  forward_from_chat?: { id?: number | string; type?: string; title?: string; username?: string }
  /** Собственный канал группы: его посты пересылать можно. */
  sender_chat?: { id?: number | string; type?: string }
  is_automatic_forward?: boolean
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

/** Чат с отчётами о проверке автомобилей. */
const VEHICLE_REPORTS_CHAT_URL = "https://t.me/autoproverka"

/**
 * Клавиатура системных сообщений: регистрация, размещение и отчёты.
 *
 * Третья кнопка ведёт в чат с проверками: человек, которому только что скрыли
 * сообщение, чаще всего выбирает машину — ему полезнее увидеть отчёты, чем
 * просто требование зарегистрироваться.
 */
function registrationKeyboard(registerLabel: string) {
  const startUrl = getBotStartUrl()
  if (!startUrl) return undefined
  const createUrl = getBotCreateUrl()
  return {
    inline_keyboard: [
      [{ text: registerLabel, url: startUrl }],
      ...(createUrl ? [[{ text: "🚗 Разместить объявление", url: createUrl }]] : []),
      [{ text: "📋 Отчёты об авто", url: VEHICLE_REPORTS_CHAT_URL }],
    ],
  }
}

function telegramUserMention(from: NonNullable<TelegramMessage["from"]>) {
  const displayName = [from.first_name, from.last_name].filter(Boolean).join(" ").trim() || "пользователь Telegram"
  const mention = `<a href="tg://user?id=${encodeURIComponent(String(from.id))}">${escapeTelegramHtml(displayName)}</a>`
  const username = from.username?.trim().replace(/^@/, "")
  return username ? `${mention} (@${escapeTelegramHtml(username)})` : mention
}

/**
 * Системное сообщение бота.
 *
 * Картинка отправляется, только если в окружении задан её file_id. Загружать
 * файл при каждой отправке нельзя: с этого сервера выгрузка в Telegram не
 * проходит — проверено на 310 КБ и на 32 КБ, обрывается даже за четыре минуты,
 * хотя обычные запросы идут за две секунды. Из-за этого каждое сообщение
 * сначала ждало таймаут, а картинку всё равно не получало (51 отказ за шесть
 * часов в логах).
 *
 * Готовый file_id обходит выгрузку целиком: Telegram берёт картинку из своего
 * хранилища. Получить его можно, отправив файл боту вручную с любой машины,
 * у которой выгрузка работает.
 */
const BRANDED_PHOTO_FILE_ID = process.env.TELEGRAM_BRANDED_PHOTO_ID?.trim()

async function sendBrandedMessage(
  chatId: string,
  text: string,
  replyMarkup?: Record<string, unknown>,
) {
  if (BRANDED_PHOTO_FILE_ID) {
    try {
      return await telegramApi<TelegramSentMessage>("sendPhoto", {
        chat_id: chatId,
        photo: BRANDED_PHOTO_FILE_ID,
        caption: text,
        parse_mode: "HTML",
        reply_markup: replyMarkup,
      })
    } catch (error) {
      console.error("Telegram branded photo failed; sending text:", error)
    }
  }

  return telegramApi<TelegramSentMessage>("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    reply_markup: replyMarkup,
  })
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
        [{ text: "🚘 Открыть LeWheel", web_app: { url: miniAppUrl } }],
        // Большинство приходит продавать, а не смотреть, — размещение должно
        // быть на виду сразу после регистрации.
        [{ text: "🚗 Разместить объявление", web_app: { url: createUrl } }],
        [{ text: "🌍 Смотреть автомобили", url: catalogueUrl }],
      ],
  })
}

/**
 * Анимированные стикеры на ключевых шагах.
 *
 * Обычные эмодзи в тексте Telegram не оживляет — движутся только премиум-эмодзи,
 * а для них боту нужен Premium. Стикер работает у всех и даёт то самое живое
 * движение в чате.
 *
 * Отправка не критична: если стикер недоступен (набор удалён, сеть подвела),
 * регистрация продолжается молча — ронять шаг из-за украшения нельзя.
 */
const REGISTRATION_STICKERS = {
  // Приветствие в начале регистрации.
  welcome: process.env.TELEGRAM_STICKER_WELCOME?.trim(),
  // Празднование после третьего шага.
  done: process.env.TELEGRAM_STICKER_DONE?.trim(),
}

async function sendStickerIfConfigured(chatId: string, sticker?: string) {
  if (!sticker) return
  try {
    await telegramApi("sendSticker", { chat_id: chatId, sticker })
  } catch (error) {
    console.warn("Telegram sticker delivery skipped:", error)
  }
}

async function sendContactRequest(chatId: string, firstName?: string) {
  const safeName = escapeTelegramHtml(firstName?.trim() || "друг")
  await sendStickerIfConfigured(chatId, REGISTRATION_STICKERS.welcome)
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
      keyboard: [[{ text: "📱 Отправить мой контакт", request_contact: true }]],
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
  await sendStickerIfConfigured(chatId, REGISTRATION_STICKERS.done)
  await sendMiniAppEntry(chatId, [
    `🎉 <b>${safeName}, добро пожаловать в LeWheel!</b>`,
    "",
    "✅ Телефон подтверждён",
    "✅ Почта сохранена",
    "✅ Пароль защищён",
    "",
    "🚗 <b>Разместите первое объявление — это бесплатно</b>",
    "Прямо здесь, в приложении: фото, цена, пара характеристик — и машина на витрине.",
    "",
    "🌍 Объявление появится сразу в двух местах:",
    "• в приложении LeWheel — его видят все, кто заходит из Telegram;",
    "• на сайте <b>lewheel.ru</b> — туда приходят из поиска Яндекса и Google.",
    "",
    "🔑 Входить больше не нужно: приложение узнаёт вас по Telegram.",
    "На сайте — почта или телефон и ваш пароль.",
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

  // Отмечаем контакт при любом личном сообщении, включая самое первое
  // «Начать». До этого человек, не подтвердивший телефон, нигде не
  // сохранялся — а таких большинство, и именно они аудитория рассылки.
  if (message.chat.type === "private") {
    void touchTelegramContact({
      telegramId,
      username: message.from.username,
      firstName: message.from.first_name,
      lastName: message.from.last_name,
    })
  }

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
      await telegramApi("sendMessage", {
        chat_id: chatId,
        text: "⚠️ Отправьте именно <b>свой контакт</b> из личного чата с ботом.",
        parse_mode: "HTML",
      reply_markup: {
        keyboard: [[{ text: "📱 Отправить мой контакт", request_contact: true }]],
        resize_keyboard: true,
        one_time_keyboard: true,
        input_field_placeholder: "Нажмите кнопку для шага 1",
      },
      })
      return
    }
    const phone = normalizePhone(message.contact.phone_number)
    if (!phone) {
      await telegramApi("sendMessage", {
        chat_id: chatId,
        text: "⚠️ Не удалось распознать номер. Попробуйте отправить контакт ещё раз.",
      reply_markup: {
        keyboard: [[{ text: "📱 Отправить мой контакт", request_contact: true }]],
        resize_keyboard: true,
        one_time_keyboard: true,
        input_field_placeholder: "Нажмите кнопку для шага 1",
      },
      })
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
        /* Конфликт личности — тупик, из которого человек сам не выйдет.

           Раньше здесь было «напишите в поддержку» без адреса: куда именно
           писать, не сказано. Даём кнопку — иначе человек со сменившимся
           номером телефона просто теряет доступ к своему аккаунту. */
        await telegramApi("sendMessage", {
          chat_id: chatId,
          text: [
            "⚠️ <b>Этот Telegram и номер относятся к разным аккаунтам.</b>",
            "",
            "Так бывает после смены номера или переустановки Telegram.",
            "Объединить данные может только поддержка — напишите нам, и мы всё восстановим.",
          ].join("\n"),
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [[{ text: "💬 Написать в поддержку", url: absoluteUrl("/help/support") }]],
          },
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
      /* Сообщение с паролем удаляется сразу, до попытки сохранения.

         Раньше удаление стояло внутри успешной ветки: если пароль оказывался
         короче восьми символов или база была недоступна, сообщение с ним
         оставалось в переписке навсегда. Telegram хранит историю в облаке и
         синхронизирует на все устройства, а человек обычно вводит один и тот
         же пароль повторно — то есть в чате оставался рабочий пароль. */
      await telegramApi("deleteMessage", {
        chat_id: chatId,
        message_id: message.message_id,
      }).catch(() => undefined)

      try {
        await completeTelegramRegistration(telegramId, message.text.trim())
        // Отмечаем в учёте контактов: в рассылке эти люди отделяются от тех,
        // кто открыл бота и до конца не дошёл.
        void touchTelegramContact({
          telegramId,
          username: message.from.username,
          firstName: message.from.first_name,
          lastName: message.from.last_name,
        }, true)
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
  /* Личное сообщение без текста — фото, голосовое, стикер, документ.

     Раньше такие сообщения проваливались мимо всех веток, и бот молчал.
     Человек на шаге «поделитесь контактом» часто не понимает, что нужна
     кнопка, и присылает скриншот или голосовое — в ответ была тишина, из
     которой не выбраться.

     Напоминаем, чего бот ждёт сейчас. */
  if (message.chat.type === "private" && !message.text) {
    const currentUser = await getTelegramUser(telegramId)
    const currentStep = getTelegramRegistrationStep(currentUser)
    if (currentStep !== "complete") {
      await sendRegistrationStep(chatId, currentStep, message.from?.first_name, currentUser?.name)
      return
    }
  }

  /* Администраторы группы под модерацию не попадают.

     Роль отправителя раньше не проверялась вовсе: владелец чата, который сам
     не проходил регистрацию на площадке, молча терял собственные сообщения
     от собственного бота. Это самое болезненное из ложных срабатываний.

     Запрос роли делается последним — только когда все остальные условия уже
     совпали, чтобы не ходить в Telegram на каждое сообщение чата. */
  const isChatAdmin = async () => {
    if (message.chat.type !== "group" && message.chat.type !== "supergroup") return false
    // Сообщение может прийти от имени канала — тогда отправителя нет.
    if (!message.from?.id) return false
    const member = await telegramApi<{ status: string }>("getChatMember", {
      chat_id: chatId,
      user_id: message.from.id,
    }).catch(() => null)
    return member?.status === "creator" || member?.status === "owner" || member?.status === "administrator"
  }

  const isGroupChat = message.chat.type === "group" || message.chat.type === "supergroup"

  /* Пересылка из чужого канала удаляется у всех, кроме администраторов.

     Это реклама независимо от того, кто её прислал: зарегистрированный
     человек так же может закинуть чужой пост. Поэтому проверка отдельна
     от проверки регистрации. */
  if (
    isGroupChat &&
    isChannelForward(message) &&
    await canModerateTelegramChat(chatId) &&
    !(await isChatAdmin())
  ) {
    let wasDeleted = false
    try {
      await telegramApi("deleteMessage", { chat_id: chatId, message_id: message.message_id })
      wasDeleted = true
    } catch (error) {
      console.error("Telegram forward deletion failed:", error)
    }
    if (wasDeleted && canSendModerationNotice(chatId, telegramId)) {
      const sentMessage = await sendBrandedMessage(
        chatId,
        forwardNoticeText(telegramUserMention(message.from)),
        registrationKeyboard(resumeButtonLabel(pendingStep)),
      )
      await scheduleTemporarySystemMessage(chatId, sentMessage)
    }
    return
  }

  if (
    isGroupChat &&
    hasModeratableContent(message) &&
    !isTelegramUserRegistered(user) &&
    await canModerateTelegramChat(chatId) &&
    !(await isChatAdmin())
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
        // «Скрыто» вводило в заблуждение: сообщение удалено, а не спрятано.
        // Дальше сразу объясняем выгоду, а не одно требование.
        `🗑 <b>${userMention}, ваше сообщение удалено</b>`,
        "",
        "Чтобы размещать объявления в чате <b>бесплатно</b>, пройдите быструю регистрацию в боте:",
        ...describePendingSteps(pendingStep),
        "",
        "✅ После регистрации вы сможете снова бесплатно размещать свои объявления в чате.",
        "⏳ Это уведомление исчезнет через 5 минут.",
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

  let update: TelegramUpdate
  try {
    update = await request.json() as TelegramUpdate
  } catch (error) {
    console.error("Telegram webhook payload error:", error)
    return NextResponse.json({ ok: true })
  }

  if (!update.message) return NextResponse.json({ ok: true })

  // Обработка запускается, но ответ не ждёт её завершения.
  //
  // Раньше здесь стоял await: отправка инфографики к уведомлению о модерации
  // занимает до 30 секунд (картинка 1.5 МБ, до трёх повторов), а мост
  // long-polling ждёт локальный вебхук только 15. Ответ не приходил, offset не
  // двигался, и одно и то же сообщение обрабатывалось по кругу — очередь
  // вставала, а остальные сообщения в чатах оставались без модерации.
  //
  // Удаление сообщения нарушителя — первое, что делает handleMessage, поэтому
  // модерация от этого не замедляется; в фоне остаётся только доставка
  // уведомления.
  void handleMessage(update.message).catch((error) => {
    console.error("Telegram webhook error:", error)
  })

  return NextResponse.json({ ok: true })
}
