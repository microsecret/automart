/**
 * Сообщение в городской чат: на заправке появилось топливо.
 *
 * Отличается от суточной сводки тем, ради чего и существует: сводка
 * рассказывает, где топливо было сегодня, а это — что оно появилось
 * только что, на конкретной колонке, где его не было.
 *
 * В дефицит это и есть главная новость города. Человек, который час
 * назад проехал мимо пустой заправки, должен узнать об этом сейчас, а не
 * из завтрашней сводки.
 *
 * Здесь только сборка текста, без сети и базы: то, что уходит тысячам
 * посторонних людей, должно проверяться тестами.
 */

export type AppearedInput = {
  stationName: string
  address: string | null
  city: string
  /** Марки, появившиеся прямо сейчас: «АИ-95», «ДТ». */
  fuelLabels: string[]
  /** Цена в копейках, если её отметили вместе с наличием. */
  priceKopecks?: number | null
  /** Сколько человек подтвердили: одна отметка и три — разный вес. */
  confirmations?: number
  stationId: string
  latitude?: number | null
  longitude?: number | null
  siteUrl: string
  botUsername?: string | null
}

export type AppearedPost = {
  text: string
  buttons: Array<Array<{ text: string; url: string }>>
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

/**
 * Собирает сообщение о появлении топлива.
 *
 * Первая строка — ответ целиком: что появилось и где. Человек читает
 * чат по диагонали, и если ответ не в первой строке, сообщение
 * пролистают.
 */
export function buildFuelAppearedPost(input: AppearedInput): AppearedPost {
  const site = input.siteUrl.replace(/\/$/, "")
  const fuels = input.fuelLabels.join(", ")
  const lines: string[] = []

  lines.push(`⛽ <b>Появился ${escapeHtml(fuels)}</b>`)
  lines.push("")
  lines.push(`📍 <b>${escapeHtml(input.stationName)}</b>`)

  /* Адрес обязателен, если он есть: название сети без адреса в городе с
     двумя десятками «Лукойлов» не говорит ничего. */
  if (input.address) {
    lines.push(escapeHtml(input.address))
  }

  if (input.priceKopecks) {
    const price = (input.priceKopecks / 100).toFixed(2).replace(".", ",")
    lines.push("")
    lines.push(`💰 ${price} ₽ за литр`)
  }

  lines.push("")

  /* Число подтверждений вместо голого «отметил водитель»: одна отметка и
     три — разный повод срываться с места. */
  if (input.confirmations && input.confirmations > 1) {
    lines.push(`<i>Подтвердили ${input.confirmations} водителя. Пока едете, могут разобрать.</i>`)
  } else {
    lines.push("<i>По отметке водителя. Пока едете, могут разобрать.</i>")
  }

  /* Ссылка ведёт на саму заправку, а не на общую карту: человек читает
     про конкретную точку и должен увидеть её, а не искать заново.
     Координаты нужны, чтобы карта нашла точку, даже если открыта на
     другом городе. */
  const point = input.latitude != null && input.longitude != null
    ? `&lat=${input.latitude}&lng=${input.longitude}`
    : ""
  const stationUrl = `${site}/services/fuel-map?station=${encodeURIComponent(input.stationId)}${point}&from=chat`

  const buttons: Array<Array<{ text: string; url: string }>> = [
    [{ text: "🗺 Посмотреть на карте", url: stationUrl }],
  ]

  /* Подписка — главное, ради чего эти сообщения и шлются: увидев одно,
     человек хочет узнавать о следующих. Кнопка ведёт на ту же заправку,
     где подписка заводится одним нажатием. */
  buttons.push([{ text: "🔔 Сообщать мне о таком", url: stationUrl }])

  if (input.botUsername) {
    buttons.push([{ text: "⛽ Отметить свою заправку", url: `https://t.me/${input.botUsername}` }])
  }

  return { text: lines.join("\n"), buttons }
}
