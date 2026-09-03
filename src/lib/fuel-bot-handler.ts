/**
 * Отметка наличия топлива через бота.
 *
 * Человек шлёт точку скрепкой, бот находит ближайшую заправку и
 * спрашивает кнопками. Два нажатия вместо открытия сайта, выбора города
 * и поиска точки на карте — за рулём это разница между «отмечу» и
 * «потом как-нибудь».
 *
 * Правила отбора — в fuel-bot-report, они проверяются тестами без базы.
 */

import { prisma } from "@/lib/prisma"
import { getTelegramMiniAppUrl, telegramApi } from "@/lib/telegram"
import { absoluteUrl } from "@/lib/site-url"
import {
  buildAction,
  distanceKm,
  formatDistance,
  matchStation,
  parseAction,
  type BotStation,
} from "@/lib/fuel-bot-report"
import {
  decidePresencePrompt,
  isSameStop,
  presencePromptText,
  PRESENCE_RADIUS_KM,
  PRESENCE_STALE_MINUTES,
} from "@/lib/fuel-presence"
import {
  AVAILABILITY_FUEL_LABELS,
  STALE_WINDOW_MS,
  summarizeAvailability,
  type AvailabilityFuel,
} from "@/lib/fuel-availability"
import { notifyFuelSubscribers } from "@/lib/fuel-subscription-notify"

/**
 * Марки в кнопках: три самые ходовые.
 *
 * Шесть кнопок в два ряда человек за рулём читает дольше, чем ему нужно.
 * Про 98-й и газ спрашивают редко, и отметить их можно на сайте.
 */
const BOT_FUELS: AvailabilityFuel[] = ["AI92", "AI95", "DT"]

/**
 * Ищет заправки рядом с точкой.
 *
 * Справочник точек живёт в OpenStreetMap, а не у нас: запрашиваем узкой
 * областью вокруг человека, а не по городу — так ответ приходит за
 * секунду вместо семи.
 */
async function findStationsNear(point: { latitude: number; longitude: number }): Promise<BotStation[]> {
  try {
    const response = await fetch(
      absoluteUrl(`/api/fuel-stations?latitude=${point.latitude}&longitude=${point.longitude}`),
      { signal: AbortSignal.timeout(12_000) },
    )
    if (!response.ok) return []

    const payload = await response.json() as {
      stations?: Array<{ id: string; name: string; latitude: number; longitude: number }>
    }
    return (payload.stations || []).map((station) => ({
      id: station.id,
      name: station.name,
      latitude: station.latitude,
      longitude: station.longitude,
    }))
  } catch (error) {
    console.error("[fuel-bot] Поиск заправок:", error)
    return []
  }
}

/** Клавиатура вопроса «что здесь есть». */
/* Координаты нужны ссылке «следить»: карта открывает заправку, только
   если та попала в выборку, а человек из бота часто в другом городе —
   без них ссылка вела бы на карту без нужной точки. */
function fuelKeyboard(stationId: string, point?: { latitude: number; longitude: number } | null) {
  const watchUrl = point
    ? absoluteUrl(`/services/fuel-map?station=${encodeURIComponent(stationId)}&lat=${point.latitude}&lng=${point.longitude}&from=telegram`)
    : absoluteUrl(`/services/fuel-map?station=${encodeURIComponent(stationId)}&from=telegram`)

  return {
    inline_keyboard: [
      ...BOT_FUELS.map((fuel) => [
        {
          text: `✅ ${AVAILABILITY_FUEL_LABELS[fuel]} есть`,
          callback_data: buildAction({ kind: "fuel", stationId, fuel, state: "YES" }),
        },
        {
          text: `❌ ${AVAILABILITY_FUEL_LABELS[fuel]} нет`,
          callback_data: buildAction({ kind: "fuel", stationId, fuel, state: "NO" }),
        },
      ]),
      /* Ссылка ведёт прямо на эту заправку, а не на общую карту.

         Человек только что отметил на ней топливо — он думает про
         конкретную точку, и общая карта заставила бы искать её заново.
         На открытой карточке стоит кнопка подписки: бот напишет, когда
         топливо появится. Это единственная возможность, ради которой
         стоит заводить учётную запись, и до неё должно быть одно
         нажатие. */
      [{ text: "🔔 Следить за этой АЗС", url: watchUrl }],
      [{ text: "🗺 Открыть карту", url: absoluteUrl("/services/fuel-map?from=telegram") }],
    ],
  }
}

/**
 * Обрабатывает присланную точку.
 *
 * Возвращает признак того, что сообщение было про топливо: вызывающий по
 * нему решает, продолжать ли обычную обработку.
 */
export async function handleFuelLocation(
  chatId: string,
  point: { latitude: number; longitude: number },
): Promise<boolean> {
  const stations = await findStationsNear(point)
  const match = matchStation(point, stations)

  if (match.kind === "none") {
    await telegramApi("sendMessage", {
      chat_id: chatId,
      text:
        "🤔 <b>Рядом заправок не нашли</b>\n\n"
        + "Возможно, вы не на АЗС или её нет в справочнике OpenStreetMap. "
        + "Отметить наличие можно на карте — там же видно, где топливо есть.",
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: {
        inline_keyboard: [[{ text: "🗺 Открыть карту", url: absoluteUrl("/services/fuel-map?from=telegram") }]],
      },
    }).catch(() => undefined)
    return true
  }

  if (match.kind === "choice") {
    await telegramApi("sendMessage", {
      chat_id: chatId,
      text: "⛽ <b>Какая заправка?</b>\n\nРядом несколько — выберите свою.",
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: match.stations.map(({ station, km }) => [{
          text: `${station.name} · ${formatDistance(km)}`,
          callback_data: buildAction({ kind: "station", stationId: station.id }),
        }]),
      },
    }).catch(() => undefined)
    return true
  }

  await telegramApi("sendMessage", {
    chat_id: chatId,
    text:
      `⛽ <b>${escapeHtml(match.station.name)}</b>\n`
      + `<i>в ${formatDistance(match.km)} от вас</i>\n\n`
      + "Что здесь сейчас есть? Отметьте — это увидят другие водители.",
    parse_mode: "HTML",
    reply_markup: fuelKeyboard(match.station.id, { latitude: match.station.latitude, longitude: match.station.longitude }),
  }).catch(() => undefined)

  return true
}

/**
 * Обрабатывает нажатие кнопки.
 *
 * Возвращает признак того, что нажатие было про топливо.
 */
export async function handleFuelCallback(input: {
  callbackId: string
  chatId: string
  messageId: number
  telegramId: string
  data: string
}): Promise<boolean> {
  const action = parseAction(input.data)
  if (!action) return false

  /* Ответить Telegram надо в любом случае и быстро: без этого кнопка
     крутится у человека до истечения срока. */
  const answer = (text: string) =>
    telegramApi("answerCallbackQuery", { callback_query_id: input.callbackId, text }).catch(() => undefined)

  /* Координаты заправки для ссылки «следить»: в нажатии приходит только
     её идентификатор, а карта без координат может не найти точку —
     человек из бота часто в другом городе, чем открытая у него карта.
     Один короткий запрос дешевле, чем ссылка, ведущая не туда. */
  const stationPoint = action.stationId
    ? await prisma.fuelStationImport.findFirst({
        where: { id: action.stationId },
        select: { latitude: true, longitude: true },
      }).catch(() => null)
    : null

  if (action.kind === "station") {
    await answer("")
    await telegramApi("editMessageText", {
      chat_id: input.chatId,
      message_id: input.messageId,
      text: "⛽ <b>Что здесь сейчас есть?</b>\n\nОтметьте — это увидят другие водители.",
      parse_mode: "HTML",
      reply_markup: fuelKeyboard(action.stationId, stationPoint),
    }).catch(() => undefined)
    return true
  }

  if (action.kind !== "fuel") {
    await answer("")
    return true
  }

  const user = await prisma.user.findUnique({
    where: { telegramId: input.telegramId },
    select: { id: true },
  }).catch(() => null)

  /* Координаты берутся из справочника прежних отметок, а не из кнопки: в
     кнопке им места нет — Telegram даёт 64 байта, — а придумывать их
     нельзя, по ним точка попадёт на карту. */
  const previous = await prisma.fuelAvailabilityReport.findFirst({
    where: { stationId: action.stationId },
    orderBy: { createdAt: "desc" },
    select: { latitude: true, longitude: true },
  }).catch(() => null)

  await prisma.fuelAvailabilityReport.create({
    data: {
      stationId: action.stationId,
      /* Первая отметка этой точки из бота: координат неоткуда взять, и
         карта покажет её по самой заправке из справочника, а не по
         нулям. */
      latitude: previous?.latitude ?? 0,
      longitude: previous?.longitude ?? 0,
      fuel: action.fuel,
      state: action.state,
      userId: user?.id ?? null,
    },
  }).catch((error) => {
    console.error("[fuel-bot] Запись отметки:", error)
    return null
  })

  const label = AVAILABILITY_FUEL_LABELS[action.fuel as AvailabilityFuel] || action.fuel
  await answer(action.state === "YES" ? `Записали: ${label} есть` : `Записали: ${label} нет`)

  /* Сводка по заправке — чтобы человек увидел, что его отметка сложилась
     с чужими, а не улетела в пустоту. */
  const reports = await prisma.fuelAvailabilityReport.findMany({
    where: { stationId: action.stationId, createdAt: { gte: new Date(Date.now() - STALE_WINDOW_MS) } },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { fuel: true, state: true, queue: true, photo: true, comment: true, createdAt: true },
  }).catch(() => [])

  const summary = summarizeAvailability(reports)
  const line = summary.length
    ? summary.map((row) => `${row.state === "YES" ? "✅" : "❌"} ${row.label}`).join(" · ")
    : "пока только ваша отметка"

  await telegramApi("editMessageText", {
    chat_id: input.chatId,
    message_id: input.messageId,
    text:
      "✅ <b>Спасибо, записали</b>\n\n"
      + `Сейчас на этой заправке: ${line}\n\n`
      + "<i>Отметьте ещё марку или пришлите точку на другой заправке.</i>",
    parse_mode: "HTML",
    reply_markup: fuelKeyboard(action.stationId, stationPoint),
  }).catch(() => undefined)

  /* Подписчиков будим тем же путём, что и с сайта: появление топлива не
     зависит от того, откуда пришла отметка. */
  if (action.state === "YES") {
    void notifyFuelSubscribers({
      stationId: action.stationId,
      stationName: "АЗС",
      city: "",
      fuel: action.fuel,
      fuelLabel: label,
    })
  }

  return true
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

/**
 * Обновление живой геолокации: человек транслирует геопозицию.
 *
 * Карта живёт отметками, а отмечают редко: за рулём никто не открывает
 * сайт и не заполняет форму — заправился и уехал. Но если человек один
 * раз включил трансляцию, площадка видит, что он остановился у АЗС, и
 * может спросить в тот единственный момент, когда ответ ничего не стоит:
 * он стоит у колонки и только что видел табло.
 *
 * Ничего не спрашиваем, пока он не простоял достаточно долго: заправка
 * занимает пять-семь минут вместе с очередью, и вопрос через две минуты
 * означал бы, что мы приняли светофор за колонку.
 */
export async function handleLiveLocation(
  chatId: string,
  point: { latitude: number; longitude: number },
): Promise<void> {
  /* Дешёвая проверка раньше дорогой.

     Telegram шлёт обновление трансляции раз в минуту с каждого телефона.
     При тысяче водителей это тысяча обращений в минуту, и каждое лезло
     бы в справочник заправок — свой HTTP-запрос, а при промахе кэша ещё
     и поход в OpenStreetMap на две секунды.

     Почти все обновления приходят от того, кто уже стоит у известной нам
     точки: сверить расстояние до неё стоит одного чтения строки по
     уникальному индексу. Справочник дёргаем только когда человек
     действительно уехал с прежнего места. */
  /* Протухшие стоянки убираем попутно.

     Отдельная задача по расписанию ради таблицы, где строк столько же,
     сколько людей с включённой трансляцией, не окупается. Раз в сотню
     обновлений проходим по старым записям — этого хватает, чтобы
     таблица не росла: человек выключил трансляцию, и его строка
     исчезает в ближайшие минуты. */
  if (Math.random() < 0.01) {
    const stale = new Date(Date.now() - PRESENCE_STALE_MINUTES * 60_000 * 4)
    void prisma.fuelPresence.deleteMany({ where: { seenAt: { lt: stale } } }).catch(() => undefined)
  }

  const known = await prisma.fuelPresence.findUnique({ where: { chatId } })
  if (known && distanceKm(point, { latitude: known.latitude, longitude: known.longitude }) <= PRESENCE_RADIUS_KM) {
    const updated = await prisma.fuelPresence.update({
      where: { chatId },
      data: { seenAt: new Date(), latitude: point.latitude, longitude: point.longitude },
    })

    const decision = decidePresencePrompt(updated)
    if (decision.action !== "ask") return

    await prisma.fuelPresence.update({ where: { chatId }, data: { promptedAt: new Date() } })
    await sendPresencePrompt(chatId, updated.stationId, updated.stationName)
    return
  }

  const stations = await findStationsNear(point)
  const nearest = stations
    .map((station) => ({ station, km: distanceKm(point, station) }))
    .sort((first, second) => first.km - second.km)[0]

  /* Уехал с заправки — забываем стоянку. Иначе, вернувшись через час, он
     получил бы вопрос о точке, у которой давно не стоит. */
  if (!nearest || nearest.km > PRESENCE_RADIUS_KM) {
    await prisma.fuelPresence.deleteMany({ where: { chatId } }).catch(() => undefined)
    return
  }

  const existing = await prisma.fuelPresence.findUnique({ where: { chatId } })
  const sameStop = isSameStop(existing?.stationId || null, nearest.station.id)

  const record = sameStop && existing
    ? await prisma.fuelPresence.update({
        where: { chatId },
        data: { seenAt: new Date(), latitude: point.latitude, longitude: point.longitude },
      })
    : await prisma.fuelPresence.create({
        data: {
          chatId,
          stationId: nearest.station.id,
          stationName: nearest.station.name,
          latitude: point.latitude,
          longitude: point.longitude,
          arrivedAt: new Date(),
          seenAt: new Date(),
          /* Смена заправки обнуляет и отметку о вопросе: на новой точке
             спросить уместно, даже если только что спрашивали. */
          promptedAt: null,
        },
      }).catch(async () => {
        /* Гонка двух обновлений подряд: запись уже создана соседним
           запросом — просто обновим её. */
        return prisma.fuelPresence.update({
          where: { chatId },
          data: {
            stationId: nearest.station.id,
            stationName: nearest.station.name,
            latitude: point.latitude,
            longitude: point.longitude,
            arrivedAt: new Date(),
            seenAt: new Date(),
            promptedAt: null,
          },
        })
      })

  const decision = decidePresencePrompt(record)
  if (decision.action !== "ask") return

  await prisma.fuelPresence.update({ where: { chatId }, data: { promptedAt: new Date() } })
  await sendPresencePrompt(chatId, record.stationId, record.stationName)
}

/** Приглашение отметить заправку: одно сообщение с тремя путями. */
async function sendPresencePrompt(chatId: string, stationId: string, stationName: string) {
  const miniAppUrl = getTelegramMiniAppUrl()
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(absoluteUrl("/services/fuel-map"))}`
    + `&text=${encodeURIComponent("Где сейчас есть бензин — карта отметок водителей")}`

  await telegramApi("sendMessage", {
    chat_id: chatId,
    text: presencePromptText(stationName),
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: {
      inline_keyboard: [
        /* Два пути к одному действию: в приложении и на сайте. Человек
           за рулём выбирает то, что у него уже открыто. */
        [{ text: "⛽ Отметить прямо здесь", callback_data: `fuel:report:${stationId}` }],
        miniAppUrl
          ? [{ text: "📱 Открыть в приложении", web_app: { url: absoluteUrl("/services/fuel-map?from=telegram") } }]
          : [{ text: "🗺 Открыть карту", url: absoluteUrl("/services/fuel-map") }],
        /* Позвать друзей: чем больше отмечающих, тем точнее карта — и
           тем меньше поездок впустую у каждого. */
        [{ text: "📤 Рассказать друзьям", url: shareUrl }],
      ],
    },
  }).catch(() => undefined)
}
