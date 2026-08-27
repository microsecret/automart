/**
 * Публикация оплаченных объявлений в сети Telegram-чатов.
 *
 * Сеть из одиннадцати региональных групп со ста четырнадцатью тысячами
 * подписчиков — главный актив площадки. Он держится на доверии людей к
 * этим чатам, поэтому здесь важнее не «разместить побольше», а не
 * превратить ленты в спам: из чата, забитого объявлениями, подписчики
 * уходят, и продвижение перестаёт стоить своих денег.
 *
 * Отсюда правила: повтор не чаще раза в двое суток на чат, закреп по
 * очереди (место закрепа в группе одно), пауза между отправками.
 */

import { prisma } from "@/lib/prisma"
import { telegramApi, getTelegramBotUsername } from "@/lib/telegram"
import { absoluteUrl } from "@/lib/site-url"
import { buildChatPost, type PromotedListing } from "@/lib/chat-promotion-post"

/** Не чаще раза в двое суток на чат: иначе лента превращается в спам. */
export const REPOST_INTERVAL_MS = 2 * 24 * 60 * 60 * 1000

/** Пауза между чатами: Telegram допускает около двадцати сообщений в минуту. */
const CHAT_PAUSE_MS = 3_500

type SendResult = { chatId: string; messageId: number | null; error?: string }

/**
 * Публикует объявление в одном чате.
 *
 * Фотографии уходят альбомом, текст — отдельным сообщением с кнопками:
 * Telegram не позволяет прикрепить кнопки к альбому, а кнопки здесь
 * важнее — ради них продвижение и покупают.
 */
async function publishToChat(chatId: string, post: ReturnType<typeof buildChatPost>): Promise<SendResult> {
  try {
    if (post.photos.length > 1) {
      await telegramApi("sendMediaGroup", {
        chat_id: chatId,
        media: post.photos.map((url) => ({ type: "photo", media: url })),
      })
    } else if (post.photos.length === 1) {
      await telegramApi("sendPhoto", { chat_id: chatId, photo: post.photos[0] })
    }

    const message = await telegramApi<{ message_id: number }>("sendMessage", {
      chat_id: chatId,
      text: post.caption,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: { inline_keyboard: post.buttons.map((button) => [{ text: button.text, url: button.url }]) },
    })

    return { chatId, messageId: message.message_id }
  } catch (error) {
    return { chatId, messageId: null, error: error instanceof Error ? error.message.slice(0, 300) : "Не удалось отправить" }
  }
}

/**
 * Закрепляет сообщение и снимает прежний закреп этой же площадки.
 *
 * Место закрепа в группе одно, поэтому новый пост вытесняет прежний. Мы
 * снимаем свой предыдущий закреп сами: иначе в записях останутся
 * «закреплённые» посты, которых в чате уже не видно.
 */
async function pinAndUnpinPrevious(chatId: string, messageId: number): Promise<boolean> {
  try {
    await telegramApi("pinChatMessage", {
      chat_id: chatId,
      message_id: messageId,
      /* Без уведомления: закреп объявления — не новость, ради которой
         стоит будить сотню тысяч человек. */
      disable_notification: true,
    })

    const previous = await prisma.chatPromotionPost.findMany({
      where: { chatId, pinned: true, removedAt: null, NOT: { messageId } },
      select: { id: true, messageId: true },
    })

    for (const post of previous) {
      await telegramApi("unpinChatMessage", { chat_id: chatId, message_id: post.messageId }).catch(() => {})
      await prisma.chatPromotionPost.update({ where: { id: post.id }, data: { pinned: false } })
    }

    return true
  } catch {
    /* Бот без прав администратора закрепить не может — это не повод
       считать саму публикацию неудачной. */
    return false
  }
}

/**
 * Публикует все оплаченные объявления, которым пора появиться в чатах.
 *
 * Вызывается по расписанию. За один заход обрабатывается ограниченное
 * число заказов: сотня публикаций подряд упрётся в ограничения Telegram
 * и растянет выполнение на часы.
 */
export async function runChatPromotionDelivery(options: { maxOrders?: number } = {}) {
  const now = new Date()
  const maxOrders = options.maxOrders ?? 5

  const orders = await prisma.promotionOrder.findMany({
    where: { tariffId: "chats", status: "PAID", promoUntil: { gt: now } },
    orderBy: { paidAt: "asc" },
    take: maxOrders,
    select: {
      id: true,
      listingId: true,
      listing: {
        select: {
          id: true, title: true, price: true, status: true, deletedAt: true,
          vehicle: { select: { id: true, year: true, mileage: true, power: true, fuelType: true, transmission: true, images: true, location: true } },
          user: { select: { telegramId: true } },
        },
      },
    },
  })

  if (!orders.length) return { processed: 0, published: 0, pinned: 0, skipped: 0 }

  const chats = await prisma.telegramChat.findMany({
    where: { active: true, marketingEnabled: true },
    select: { id: true },
  })

  const botUsername = getTelegramBotUsername()
  const siteUrl = absoluteUrl("/")

  let published = 0
  let pinned = 0
  let skipped = 0

  for (const order of orders) {
    /* Снятое или скрытое объявление в чатах не публикуется: продавец мог
       уже продать машину, и звонки по чужому объявлению никому не нужны. */
    if (!order.listing || order.listing.deletedAt || order.listing.status !== "ACTIVE" || !order.listing.vehicle) {
      skipped += 1
      continue
    }

    const vehicle = order.listing.vehicle
    const images = parseImages(vehicle.images)

    const listing: PromotedListing = {
      id: vehicle.id,
      title: order.listing.title,
      price: order.listing.price,
      city: vehicle.location,
      year: vehicle.year,
      mileage: vehicle.mileage,
      power: vehicle.power,
      fuelType: vehicle.fuelType,
      transmission: vehicle.transmission,
      images,
      sellerTelegramId: order.listing.user?.telegramId ?? null,
    }

    const post = buildChatPost(listing, { siteUrl, botUsername: botUsername || undefined })

    for (const chat of chats) {
      /* Тот же заказ в тот же чат — не чаще раза в двое суток. */
      const recent = await prisma.chatPromotionPost.findFirst({
        where: { orderId: order.id, chatId: chat.id, publishedAt: { gt: new Date(now.getTime() - REPOST_INTERVAL_MS) } },
        select: { id: true },
      })
      if (recent) continue

      const result = await publishToChat(chat.id, post)
      if (!result.messageId) {
        console.error(`Продвижение в чате ${chat.id}: ${result.error}`)
        continue
      }

      const wasPinned = await pinAndUnpinPrevious(chat.id, result.messageId)

      await prisma.chatPromotionPost.create({
        data: { orderId: order.id, chatId: chat.id, messageId: result.messageId, pinned: wasPinned },
      })

      published += 1
      if (wasPinned) pinned += 1

      await new Promise((resolve) => setTimeout(resolve, CHAT_PAUSE_MS))
    }
  }

  return { processed: orders.length, published, pinned, skipped }
}

/**
 * Убирает посты завершившихся размещений.
 *
 * Оплаченный месяц кончился — объявление не должно висеть закреплённым
 * дальше: человек платил за срок, а чат не должен показывать
 * неактуальное.
 */
export async function cleanupExpiredChatPromotions() {
  const now = new Date()

  const expired = await prisma.chatPromotionPost.findMany({
    where: { removedAt: null, order: { promoUntil: { lte: now } } },
    select: { id: true, chatId: true, messageId: true, pinned: true },
    take: 200,
  })

  let removed = 0
  for (const post of expired) {
    if (post.pinned) {
      await telegramApi("unpinChatMessage", { chat_id: post.chatId, message_id: post.messageId }).catch(() => {})
    }
    /* Само сообщение удаляем: закреп снят, но объявление месячной
       давности в ленте только мешает. */
    await telegramApi("deleteMessage", { chat_id: post.chatId, message_id: post.messageId }).catch(() => {})
    await prisma.chatPromotionPost.update({ where: { id: post.id }, data: { removedAt: now, pinned: false } })
    removed += 1
  }

  return { removed }
}

/** Разбор поля с фотографиями: в базе они лежат строкой JSON. */
function parseImages(value: string | null): string[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []
  } catch {
    return []
  }
}
