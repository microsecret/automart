/**
 * Периоды аналитики.
 *
 * Одна цифра «за 7 дней» не отвечает на вопрос, растёт площадка или падает:
 * для этого нужно сравнивать сутки, неделю и месяц. Разбор вынесен отдельно,
 * чтобы период приходил с клиента и не превращался в произвольное число дней —
 * запрос за год положил бы базу.
 *
 * Отрезки календарные и московские: скользящее окно «последние 30 дней»
 * каждый час означало другой кусок времени, и февраль сравнить с мартом по
 * нему было нельзя. Сами границы считает `moscow-periods`.
 */

// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { isMoscowPeriod, moscowPeriodLabel, moscowPeriodRange, previousMoscowPeriodRange, type MoscowPeriod, type PeriodRange } from "./moscow-periods.ts"

export const TRAFFIC_PERIODS = {
  day: { label: "Сегодня" },
  week: { label: "Эта неделя" },
  month: { label: "Этот месяц" },
} as const

export type TrafficPeriod = MoscowPeriod

export function isTrafficPeriod(value: unknown): value is TrafficPeriod {
  return isMoscowPeriod(value)
}

/** Границы выбранного периода: `[from, to)` по московскому календарю. */
export function periodRange(period: TrafficPeriod, now = new Date()): PeriodRange {
  return moscowPeriodRange(period, now)
}

export function periodStart(period: TrafficPeriod, now = new Date()): Date {
  return moscowPeriodRange(period, now).from
}

/**
 * Предыдущий календарный отрезок того же вида — для сравнения «столько же было
 * раньше». Без него число посетителей ничего не говорит: 100 это много или мало?
 */
export function previousPeriodRange(period: TrafficPeriod, now = new Date()): PeriodRange {
  return previousMoscowPeriodRange(period, now)
}

/** Подпись периода с конкретной датой: «Август 2026» вместо «Этот месяц». */
export function periodLabel(period: TrafficPeriod, now = new Date()): string {
  return moscowPeriodLabel(period, now)
}

/** Человеческое имя источника: в базе они хранятся кодами. */
export function trafficSourceLabel(source: string | null): string {
  if (!source) return "Прямые заходы"
  const upper = source.toUpperCase()
  if (upper.startsWith("UTM:")) return `Метка ${source.slice(4).toLowerCase()}`
  const known: Record<string, string> = {
    DIRECT: "Прямые заходы",
    SEARCH: "Поисковые системы",
    ORGANIC_SEARCH: "Поисковые системы",
    SOCIAL: "Соцсети",
    REFERRAL: "Другие сайты",
    TELEGRAM: "Telegram",
    TELEGRAM_APP: "Приложение в Telegram",
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
