/**
 * Периоды аналитики.
 *
 * Одна цифра «за 7 дней» не отвечает на вопрос, растёт площадка или падает:
 * для этого нужно сравнивать сутки, неделю и месяц. Разбор вынесен отдельно,
 * чтобы период приходил с клиента и не превращался в произвольное число дней —
 * запрос за год положил бы базу.
 */

export const TRAFFIC_PERIODS = {
  "24h": { days: 1, label: "За сутки" },
  "7d": { days: 7, label: "7 дней" },
  "30d": { days: 30, label: "30 дней" },
} as const

export type TrafficPeriod = keyof typeof TRAFFIC_PERIODS

export function isTrafficPeriod(value: unknown): value is TrafficPeriod {
  return typeof value === "string" && value in TRAFFIC_PERIODS
}

export function periodStart(period: TrafficPeriod, now = new Date()): Date {
  return new Date(now.getTime() - TRAFFIC_PERIODS[period].days * 24 * 60 * 60_000)
}

/**
 * Предыдущий отрезок такой же длины — для сравнения «столько же было раньше».
 * Без него число посетителей ничего не говорит: 100 это много или мало?
 */
export function previousPeriodRange(period: TrafficPeriod, now = new Date()) {
  const length = TRAFFIC_PERIODS[period].days * 24 * 60 * 60_000
  return { from: new Date(now.getTime() - length * 2), to: new Date(now.getTime() - length) }
}

/** Человеческое имя источника: в базе они хранятся кодами. */
export function trafficSourceLabel(source: string | null): string {
  if (!source) return "Прямые заходы"
  const upper = source.toUpperCase()
  if (upper.startsWith("UTM:")) return `Метка ${source.slice(4).toLowerCase()}`
  const known: Record<string, string> = {
    DIRECT: "Прямые заходы",
    SEARCH: "Поисковые системы",
    SOCIAL: "Соцсети",
    REFERRAL: "Другие сайты",
    TELEGRAM: "Telegram",
    INTERNAL: "Переходы внутри сайта",
  }
  return known[upper] || source
}

/** Домен реферера без служебных частей — читать список удобнее по нему. */
export function refererHost(referer: string | null): string | null {
  if (!referer) return null
  try {
    const host = new URL(referer).hostname.replace(/^www\./i, "")
    return host || null
  } catch {
    return null
  }
}
