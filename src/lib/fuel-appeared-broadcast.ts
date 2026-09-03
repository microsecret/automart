import { prisma } from "@/lib/prisma"
import { telegramApi, getTelegramBotUsername } from "@/lib/telegram"
import { absoluteUrl } from "@/lib/site-url"
import { cityFromChatTitle } from "@/lib/fuel-invite-post"
import { buildFuelAppearedPost } from "@/lib/fuel-appeared-post"

/**
 * Сообщение в городской чат, когда на заправке появилось топливо.
 *
 * Отличается от суточной сводки тем, ради чего и существует: сводка
 * рассказывает, где топливо было сегодня, а это — что оно появилось
 * только что, там, где его не было. В дефицит это главная новость
 * города: человек, час назад проехавший мимо пустой колонки, узнаёт
 * сейчас, а не из завтрашней сводки.
 *
 * Чат выбирается по городу самой заправки, а не по тому, кто отметил:
 * появление бензина в Уфе интересно чату Уфы, кем бы ни был отметивший.
 *
 * Рассылка идёт в фоне и молча: отметка сохраняется в любом случае,
 * сорвавшееся сообщение в чат не должно возвращать человеку ошибку.
 */

/* Не чаще одного сообщения в час на заправку.
 *
 * В дефицит на одну колонку приходит по десятку отметок подряд — от
 * очереди, где каждый второй отмечает то же самое. Без порога чат
 * превратился бы в ленту повторов, и его выключили бы вместе с
 * полезными сообщениями. */
const CHAT_COOLDOWN_MS = 60 * 60_000

/* Одно сообщение на весь чат чаще, чем раз в десять минут, тоже лишнее:
   в час пик заправки отчитываются пачками, и чат должен оставаться
   читаемым. */
const CHAT_GLOBAL_COOLDOWN_MS = 10 * 60_000

export type AppearedBroadcastInput = {
  stationId: string
  stationName: string
  address?: string | null
  city: string
  fuelLabels: string[]
  priceKopecks?: number | null
  confirmations?: number
  latitude?: number | null
  longitude?: number | null
}

/** Города, где чат уже есть: по ним и рассылаем. */
function matchesCity(chatCity: string, stationCity: string): boolean {
  const chat = chatCity.toLocaleLowerCase("ru-RU")
  const station = stationCity.toLocaleLowerCase("ru-RU")
  /* Совпадение по вхождению: заправка подписана «Верхняя Пышма», а чат
     называется «Бензин Екатеринбург» — область одна, и человеку из
     Екатеринбурга такая заправка нужна. Обратное вхождение покрывает
     случай, когда город заправки длиннее названия чата. */
  return chat.includes(station) || station.includes(chat)
}

export async function broadcastFuelAppeared(input: AppearedBroadcastInput): Promise<boolean> {
  if (!input.city.trim() || input.fuelLabels.length === 0) return false

  try {
    const chats = await prisma.telegramChat.findMany({
      where: { active: true, marketingEnabled: true },
      select: { id: true, title: true, lastPromoAt: true },
    })

    const target = chats.find((chat) => {
      const chatCity = cityFromChatTitle(chat.title)
      return chatCity ? matchesCity(chatCity, input.city) : false
    })
    if (!target) return false

    const now = Date.now()

    /* Порог по заправке: одна и та же колонка не должна попадать в чат
       десять раз подряд от очереди отмечающих. */
    const recent = await prisma.fuelChatPost.findFirst({
      where: {
        chatId: target.id,
        stationId: input.stationId,
        createdAt: { gte: new Date(now - CHAT_COOLDOWN_MS) },
      },
      select: { id: true },
    })
    if (recent) return false

    /* Порог по чату целиком: в час пик заправки отчитываются пачками. */
    const recentAny = await prisma.fuelChatPost.findFirst({
      where: { chatId: target.id, createdAt: { gte: new Date(now - CHAT_GLOBAL_COOLDOWN_MS) } },
      select: { id: true },
    })
    if (recentAny) return false

    const post = buildFuelAppearedPost({
      stationName: input.stationName,
      address: input.address ?? null,
      city: input.city,
      fuelLabels: input.fuelLabels,
      priceKopecks: input.priceKopecks ?? null,
      confirmations: input.confirmations,
      stationId: input.stationId,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      siteUrl: absoluteUrl("/"),
      botUsername: getTelegramBotUsername(),
    })

    await telegramApi("sendMessage", {
      chat_id: target.id,
      text: post.text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: { inline_keyboard: post.buttons },
    })

    await prisma.fuelChatPost.create({
      data: { chatId: target.id, stationId: input.stationId, fuels: input.fuelLabels.join(",") },
    })

    return true
  } catch (error) {
    /* Молча: отметка водителя уже сохранена, и сорвавшееся сообщение в
       чат не повод показывать ему ошибку. */
    console.error("Fuel appeared broadcast failed", error instanceof Error ? error.message : error)
    return false
  }
}
