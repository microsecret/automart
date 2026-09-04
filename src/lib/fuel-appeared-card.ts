/**
 * Карточка новости о топливе — картинкой.
 *
 * Пост с изображением виден в ленте чата, текстовый теряется между
 * разговорами. Но подставлять под каждую новость рекламный баннер
 * сервиса нельзя: новости идут по одной в минуту, и один и тот же плакат
 * подряд читается как спам, а сама новость — какая заправка, какая марка,
 * почём — тонет под ним.
 *
 * Поэтому картинка собирается из данных самой новости. Человек видит
 * марку и цену раньше, чем успевает прочитать текст, — а это ровно то,
 * ради чего он читает чат в дефицит.
 *
 * Здесь только разметка, без сети и базы: то, что уходит в чат на две
 * тысячи человек, должно проверяться тестами.
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
   шириной, а на широкой карточке текст мельчает. Пропорция близка к
   двум к одному — высокая карточка съедает экран телефона. */
export const CARD_WIDTH = 1200
export const CARD_HEIGHT = 630

/* Цвета площадки: зелёный — «топливо есть», он же на метках карты. */
const INK = "#0F172A"
const MUTED = "#64748B"
const ACCENT = "#15803D"
const GROUND = "#F8FAFC"

/** Экранирование: названия заправок приходят от источников. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

/**
 * Обрезает строку по числу знаков, а не по ширине в точках.
 *
 * Точную ширину без разметки шрифта не измерить, а длинное название
 * заправки, уехавшее за край картинки, читается как поломка. Знаки
 * считаются с запасом: кириллица в Liberation Sans шире латиницы.
 */
function clamp(value: string, limit: number): string {
  const text = value.trim()
  if (text.length <= limit) return text
  return `${text.slice(0, limit - 1).trimEnd()}…`
}

/**
 * Собирает SVG карточки.
 *
 * Шрифт назван семейством, а не файлом: на сервере стоит Liberation Sans,
 * и кириллицу он держит. Подстановка sans-serif на случай, если разметка
 * поедет в другое окружение — тогда буквы будут другие, но текст
 * останется читаемым, а не исчезнет.
 */
export function buildFuelCardSvg(input: FuelCardInput): string {
  const font = "Liberation Sans, DejaVu Sans, sans-serif"
  const fuels = escapeXml(clamp(input.fuels.join(", "), 28))
  const station = escapeXml(clamp(input.stationName || "АЗС", 30))
  const address = input.address ? escapeXml(clamp(input.address, 46)) : null
  const city = escapeXml(clamp(input.city, 24))

  const price = input.priceKopecks
    ? `${(input.priceKopecks / 100).toFixed(2).replace(".", ",")} ₽`
    : null

  /* Адрес занимает строку только когда он есть: пустая строка оставляла
     дыру между названием и ценой, и карточка выглядела недоделанной. */
  const addressLine = address
    ? `<text x="80" y="410" font-family="${font}" font-size="34" fill="${MUTED}">${address}</text>`
    : ""

  const priceLine = price
    ? `<text x="80" y="${address ? 500 : 470}" font-family="${font}" font-size="52" font-weight="700" fill="${INK}">${price}<tspan font-size="34" font-weight="400" fill="${MUTED}"> за литр</tspan></text>`
    : ""

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}">
  <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="${GROUND}"/>
  <rect x="0" y="0" width="16" height="${CARD_HEIGHT}" fill="${ACCENT}"/>
  <text x="80" y="130" font-family="${font}" font-size="30" font-weight="700" fill="${ACCENT}" letter-spacing="3">ПОЯВИЛОСЬ ТОПЛИВО</text>
  <text x="80" y="245" font-family="${font}" font-size="86" font-weight="700" fill="${INK}">${fuels}</text>
  <text x="80" y="345" font-family="${font}" font-size="44" font-weight="700" fill="${INK}">${station}</text>
  ${addressLine}
  ${priceLine}
  <text x="80" y="565" font-family="${font}" font-size="30" fill="${MUTED}">${city} · карта заправок lewheel.ru</text>
</svg>`
}
