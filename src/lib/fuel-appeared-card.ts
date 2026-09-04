/**
 * Карточка новости о топливе — картинкой для чата.
 *
 * Пост с изображением виден в ленте, текстовый теряется между
 * разговорами. Но подставлять под каждую новость рекламный баннер
 * сервиса нельзя: новости идут по одной в минуту, и один и тот же плакат
 * подряд читается как спам, а сама новость — какая заправка, какая марка,
 * почём — тонет под ним.
 *
 * Поэтому картинка собирается из данных самой новости. Человек в дефицит
 * листает чат быстро: марка и цена должны читаться раньше, чем он успеет
 * прочесть текст под картинкой.
 *
 * Здесь только разметка, без сети и растеризации: то, что уходит в чат на
 * две тысячи человек, должно проверяться тестами.
 */

export type FuelCardInput = {
  /** Марки как на колонке: «АИ-95», «ДТ». */
  fuels: string[]
  stationName: string
  address?: string | null
  city: string
  /** Цена в копейках, если известна. */
  priceKopecks?: number | null
}

/* Размер под ленту Telegram: он показывает картинку примерно в 800 точек
   шириной. Пропорция ближе к 1,9:1 — высокая карточка съедает экран
   телефона целиком, и разговор под ней приходится искать прокруткой. */
export const CARD_WIDTH = 1200
export const CARD_HEIGHT = 628

/* Цвета площадки — те же, что в интерфейсе: карточка должна читаться как
   своя, а не как чужая картинка из интернета. Индиго-чернила и оранжевый
   акцент взяты из globals.css, зелёный — тон «топливо есть». */
const INK = "#0d1b32"
const MUTED = "#5b6b84"
const ACCENT = "#ef7d00"
const SUCCESS = "#15803d"
const GROUND = "#ffffff"
const LINE = "#ccd5e3"

const PAD = 96

/**
 * Экранирование для SVG.
 *
 * Названия заправок приходят от внешних источников, и «Лукойл & Ко»
 * ломает разметку так, что картинка не отрисуется вовсе — а сообщение
 * уйдёт без неё и без объяснений. Апостроф и кавычка тоже: они
 * встречаются в адресах.
 */
export function escapeSvg(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

/**
 * Обрезает строку по числу знаков, добавляя многоточие.
 *
 * SVG не переносит текст сам: длинное название уезжает за край картинки и
 * пропадает без следа. Обрезка честнее — видно, что строка продолжается.
 */
export function clamp(value: string, limit: number): string {
  const clean = value.trim().replace(/\s+/g, " ")
  if (clean.length <= limit) return clean
  return `${clean.slice(0, limit - 1).trimEnd()}…`
}

/** Цена рублями: «61,90 ₽» — как на табло, через запятую. */
export function formatPrice(kopecks: number): string {
  return `${(kopecks / 100).toFixed(2).replace(".", ",")} ₽`
}

/**
 * Убирает из адреса город, если он там уже назван.
 *
 * Источники пишут «Уфа, Сельская Богородская улица, 2/3», а город
 * выводится отдельной строкой: получалось «Уфа» дважды на одной
 * карточке, и вторая строка не несла ничего.
 */
export function trimCityFromAddress(address: string, city: string): string {
  const cleanCity = city.trim().toLocaleLowerCase("ru-RU")
  if (!cleanCity) return address.trim()

  /* Разбором по запятым, а не выражением с подстановкой города.

     Название города приходит из справочника и попадало в регулярное
     выражение как есть: «Ростов-на-Дону» с дефисами читался бы там как
     набор символов, а не как слово. Разбор по частям от этого свободен и
     заодно ловит город в любом месте адреса, а не только по краям. */
  const parts = address
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)

  const kept = parts.filter((part) => part.toLocaleLowerCase("ru-RU") !== cleanCity)

  /* Если от адреса ничего не осталось — он состоял из одного города, и
     показывать пустую строку хуже, чем повторить его: пустота читается
     как потерянные данные. */
  return kept.length > 0 ? kept.join(", ") : address.trim()
}


/**
 * Строки нижнего блока: заправка, адрес, город.
 *
 * Возвращаются готовыми к отрисовке — с размером и цветом, — потому что
 * их число меняется: у части заправок нет адреса, у части адрес уже
 * содержит город. Раскладка считается от того, сколько строк вышло, а не
 * от заранее назначенных высот: при жёсткой сетке низ карточки пустел на
 * четверть, когда строк оказывалось меньше.
 */
export function cardLines(input: FuelCardInput): Array<{ text: string; size: number; fill: string }> {
  const lines: Array<{ text: string; size: number; fill: string }> = [
    { text: clamp(input.stationName, 30), size: 46, fill: INK },
  ]

  const address = input.address ? trimCityFromAddress(input.address, input.city) : ""
  if (address) lines.push({ text: clamp(address, 46), size: 32, fill: MUTED })

  const city = clamp(input.city, 24)
  if (city) lines.push({ text: city, size: 32, fill: MUTED })

  return lines
}

/**
 * Собирает разметку карточки.
 *
 * Порядок чтения задан размером: марка крупнее всего — её ищут глазами;
 * заправка и адрес под ней; цена отдельным блоком справа, где её ждут по
 * привычке от ценников.
 *
 * Шрифт назван семейством, а не файлом: на сервере стоит Liberation Sans,
 * она держит кириллицу. Запасные варианты перечислены на случай, если
 * набор шрифтов на машине изменится — без них текст пропал бы молча.
 */
export function buildFuelCardSvg(input: FuelCardInput): string {
  const family = "Liberation Sans, DejaVu Sans, Arial, sans-serif"
  const fuels = clamp(input.fuels.join(", "), 22)
  const price = input.priceKopecks ? formatPrice(input.priceKopecks) : ""
  const lines = cardLines(input)

  /* Цена занимает правую треть. Когда её нет, разделитель растягивается
     на всю ширину: обрезанная посередине линия читалась бы как след от
     пропавшего блока. */
  const ruleEnd = price ? 796 : CARD_WIDTH - PAD

  /* Блок начинается сразу под разделителем и растёт вниз.

     Прижимать его к подписи было хуже: при двух строках вместо трёх
     между линией и названием заправки оставалась дыра в треть картинки,
     а глаз читает такой просвет как обрыв. Теперь просвет один и всегда
     одинаковый, а свободное место, если оно есть, собирается внизу — под
     подписью, где ему и место. */
  const footerY = CARD_HEIGHT - 46
  const heights: number[] = []
  let cursor = 404
  for (const line of lines) {
    heights.push(cursor)
    cursor += line.size === 46 ? 58 : 52
  }

  const priceBlock = price
    ? `<rect x="${CARD_WIDTH - PAD - 268}" y="188" width="268" height="168" rx="20" fill="${ACCENT}"/>
  <text x="${CARD_WIDTH - PAD - 134}" y="268" font-family="${family}" font-size="52" font-weight="700" fill="${INK}" text-anchor="middle">${escapeSvg(price)}</text>
  <text x="${CARD_WIDTH - PAD - 134}" y="314" font-family="${family}" font-size="26" fill="${INK}" text-anchor="middle">за литр</text>`
    : ""

  const body = lines
    .map((line, index) => `<text x="${PAD}" y="${heights[index]}" font-family="${family}" font-size="${line.size}" font-weight="${index === 0 ? 700 : 400}" fill="${line.fill}">${escapeSvg(line.text)}</text>`)
    .join("\n  ")

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}">
  <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="${GROUND}"/>
  <rect x="0" y="0" width="${CARD_WIDTH}" height="10" fill="${ACCENT}"/>

  <text x="${PAD}" y="126" font-family="${family}" font-size="34" font-weight="700" fill="${SUCCESS}" letter-spacing="2">ПОЯВИЛОСЬ ТОПЛИВО</text>

  <text x="${PAD}" y="264" font-family="${family}" font-size="104" font-weight="700" fill="${INK}">${escapeSvg(fuels)}</text>

  <line x1="${PAD}" y1="326" x2="${ruleEnd}" y2="326" stroke="${LINE}" stroke-width="2"/>

  ${priceBlock}

  ${body}

  <text x="${PAD}" y="${footerY}" font-family="${family}" font-size="28" fill="${MUTED}">lewheel.ru — карта заправок</text>
</svg>`
}
