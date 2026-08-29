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
import { telegramApi } from "@/lib/telegram"
import { absoluteUrl } from "@/lib/site-url"
import {
  buildAction,
  formatDistance,
  matchStation,
  parseAction,
  type BotStation,
} from "@/lib/fuel-bot-report"
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
function fuelKeyboard(stationId: string) {
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
    reply_markup: fuelKeyboard(match.station.id),
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

  if (action.kind === "station") {
    await answer("")
    await telegramApi("editMessageText", {
      chat_id: input.chatId,
      message_id: input.messageId,
      text: "⛽ <b>Что здесь сейчас есть?</b>\n\nОтметьте — это увидят другие водители.",
      parse_mode: "HTML",
      reply_markup: fuelKeyboard(action.stationId),
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
    reply_markup: fuelKeyboard(action.stationId),
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
