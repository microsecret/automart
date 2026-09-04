import { prisma } from "@/lib/prisma"
import { getTelegramBotUsername } from "@/lib/telegram"
import { absoluteUrl } from "@/lib/site-url"
import { cityFromChatTitle } from "@/lib/fuel-invite-post"
import { buildFuelAppearedPost } from "@/lib/fuel-appeared-post"
import { sendChatPost } from "@/lib/telegram-post-sender"
import { enqueueAppearances, delayUntilNextPost, type QueuedAppearance } from "@/lib/fuel-appeared-queue"

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

/* Ритм чата задаёт очередь: минута между сообщениями, шаг в
   fuel-appeared-queue. Раньше здесь стоял порог, который лишние новости
   просто выбрасывал — теперь они ждут своей минуты и уходят все. */

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

/* Очередь на процесс: заправка ждёт своей минуты, а не выбрасывается.

   Прогон сбора приносит появления пачкой, и раньше в чат уходила только
   первая новость — остальные молча гасил порог. Теперь они становятся в
   очередь и уходят по одной; очередь живёт в памяти процесса, потому что
   переживать перезапуск ей незачем: следующий прогон принесёт свежие
   появления, а вчерашние никому не нужны. */
const pending = new Map<string, QueuedAppearance<AppearedBroadcastInput>[]>()
const draining = new Set<string>()

/** Кому и что шлём: чат уже выбран, порог по заправке уже пройден. */
type Ready = { chatId: string; input: AppearedBroadcastInput }

async function sendOne(chatId: string, input: AppearedBroadcastInput): Promise<boolean> {
  const image = appearedImage()

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

  /* Отправка через общий отправитель: он умеет фотографию и ряды кнопок,
     и он же знает, что делать, когда картинка не читается — уходит
     текстом, а не теряется совсем. */
  const messageId = await sendChatPost(
    chatId,
    { photos: image ? [image] : [], caption: post.text, buttons: post.buttons },
  )
  if (!messageId) return false

  await prisma.fuelChatPost.create({
    data: { chatId, stationId: input.stationId, fuels: input.fuelLabels.join(",") },
  })

  return true
}

/**
 * Разбирает очередь чата: по сообщению, между ними — пауза.
 *
 * Работает в фоне и в одном экземпляре на чат: флаг `draining` не даёт
 * двум прогонам разбирать одну очередь одновременно, иначе вернулась бы
 * та самая пачка сообщений в одну секунду, ради которой всё и затевалось.
 */
async function drain(chatId: string): Promise<void> {
  if (draining.has(chatId)) return
  draining.add(chatId)

  try {
    for (;;) {
      const queue = pending.get(chatId)
      if (!queue || queue.length === 0) break

      const last = await prisma.fuelChatPost.findFirst({
        where: { chatId },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      })

      const wait = delayUntilNextPost(last?.createdAt ?? null, new Date())
      if (wait > 0) {
        await new Promise((resolve) => setTimeout(resolve, wait))
        continue
      }

      const next = queue.shift()
      if (!next) break

      /* Порог по самой заправке проверяем перед отправкой, а не при
         постановке в очередь: пока сообщение ждало минуту, ту же колонку
         мог отметить водитель, и повтор в чате был бы виден всем. */
      const recent = await prisma.fuelChatPost.findFirst({
        where: {
          chatId,
          stationId: next.payload.stationId,
          createdAt: { gte: new Date(Date.now() - CHAT_COOLDOWN_MS) },
        },
        select: { id: true },
      })
      if (recent) continue

      await sendOne(chatId, next.payload)
    }
  } catch (error) {
    /* Молча: отметка водителя уже сохранена, и сорвавшееся сообщение в
       чат не повод показывать ему ошибку. */
    console.error("Fuel appeared queue failed", error instanceof Error ? error.message : error)
  } finally {
    draining.delete(chatId)
    /* Пока разбирали очередь, прогон мог доложить новых появлений —
       перезапускаемся, иначе они пролежат до следующего прогона. */
    const rest = pending.get(chatId)
    if (rest && rest.length > 0) void drain(chatId)
  }
}

/* Список чатов держим в памяти пять минут.
 *
 * Прогон по стране проходит четырнадцать тысяч заправок, и каждая
 * спрашивала у базы одно и то же: какие чаты активны. Чаты заводит
 * человек руками, раз в несколько недель — пять минут задержки здесь
 * незаметны, а четырнадцать тысяч запросов подряд заметны. */
const CHATS_CACHE_MS = 5 * 60_000
let chatsCache: { at: number; chats: Array<{ id: string; title: string | null }> } | null = null

async function activeChats(): Promise<Array<{ id: string; title: string | null }>> {
  if (chatsCache && Date.now() - chatsCache.at < CHATS_CACHE_MS) return chatsCache.chats

  const chats = await prisma.telegramChat.findMany({
    where: { active: true, marketingEnabled: true },
    select: { id: true, title: true },
  })

  chatsCache = { at: Date.now(), chats }
  return chats
}

/** Находит чат города и отсеивает то, о чём писали только что. */
async function resolveTarget(input: AppearedBroadcastInput): Promise<Ready | null> {
  const chats = await activeChats()

  const target = chats.find((chat) => {
    const chatCity = cityFromChatTitle(chat.title)
    return chatCity ? matchesCity(chatCity, input.city) : false
  })
  if (!target) return null

  /* Порог по заправке: одна и та же колонка не должна попадать в чат
     десять раз подряд от очереди отмечающих. */
  const recent = await prisma.fuelChatPost.findFirst({
    where: {
      chatId: target.id,
      stationId: input.stationId,
      createdAt: { gte: new Date(Date.now() - CHAT_COOLDOWN_MS) },
    },
    select: { id: true },
  })
  if (recent) return null

  return { chatId: target.id, input }
}

/**
 * Ставит появление топлива в очередь городского чата.
 *
 * Возвращает `true`, когда новость принята к отправке, а не когда она
 * ушла: между постановкой и сообщением может пройти до минуты, и держать
 * ради этого прогон сбора незачем.
 */
export async function broadcastFuelAppeared(input: AppearedBroadcastInput): Promise<boolean> {
  if (!input.city.trim() || input.fuelLabels.length === 0) return false

  try {
    const ready = await resolveTarget(input)
    if (!ready) return false

    const queue = pending.get(ready.chatId) ?? []
    const next = enqueueAppearances(queue, [{ key: input.stationId, payload: input }])
    pending.set(ready.chatId, next)

    void drain(ready.chatId)
    return true
  } catch (error) {
    console.error("Fuel appeared broadcast failed", error instanceof Error ? error.message : error)
    return false
  }
}

/** Для тестов и диагностики: сколько новостей ждут своей минуты. */
export function pendingAppearedCount(chatId: string): number {
  return pending.get(chatId)?.length ?? 0
}
