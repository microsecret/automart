import { prisma } from "@/lib/prisma"
import { absoluteUrl } from "@/lib/site-url"
import { getTelegramBotUsername, isTelegramChatAdministrator, telegramApi, telegramPhotoApi } from "@/lib/telegram"
import { scheduleTelegramMessageCleanup } from "@/lib/telegram-message-cleanup"

const PROMO_INTERVAL_MS = Math.max(
  60 * 60 * 1000,
  Number(process.env.TELEGRAM_PROMO_INTERVAL_MS || 12 * 60 * 60 * 1000),
)
const PROMO_BATCH_SIZE = 20

function normalizePositiveInteger(value: string | undefined, fallback: number, min: number, max?: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < min) return fallback
  if (max && parsed > max) return max
  return parsed
}

const PROMO_SYSTEM_TTL_MS = normalizePositiveInteger(
  process.env.TELEGRAM_SYSTEM_MESSAGE_TTL_MS,
  5 * 60 * 1000,
  30_000,
  60 * 60 * 1000,
)

async function scheduleTemporaryCleanup(chatId: string, message: TelegramSentMessage) {
  if (!message?.message_id) return
  await scheduleTelegramMessageCleanup(chatId, message.message_id, Date.now() + PROMO_SYSTEM_TTL_MS).catch((error) => {
    console.error("[telegram-marketing] Failed to schedule cleanup:", error)
  })
}

type TelegramSentMessage = { message_id: number }

function buildPromoText() {
  const botUsername = getTelegramBotUsername()
  return [
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
    "",
    `🌐 <a href="${absoluteUrl("/?utm_source=telegram&utm_campaign=service_promo&utm_content=caption_link")}">lewheel.ru</a>`,
    botUsername ? `🤖 Официальный бот: @${botUsername}` : null,
  ].filter(Boolean).join("\n")
}

export const TELEGRAM_PROMO_TEXT = buildPromoText()

/**
 * Второй текст рассылки — предложение платного продвижения.
 *
 * Один и тот же пост, повторяемый месяцами, перестают замечать. Тексты
 * чередуются: сервисный рассказывает о площадке, этот зовёт продавцов
 * подключить размещение в сети чатов и приносит деньги.
 */
function buildPromotionOfferText() {
  const botUsername = getTelegramBotUsername()
  return [
    "📣 <b>Продаёте машину? Разместим её за вас во всех чатах сети</b>",
    "",
    "Ваше объявление появится в <b>11 региональных чатах</b> — Уфа, Казань, Москва, Екатеринбург, Тюмень, Владивосток и другие города.",
    "",
    "✅ До 9 фотографий альбомом",
    "✅ Кнопка «Написать продавцу» прямо в посте",
    "✅ Закрепление поста в чате",
    "✅ Повторные публикации весь месяц",
    "",
    "💳 <b>300 ₽ за месяц</b> — дешевле продвижения на других площадках.",
    "",
    "📝 Разместить объявление на сайте по-прежнему <b>бесплатно</b>.",
    "",
    `🌐 <a href="${absoluteUrl("/?utm_source=telegram&utm_campaign=chat_promo")}">lewheel.ru</a>`,
    botUsername ? `🤖 Официальный бот: @${botUsername}` : null,
  ].filter(Boolean).join("\n")
}

export const TELEGRAM_PROMOTION_OFFER_TEXT = buildPromotionOfferText()

/**
 * Кнопки предложения продвижения: путь к оплате и к бесплатной подаче.
 *
 * Бесплатная подача рядом с платной услугой не мешает продажам, а
 * снимает недоверие: человек видит, что деньги берут за охват, а не за
 * саму возможность разместиться.
 */
function promotionOfferKeyboard() {
  const botUsername = getTelegramBotUsername()
  return {
    inline_keyboard: [
      [{ text: "🚀 Подключить продвижение", url: absoluteUrl("/dashboard?tab=listings&utm_source=telegram&utm_campaign=chat_promo") }],
      [
        { text: "➕ Разместить бесплатно", url: botUsername ? `https://t.me/${botUsername}?startapp=create` : absoluteUrl("/listings/create/vehicle?utm_source=telegram&utm_campaign=chat_promo") },
        { text: "🌐 На сайт", url: absoluteUrl("/?utm_source=telegram&utm_campaign=chat_promo") },
      ],
    ],
  }
}

function promoKeyboard() {
  const botUsername = getTelegramBotUsername()
  const miniAppUrl = botUsername ? `https://t.me/${botUsername}?startapp=promo` : absoluteUrl("/telegram")
  return {
    inline_keyboard: [
      [{ text: "🚘 Открыть Mini App", url: miniAppUrl }, { text: "🌍 Аукционы", url: absoluteUrl("/auctions?utm_source=telegram&utm_campaign=service_promo&utm_content=auctions") }],
      // Подача идёт в Mini App: там вход уже выполнен через Telegram, поэтому
      // незарегистрированный пользователь не упирается в форму регистрации, а
      // сразу размещает объявление. Ссылка на сайт остаётся второй кнопкой для
      // тех, кому удобнее полная форма.
      [
        { text: "➕ Разместить объявление", url: botUsername ? `https://t.me/${botUsername}?startapp=create` : absoluteUrl("/listings/create/vehicle?utm_source=telegram&utm_campaign=service_promo&utm_content=create_mini_app") },
        { text: "🖥 Подать на сайте", url: absoluteUrl("/listings/create/vehicle?utm_source=telegram&utm_campaign=service_promo&utm_content=create_website") },
      ],
      [{ text: "🤝 Стать партнёром", url: absoluteUrl("/dashboard/deliveries?partner=apply&utm_source=telegram&utm_campaign=service_promo&utm_content=partner") }, { text: "🌐 Перейти на сайт", url: absoluteUrl("/?utm_source=telegram&utm_campaign=service_promo&utm_content=homepage") }],
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
      if (!(await isTelegramChatAdministrator(chat.id))) {
        await prisma.telegramChat.update({
          where: { id: chat.id },
          data: { lastPromoAt: claimedAt, lastError: "Для рекламной рассылки боту требуются права администратора" },
        })
        failed += 1
        continue
      }
      /* Тексты чередуются от раза к разу: один и тот же пост, повторяемый
         месяцами, перестают замечать. Половина суток на текст — признак,
         одинаковый для всех чатов в одном прогоне и меняющийся между
         прогонами. */
      const offerTurn = Math.floor(claimedAt.getTime() / (12 * 60 * 60 * 1000)) % 2 === 1
      const promoText = offerTurn ? TELEGRAM_PROMOTION_OFFER_TEXT : TELEGRAM_PROMO_TEXT
      const promoMarkup = offerTurn ? promotionOfferKeyboard() : promoKeyboard()

      let sent: TelegramSentMessage
      try {
        sent = await telegramPhotoApi<TelegramSentMessage>({
          chat_id: chat.id,
          caption: promoText,
          parse_mode: "HTML",
          reply_markup: promoMarkup,
        })
      } catch {
        sent = await telegramApi<TelegramSentMessage>("sendMessage", {
          chat_id: chat.id,
          text: promoText,
          parse_mode: "HTML",
          reply_markup: promoMarkup,
        })
      }
      await prisma.telegramChat.update({
        where: { id: chat.id },
        data: { lastPromoAt: claimedAt, lastPromoMessage: sent.message_id, lastError: null },
      })
      await scheduleTemporaryCleanup(chat.id, sent)
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
