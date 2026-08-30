/**
 * Утренняя сводка по топливу для чата города.
 *
 * Карта работает, но о ней узнают единицы: за неделю 101 человек пришёл
 * в сервис и только 20 отметок топлива за сутки. Между тем в чатах сети
 * сто пятнадцать тысяч подписчиков — те самые водители, которым сводка
 * нужна каждое утро.
 *
 * Сводка — не реклама сервиса, а польза сама по себе: человек читает её
 * и уже знает, куда ехать, даже не открывая карту. Открывает он её
 * тогда, когда хочет подробностей или когда своей заправки в списке нет.
 * Так сервис входит в привычку, а не в ленту рекламы.
 *
 * Модуль без импортов: то, что уходит тысячам людей, должно проверяться
 * тестами без базы и сети.
 */

/** Экранирование: названия заправок приходят из справочника. */
function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

export type DigestStation = {
  name: string
  /** Марки, которые есть по свежим отметкам. */
  fuels: string[]
  /** Цена самой ходовой марки в копейках; null — не отмечали. */
  priceKopecks: number | null
  /** Сколько минут назад отметили. */
  minutesAgo: number
}

export type DigestInput = {
  city: string
  /** Заправки с топливом — уже отобранные и отсортированные. */
  stations: DigestStation[]
  /** Сколько всего отметок в городе за сутки. */
  reportsToday: number
  siteUrl: string
  botUsername?: string
}

export type DigestPost = {
  text: string
  buttons: Array<{ text: string; url: string }>
}

/**
 * Сколько заправок называть в сводке.
 *
 * Пять — предел, за которым сообщение перестают читать: в чате оно
 * конкурирует с разговором, и длинный список пролистывают целиком. Пять
 * закрывают выбор в любом районе.
 */
export const MAX_DIGEST_STATIONS = 5

/**
 * Собирает утреннюю сводку.
 *
 * Порядок продуман: сначала где есть, потом цена, потом свежесть. Человек
 * читает по диагонали и должен получить ответ из первой строки списка.
 */
export function buildFuelDigest(input: DigestInput): DigestPost {
  const site = input.siteUrl.replace(/\/$/, "")
  const city = escapeHtml(input.city)

  const lines: string[] = []

  if (input.stations.length === 0) {
    /* Пустая сводка — тоже сводка, но звать в неё нельзя: человек
       откроет карту и увидит пустоту. Вместо этого просим отметить, и
       это честнее — сервис живёт отметками. */
    lines.push(
      `⛽ <b>Топливо в городе ${city}</b>`,
      "",
      "Сегодня ещё никто не отмечал наличие.",
      "",
      "Заправились — отметьте за две секунды. Следующий не поедет впустую,",
      "а завтра кто-то отметит для вас.",
    )
  } else {
    lines.push(`⛽ <b>Где сейчас есть топливо — ${city}</b>`, "")

    for (const station of input.stations.slice(0, MAX_DIGEST_STATIONS)) {
      const fuels = station.fuels.join(", ")
      const price = station.priceKopecks
        ? ` · ${(station.priceKopecks / 100).toFixed(2).replace(".", ",")} ₽`
        : ""
      /* Возраст отметки в сводке обязателен: «40 минут назад» и «5 часов
         назад» — разные сведения, и без них человек поедет по вчерашним. */
      const age = station.minutesAgo < 60
        ? `${station.minutesAgo} мин назад`
        : `${Math.floor(station.minutesAgo / 60)} ч назад`

      lines.push(`✅ <b>${escapeHtml(station.name)}</b> — ${escapeHtml(fuels)}${price}`)
      lines.push(`<i>${age}</i>`)
    }

    lines.push("", "<i>По отметкам водителей. Пока едете, могут разобрать.</i>")

    if (input.reportsToday >= 10) {
      /* Числом хвастаемся, только когда оно внушает: «3 отметки» говорит
         человеку, что сервисом не пользуются. */
      lines.push("", `📊 Сегодня отметили ${input.reportsToday} раз.`)
    }
  }

  lines.push(
    "",
    "👥 Отмечайте сами и расскажите знакомым — чем больше нас, тем точнее карта.",
  )

  const buttons: Array<{ text: string; url: string }> = [
    { text: "🗺 Открыть карту", url: `${site}/services/fuel-map?from=telegram` },
  ]

  if (input.botUsername) {
    /* Отметка через бота вторым: человеку за рулём проще прислать точку,
       чем открывать сайт, — но узнаёт он об этом уже после карты. */
    buttons.push({ text: "⛽ Отметить из бота", url: `https://t.me/${input.botUsername}` })
  }

  /* Пост зовёт рассказать знакомым — и не давал этого сделать: человек
     пересылал сообщение вручную, теряя и картинку, и кнопки. Здесь же
     карта — тот самый случай, когда пересылка полезна соседу по пробке. */
  buttons.push({
    text: "📤 Поделиться",
    url: `https://t.me/share/url?url=${encodeURIComponent(`${site}/services/fuel-map`)}&text=${encodeURIComponent("Где сейчас есть бензин — карта отметок водителей")}`,
  })

  return { text: lines.join("\n"), buttons }
}
