import { prisma } from "@/lib/prisma"
import { getTelegramBotUsername } from "@/lib/telegram"
import { absoluteUrl } from "@/lib/site-url"
import { cityFromChatTitle } from "@/lib/fuel-invite-post"
import { buildFuelAppearedPost } from "@/lib/fuel-appeared-post"
import { sendChatPost } from "@/lib/telegram-post-sender"

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

/* Одна и та же заправка — не чаще раза в двадцать минут.
 *
 * Порог нужен от повторов: в дефицит на одну колонку приходит пачка
 * отметок от очереди, где каждый второй отмечает то же самое. Час был
 * слишком осторожно — за это время топливо успевает и появиться, и
 * кончиться, и появиться снова, а чат об этом молчал. */
const CHAT_COOLDOWN_MS = 20 * 60_000

/* По чату целиком — минута.
 *
 * Владелец просил, чтобы чат поднимался наверх и люди видели: система
 * работает. Разные заправки — разные новости, и держать их по десять
 * минут значит терять смысл: человек узнаёт о топливе, когда мимо уже
 * проехал.
 *
 * Минута выбрана по ограничению Telegram: в группу можно слать не чаще
 * двадцати сообщений в минуту, и один пост в минуту не приближается к
 * этой границе даже близко. */
const CHAT_GLOBAL_COOLDOWN_MS = 60_000

/**
 * Картинка сообщения.
 *
 * Пост с фотографией виден в ленте чата, текстовый теряется между
 * разговорами: на скриншотах соседних сервисов сообщение о топливе —
 * всегда карточка с картинкой.
 *
 * Правила те же, что у приглашений: свой файл читается с диска и только
 * из /uploads, чужой адрес Telegram скачивает сам. Ссылку на наш домен
 * он не берёт — отвечает «failed to get HTTP URL content», и пост не
 * уходит вовсе. Поэтому при неверной настройке лучше отправить текстом,
 * чем не отправить ничего.
 */
function appearedImage(): string | null {
  const configured = (process.env.FUEL_APPEARED_IMAGE || process.env.FUEL_INVITE_IMAGE)?.trim()
  if (!configured) return null
  if (configured.startsWith("http")) return configured
  if (!configured.startsWith("/uploads/")) return null
  return configured
}

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

    const image = appearedImage()
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

    /* Отправка через общий отправитель: он умеет фотографию и ряды
       кнопок, и он же знает, что делать, когда картинка не читается —
       уходит текстом, а не теряется совсем. */
    const messageId = await sendChatPost(
      target.id,
      { photos: image ? [image] : [], caption: post.text, buttons: post.buttons },
    )
    if (!messageId) return false

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
