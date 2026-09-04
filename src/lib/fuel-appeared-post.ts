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
  /* Откуда новость.
  
     «driver» — водитель отметил на карте, «source» — заметил сбор с
     внешних сервисов. Врать здесь нельзя: сообщения идут в чат на две
     тысячи человек, и подпись «по отметке водителя» под данными
     ГдеБЕНЗа люди заметят и перестанут верить остальному. */
  origin?: "driver" | "source"
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
/* Метка марки → значение фильтра карты.
 
   Метки короткие («95», «ДТ»), а фильтр на карте хранит «АИ‑95» — с
   неразрывным дефисом, чтобы подпись не переносилась посреди марки.
   Ссылка с «95» карту не настроит: она сверяет значение со своим списком
   и молча отбрасывает чужое. Человек нажимает «сообщать мне о 95-м» и
   попадает на карту со всеми марками подряд. */
const FILTER_BY_LABEL: Record<string, string> = {
  "92": "АИ‑92",
  "95": "АИ‑95",
  "98": "АИ‑98",
  "100": "АИ‑100",
  "ДТ": "ДТ",
  "Газ": "Газ",
}

/**
 * Метка марки так, как её пишут на колонке.
 *
 * «Появился 95» звучит обрубленно — в разговоре говорят «девяносто
 * пятый», на колонке написано «АИ-95». Метки хранятся короткими, потому
 * что в таблице карты длинные не помещаются; в тексте сообщения и на
 * карточке место есть. Марки без числа («ДТ», «Газ») остаются как есть.
 */
export function fuelTitle(label: string): string {
  return /^\d+$/.test(label) ? `АИ-${label}` : label
}

export function buildFuelAppearedPost(input: AppearedInput): AppearedPost {
  const site = input.siteUrl.replace(/\/$/, "")

  const fuels = input.fuelLabels.map(fuelTitle).join(", ")
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
     три — разный повод срываться с места. Данные сбора подписываются
     честно: они точные, но никто их не видел глазами. */
  if (input.origin === "source") {
    lines.push("<i>По данным сервисов заправок. Пока едете, могут разобрать.</i>")
  } else if (input.confirmations && input.confirmations > 1) {
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
     человек хочет узнавать о следующих.
  
     Ведёт на карту с уже выбранной маркой, а не на ту же карточку, что и
     первая кнопка: две кнопки по одному адресу обманывают ожидание — вы
     нажимаете «сообщать мне» и попадаете туда же, откуда пришли. */
  const subscribeFuel = FILTER_BY_LABEL[input.fuelLabels[0]]
  const subscribeUrl = subscribeFuel
    ? `${site}/services/fuel-map?fuel=${encodeURIComponent(subscribeFuel)}&subscribe=1&from=chat`
    : `${site}/services/fuel-map?subscribe=1&from=chat`
  buttons.push([{ text: "🔔 Сообщать мне о таком", url: subscribeUrl }])

  if (input.botUsername) {
    buttons.push([{ text: "⛽ Отметить свою заправку", url: `https://t.me/${input.botUsername}` }])
  }

  return { text: lines.join("\n"), buttons }
}
