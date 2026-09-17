/**
 * Текст сводки «где сегодня дешевле» для городского чата.
 *
 * У площадки была одна сводка по топливу — о том, где сейчас есть
 * бензин. Она строится на отметках водителей, и это правильно: где
 * налили, знают только люди. Но замер 17 сентября 2026 показал, что
 * отметок семьдесят две за всё время и ноль за последние полсуток, а
 * задача рассылки исправно запускается каждое утро и каждый раз
 * находит ноль чатов. В журнале шестнадцать строк подряд:
 * {"chats":0,"sent":0}.
 *
 * Рядом лежат шестьдесят девять тысяч цен из источников, обновляемых
 * каждые пятнадцать минут. Ими и можно отвечать на второй вопрос
 * водителя — не «где есть», а «где дешевле».
 *
 * Это не замена прежней сводке, а вторая: у них разные данные и разный
 * повод для сообщения.
 */

/* Импорт только типа: расширение нужно тест-раннеру, а директива
   подавления здесь лишняя — типовой импорт компилятор не проверяет как
   значение. */
import type { NetworkPriceRow } from "./fuel-network-prices.ts"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { plural } from "./plural.ts"

export type PriceDigestInput = {
  city: string
  /** Марка топлива, о которой сводка: «АИ-95». */
  fuelLabel: string
  /** Сети от дешёвой к дорогой — как их отдаёт buildNetworkPrices. */
  networks: NetworkPriceRow[]
  /** Ссылка на карту города, чтобы из чата можно было перейти. */
  mapUrl: string
}

/*
 * Сколько сетей показывать.
 *
 * Три: сводку читают в ленте чата между другими сообщениями, и список
 * из десяти строк там не читают вовсе. Первая строка — ответ на вопрос,
 * остальные две дают понять, что разброс невелик или велик.
 */
const VISIBLE_NETWORKS = 3

/*
 * Ниже двух сетей сводка не отправляется.
 *
 * «Дешевле всего Лукойл» без второй строки — это не сравнение, а
 * реклама одной сети: человеку не с чем сопоставить и незачем открывать
 * карту.
 */
const MIN_NETWORKS = 2

function formatRoubles(kopecks: number): string {
  const roubles = kopecks / 100
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: Number.isInteger(roubles) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(roubles)
}

/**
 * Собирает текст сводки или `null`, если рассказывать нечего.
 *
 * Возвращаемый текст размечен HTML — тем же способом, каким площадка
 * шлёт остальные сообщения в чаты.
 */
export function buildFuelPriceDigestPost(input: PriceDigestInput): string | null {
  const networks = input.networks.slice(0, VISIBLE_NETWORKS)
  if (networks.length < MIN_NETWORKS) return null

  const cheapest = networks[0]
  const lines = networks.map((network, index) => {
    /* Место в списке цифрой, а не значком: список короткий, и значки
       вроде «медалей» превратили бы цену в игру. */
    const position = `${index + 1}.`
    const stations = `${network.stations} ${plural(network.stations, "заправка", "заправки", "заправок")}`
    return `${position} <b>${escapeHtml(network.label)}</b> — ${formatRoubles(network.priceRub)} ₽ · ${stations}`
  })

  /* Разница между первой и последней строкой: ради неё сводку и
     читают. Если разброс меньше рубля, о нём молчим — «экономия 40
     копеек» звучит как насмешка над человеком, который поедет через
     город. */
  const spread = networks[networks.length - 1].priceRub - cheapest.priceRub
  const spreadLine = spread >= 100
    ? `\nРазница по городу — до ${formatRoubles(spread)} ₽ на литре.`
    : ""

  return [
    `⛽ <b>${escapeHtml(input.fuelLabel)} в городе ${escapeHtml(input.city)}</b>`,
    "",
    lines.join("\n"),
    spreadLine,
    "",
    `<a href="${input.mapUrl}">Все заправки на карте</a>`,
  ].filter(Boolean).join("\n")
}

/* Разметка чужая — названия сетей приходят из источников, и «AMP&CO»
   сломал бы разбор HTML на стороне Telegram. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}
