/**
 * Границы отчётных периодов по московскому времени.
 *
 * Сервер живёт в UTC, и до появления этого модуля сутки в панели начинались
 * в 03:00 по Москве: события с полуночи до трёх часов ночи попадали во
 * «вчера». Владелец смотрит цифры по московскому дню, поэтому границы
 * считаются здесь, а не через локальное время процесса.
 *
 * Смещение задано константой: у Москвы с 2014 года постоянный UTC+3 без
 * перевода часов, и Intl-разбор здесь дал бы ту же цифру ценой аллокаций на
 * каждое событие в цикле по десяткам тысяч записей.
 */

/** Постоянное смещение Москвы от UTC, миллисекунды. */
export const MOSCOW_OFFSET_MS = 3 * 60 * 60 * 1_000

const DAY_MS = 24 * 60 * 60 * 1_000

/**
 * Отчётные периоды панели.
 *
 * `day` и `week` и `month` — календарные, а не скользящие окна: владелец
 * сравнивает февраль с мартом, а не «последние 30 дней» с предыдущими
 * тридцатью, где обе цифры каждый час означают другой отрезок.
 */
export const MOSCOW_PERIODS = {
  day: { label: "Сегодня" },
  week: { label: "Эта неделя" },
  month: { label: "Этот месяц" },
} as const

export type MoscowPeriod = keyof typeof MOSCOW_PERIODS

export function isMoscowPeriod(value: unknown): value is MoscowPeriod {
  return typeof value === "string" && value in MOSCOW_PERIODS
}

/**
 * Момент времени, сдвинутый в московские «часы на стене».
 *
 * Дальше по нему берутся `getUTC*`: так календарные поля читаются московские,
 * а не серверные, без зависимости от TZ процесса.
 */
function toMoscowWallClock(date: Date): Date {
  return new Date(date.getTime() + MOSCOW_OFFSET_MS)
}

/** Календарные поля даты по Москве: год, месяц (0-11), число, день недели. */
export function moscowParts(date: Date) {
  const wall = toMoscowWallClock(date)
  return {
    year: wall.getUTCFullYear(),
    month: wall.getUTCMonth(),
    day: wall.getUTCDate(),
    hour: wall.getUTCHours(),
    // Понедельник = 0: неделя у владельца начинается с понедельника, а
    // getUTCDay() отдаёт воскресенье нулём.
    weekday: (wall.getUTCDay() + 6) % 7,
  }
}

/** Час суток по Москве — для графика активности по часам. */
export function moscowHour(date: Date): number {
  return moscowParts(date).hour
}

/** Момент UTC, соответствующий заданной московской дате и полуночи. */
function moscowMidnightUtc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day) - MOSCOW_OFFSET_MS)
}

/** Начало московских суток, в которые попадает `now`. */
export function moscowDayStart(now: Date = new Date()): Date {
  const { year, month, day } = moscowParts(now)
  return moscowMidnightUtc(year, month, day)
}

/**
 * Полночь понедельника текущей московской недели.
 *
 * Раньше «7 дней» отсчитывались от текущего момента назад, поэтому цифра за
 * неделю менялась в течение дня и никогда не совпадала с календарной неделей.
 */
export function moscowWeekStart(now: Date = new Date()): Date {
  const { weekday } = moscowParts(now)
  return new Date(moscowDayStart(now).getTime() - weekday * DAY_MS)
}

/** Полночь первого числа текущего московского месяца. */
export function moscowMonthStart(now: Date = new Date()): Date {
  const { year, month } = moscowParts(now)
  return moscowMidnightUtc(year, month, 1)
}

/** Ключ московских суток в виде `ГГГГ-ММ-ДД` — им группируются дни графика. */
export function moscowDayKey(date: Date): string {
  const { year, month, day } = moscowParts(date)
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

/** Сдвиг на `days` московских суток вперёд от начала суток. */
export function addMoscowDays(dayStart: Date, days: number): Date {
  const { year, month, day } = moscowParts(dayStart)
  return moscowMidnightUtc(year, month, day + days)
}

/**
 * Границы периода: `[from, to)`.
 *
 * Верхняя граница есть у всех периодов, чтобы предыдущий отрезок считался тем
 * же кодом и не приходилось помнить, где интервал открыт.
 */
export type PeriodRange = { from: Date; to: Date }

export function moscowPeriodRange(period: MoscowPeriod, now: Date = new Date()): PeriodRange {
  switch (period) {
    case "day": {
      const from = moscowDayStart(now)
      return { from, to: addMoscowDays(from, 1) }
    }
    case "week": {
      const from = moscowWeekStart(now)
      return { from, to: addMoscowDays(from, 7) }
    }
    case "month": {
      const { year, month } = moscowParts(now)
      return { from: moscowMidnightUtc(year, month, 1), to: moscowMidnightUtc(year, month + 1, 1) }
    }
  }
}

/**
 * Предыдущий календарный период того же вида — для сравнения «столько же было
 * раньше». Для месяца это именно прошлый месяц, а не «те же 30 дней назад»:
 * иначе февраль сравнивался бы с куском января и куском декабря.
 */
export function previousMoscowPeriodRange(period: MoscowPeriod, now: Date = new Date()): PeriodRange {
  const current = moscowPeriodRange(period, now)
  switch (period) {
    case "day":
      return { from: addMoscowDays(current.from, -1), to: current.from }
    case "week":
      return { from: addMoscowDays(current.from, -7), to: current.from }
    case "month": {
      const { year, month } = moscowParts(now)
      return { from: moscowMidnightUtc(year, month - 1, 1), to: current.from }
    }
  }
}

/**
 * Начала последних `count` московских суток, от старых к новым, включая
 * сегодняшние. Используется как ось графика по дням.
 */
export function lastMoscowDayStarts(count: number, now: Date = new Date()): Date[] {
  const today = moscowDayStart(now)
  return Array.from({ length: count }, (_, index) => addMoscowDays(today, index - (count - 1)))
}

/**
 * Подпись периода вместе с конкретным месяцем: «Этот месяц» ничего не говорит
 * в отчёте, который смотрят через неделю, а «Август 2026» — говорит.
 */
const MONTH_NAMES = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
] as const

/** Родительный падеж: «17 августа», а не «17 август». */
const MONTH_NAMES_GENITIVE = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
] as const

export function moscowPeriodLabel(period: MoscowPeriod, now: Date = new Date()): string {
  if (period === "month") {
    const { year, month } = moscowParts(now)
    return `${MONTH_NAMES[month]} ${year}`
  }
  if (period === "week") {
    const { day, month } = moscowParts(moscowWeekStart(now))
    return `Неделя с ${day} ${MONTH_NAMES_GENITIVE[month]}`
  }
  const { day, month } = moscowParts(now)
  return `${day} ${MONTH_NAMES_GENITIVE[month]}`
}
