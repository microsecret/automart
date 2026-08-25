export const AUCTION_HIGHLIGHT_FIELD_COUNT = 15
export const DEFAULT_AUCTION_HIGHLIGHT_MIN_FIELDS = 12
export const DEFAULT_AUCTION_HIGHLIGHT_MAX_PRICE_RATIO = 0.82

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** @param {unknown} value */
function meaningfulText(value) {
  return typeof value === "string" && value.trim().length > 0
}

const UNPUBLISHED_SOURCE_VALUES = new Set([
  "не опубликовано источником",
  "не указано",
  "нет данных",
  "n/a",
  "—",
  "-",
])

/**
 * Возвращает только значение, которое можно честно показать в публикации.
 * Источники используют обычные и неразрывные пробелы в одной и той же
 * заглушке, поэтому сравнение идёт после их схлопывания.
 * @param {unknown} value
 */
export function publishedAuctionSourceValue(value) {
  if (!meaningfulText(value)) return null
  const normalized = String(value).trim().replace(/\s+/g, " ")
  return UNPUBLISHED_SOURCE_VALUES.has(normalized.toLocaleLowerCase("ru-RU")) ? null : normalized
}

/** @param {unknown} value */
function positiveNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
}

/** @param {unknown} value */
function nonNegativeNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
}

/** @param {unknown} value */
export function parseAuctionHighlightListingId(value) {
  if (!meaningfulText(value)) return null
  const input = String(value).trim()
  if (UUID_PATTERN.test(input)) return input.toLowerCase()
  const match = input.match(/\/auctions\/([0-9a-f-]{36})(?:[/?#].*)?$/i)
  return match && UUID_PATTERN.test(match[1]) ? match[1].toLowerCase() : null
}

/** @param {unknown} value */
export function auctionHighlightMinimumFields(value) {
  const number = Number(value)
  return Number.isInteger(number)
    ? Math.min(Math.max(number, 8), AUCTION_HIGHLIGHT_FIELD_COUNT)
    : DEFAULT_AUCTION_HIGHLIGHT_MIN_FIELDS
}

/** @param {unknown} value */
export function auctionHighlightMaximumPriceRatio(value) {
  if (value === null || value === undefined || String(value).trim() === "") {
    return DEFAULT_AUCTION_HIGHLIGHT_MAX_PRICE_RATIO
  }
  const number = Number(value)
  return Number.isFinite(number)
    ? Math.min(Math.max(number, 0.01), 0.99)
    : DEFAULT_AUCTION_HIGHLIGHT_MAX_PRICE_RATIO
}

/**
 * @param {{
 *  make?: unknown, model?: unknown, year?: unknown, mileage?: unknown,
 *  fuelType?: unknown, transmission?: unknown, bodyType?: unknown,
 *  color?: unknown, driveType?: unknown, engineVolume?: unknown, power?: unknown,
 *  lotNumber?: unknown, location?: unknown, sourcePrice?: unknown,
 *  imageUrl?: unknown
 * }} listing
 * @param {number} [minimumFields]
 */
export function auctionHighlightReadiness(listing, minimumFields = DEFAULT_AUCTION_HIGHLIGHT_MIN_FIELDS) {
  const electric = listing.fuelType === "ELECTRIC"
  const checks = [
    ["Марка", meaningfulText(listing.make)],
    ["Модель", meaningfulText(listing.model)],
    ["Год", Number.isInteger(listing.year) && Number(listing.year) >= 1900],
    ["Пробег", nonNegativeNumber(listing.mileage)],
    ["Топливо", meaningfulText(listing.fuelType)],
    ["Коробка передач", meaningfulText(listing.transmission)],
    ["Кузов", meaningfulText(listing.bodyType)],
    ["Цвет", meaningfulText(listing.color)],
    ["Привод", meaningfulText(listing.driveType)],
    ["Объём двигателя", electric || positiveNumber(listing.engineVolume)],
    ["Мощность", positiveNumber(listing.power)],
    ["Номер лота", meaningfulText(listing.lotNumber)],
    ["Местонахождение", meaningfulText(listing.location)],
    ["Цена источника", positiveNumber(listing.sourcePrice)],
    ["Главное фото", meaningfulText(listing.imageUrl) && /^https:\/\//i.test(String(listing.imageUrl))],
  ]
  const missing = checks.filter(([, ready]) => !ready).map(([label]) => String(label))
  const filled = checks.length - missing.length
  const required = auctionHighlightMinimumFields(minimumFields)
  const essentialsReady = checks.slice(0, 3).every(([, ready]) => ready)
    && checks[13][1]
    && checks[14][1]

  return {
    ready: essentialsReady && filled >= required,
    filled,
    total: checks.length,
    required,
    percent: Math.round((filled / checks.length) * 100),
    missing,
  }
}
