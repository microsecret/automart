// @ts-check

// Чистые правила рейтинга и маршрутизации используются и Next backend, и
// часовым Node.js-заданием. Здесь нет Prisma и path aliases, поэтому cron не
// копирует формулы и не расходится с приложением после следующей правки.

export const SLA_RESPONSE_TARGET_MINUTES = 60
export const SLA_NEUTRAL_RATING = 50

/** @type {Record<string, string[]>} */
const COUNTRY_TERMS = {
  CN: ["китай", "china", "кнр"],
  KR: ["корея", "korea"],
  JP: ["япония", "japan"],
  US: ["сша", "usa", "america"],
  DE: ["европа", "германия", "europe", "germany"],
}

/** @param {string} value */
function normalizeRegion(value) {
  return value.normalize("NFKC").toLocaleLowerCase("ru-RU").replace(/ё/g, "е").replace(/[^\p{L}\p{N}]+/gu, " ").trim()
}

/** @param {string | null} value */
export function readServiceRegions(value) {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) return parsed.filter((item) => typeof item === "string").map(normalizeRegion).filter(Boolean)
  } catch {
    // Старые анкеты хранят свободную строку через запятую.
  }
  return value.split(/[,;\n]+/u).map(normalizeRegion).filter(Boolean)
}

/**
 * @param {{
 *   destinationCity: string | null,
 *   sourceCountry: string,
 *   serviceRegions: string | null,
 *   activeAssignments: number,
 *   openOffers: number,
 *   slaRating?: number | null,
 *   slaResponseMinutes?: number | null,
 * }} input
 */
export function scoreAuctionPartner(input) {
  const regions = readServiceRegions(input.serviceRegions)
  const joined = regions.join(" ")
  const city = normalizeRegion(input.destinationCity || "")
  const cityTokens = city.split(" ").filter((token) => token.length >= 4)
  const exactCity = Boolean(city && regions.some((region) => region === city || region.includes(city)))
  const partialCity = !exactCity && cityTokens.some((token) => joined.includes(token))
  const countryMatch = (COUNTRY_TERMS[input.sourceCountry] || []).some((term) => joined.includes(term))
  const rating = typeof input.slaRating === "number" ? input.slaRating : SLA_NEUTRAL_RATING
  const slaBonus = Math.round(((rating - SLA_NEUTRAL_RATING) / 100) * 60)
  const score = 20
    + (exactCity ? 120 : partialCity ? 60 : 0)
    + (countryMatch ? 30 : 0)
    - Math.min(45, input.activeAssignments * 6 + input.openOffers * 3)
    + slaBonus
  const fastResponder = typeof input.slaResponseMinutes === "number" && input.slaResponseMinutes <= SLA_RESPONSE_TARGET_MINUTES
  const reasons = [
    exactCity ? "работает в городе доставки" : partialCity ? "работает в указанном регионе" : null,
    countryMatch ? "работает с выбранной страной" : null,
    !input.activeAssignments ? "свободен от активных заявок" : null,
    fastResponder ? "отвечает в течение часа" : null,
  ].filter(Boolean)

  return { score, reason: reasons.join(" · ") || "проверенный партнёр с наименьшей нагрузкой" }
}

/**
 * @param {{responseMinutes: number | null, acceptedOffers: number, missedOffers: number, closedDeals: number}} input
 */
export function calculatePartnerRating(input) {
  const answered = input.acceptedOffers + input.missedOffers
  if (!answered && input.responseMinutes === null && !input.closedDeals) return SLA_NEUTRAL_RATING
  const responsiveness = answered > 0 ? input.acceptedOffers / answered : 0.5
  const speed = input.responseMinutes === null
    ? 0.5
    : Math.max(0, Math.min(1, SLA_RESPONSE_TARGET_MINUTES / Math.max(SLA_RESPONSE_TARGET_MINUTES, input.responseMinutes)))
  const delivery = Math.min(1, input.closedDeals / 10)
  return Math.max(0, Math.min(100, Math.round(responsiveness * 55 + speed * 30 + delivery * 15)))
}
