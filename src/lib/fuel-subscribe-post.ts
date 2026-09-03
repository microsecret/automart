/**
 * Пост в городской чат: подпишитесь на уведомления о топливе.
 *
 * Отличается от общего приглашения тем, что зовёт к одному действию, а
 * не рассказывает про сервис целиком. Замер на боевом сервере объясняет,
 * зачем: двести семнадцать пользователей и три подписки — про главную
 * возможность почти никто не узнал, потому что она была одной строкой
 * среди четырёх в приглашении.
 *
 * Марки вынесены кнопками. Человек в чате не выбирает «подписаться
 * вообще» — он ездит на девяносто пятом и хочет знать про девяносто
 * пятый. Одно нажатие открывает карту с уже выставленным фильтром, где
 * подписка заводится следующим касанием.
 *
 * Здесь только сборка текста и кнопок, без сети: то, что уходит тысячам
 * посторонних людей, должно проверяться тестами.
 */

export type SubscribePostInput = {
  city: string
  /** Сколько заправок города на карте: без числа призыв звучит обещанием. */
  stationCount?: number
  /** Сколько из них с ценами или наличием — доказательство, что карта живая. */
  pricedCount?: number
  siteUrl: string
  botUsername?: string | null
}

export type SubscribePost = {
  text: string
  buttons: Array<Array<{ text: string; url: string }>>
}

/* Марки в порядке распространённости: на девяносто пятом ездит
   большинство, газ и сотый нужны меньшинству и стоят последними. Значения
   совпадают с фильтром карты — там неразрывный дефис. */
const FUELS = [
  { label: "92", filter: "АИ‑92" },
  { label: "95", filter: "АИ‑95" },
  { label: "ДТ", filter: "ДТ" },
  { label: "100", filter: "АИ‑100" },
  { label: "Газ", filter: "Газ" },
] as const

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

export function buildFuelSubscribePost(input: SubscribePostInput): SubscribePost {
  const site = input.siteUrl.replace(/\/$/, "")
  const city = escapeHtml(input.city)
  const lines: string[] = []

  lines.push("🔔 <b>Узнавайте о топливе первыми</b>")
  lines.push("")

  /* Числа сразу за заголовком: они доказывают, что за приглашением стоит
     работающая карта, а не пустая форма. Показываются, только когда есть
     что показать — «3 заправки на карте» отпугивает сильнее молчания. */
  if (input.stationCount && input.stationCount > 20) {
    const priced = input.pricedCount && input.pricedCount > 0
      ? `, ${input.pricedCount} с ценами и наличием`
      : ""
    lines.push(`⛽ ${input.stationCount} заправок ${city}${priced}`)
    lines.push("")
  }

  lines.push("Бот напишет, как только на заправке появится ваша марка.")
  lines.push("Отмечают сами водители — те, кто прямо сейчас стоит у колонки.")
  lines.push("")
  lines.push("<b>Как это работает</b>")
  lines.push("• Выбираете марку — 92, 95, ДТ или газ")
  lines.push("• Бот присылает сообщение, когда топливо появилось")
  lines.push("• Не чаще раза в час: без спама")
  lines.push("")
  lines.push("<i>Бесплатно. Вход через Telegram — без пароля и почты.</i>")

  /* Марки по три в ряд: в один ряд пять кнопок сжимаются до нечитаемых
     подписей, в столбик занимают полэкрана. */
  const fuelButtons = FUELS.map((fuel) => ({
    text: `🔔 ${fuel.label}`,
    url: `${site}/services/fuel-map?fuel=${encodeURIComponent(fuel.filter)}&from=chat`,
  }))

  const buttons: Array<Array<{ text: string; url: string }>> = [
    fuelButtons.slice(0, 3),
    fuelButtons.slice(3),
  ]

  buttons.push([{ text: "🗺 Открыть карту заправок", url: `${site}/services/fuel-map?from=chat` }])

  if (input.botUsername) {
    buttons.push([{ text: "⛽ Отметить свою заправку", url: `https://t.me/${input.botUsername}` }])
  }

  return { text: lines.join("\n"), buttons }
}
