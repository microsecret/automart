/**
 * Часы работы заправки из OpenStreetMap — человеческим языком.
 *
 * Данные приходят в формате OSM: «24/7», «Mo-Fr 08:00-20:00; Sa 09:00-18:00».
 * Он однозначен для машины и нечитаем для человека за рулём — а вопрос
 * «открыта ли она сейчас» ночью главный: заправка на карте есть, а
 * приедешь — закрыто.
 *
 * Разбираем не всё: у OSM есть праздники, сезоны, «первый понедельник
 * месяца». Такое встречается у единиц заправок, и притворяться, что мы
 * это поняли, хуже, чем честно показать исходную строку.
 */

const DAY_NAMES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const

export type OpeningState =
  | { kind: "always"; label: "Круглосуточно" }
  | { kind: "open"; label: string; until: string | null }
  | { kind: "closed"; label: string; opensAt: string | null }
  | { kind: "unknown"; label: string }

/** Минуты от полуночи: «08:30» → 510. */
function parseTime(value: string): number | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 24 || minutes > 59) return null
  return hours * 60 + minutes
}

/** Диапазон дней «Mo-Fr» или один день «Sa». */
function parseDays(token: string): number[] {
  const clean = token.trim()
  const range = clean.match(/^([A-Za-z]{2})\s*-\s*([A-Za-z]{2})$/)

  if (range) {
    const from = DAY_NAMES.findIndex((day) => day.toLowerCase() === range[1].toLowerCase())
    const to = DAY_NAMES.findIndex((day) => day.toLowerCase() === range[2].toLowerCase())
    if (from < 0 || to < 0) return []

    const days: number[] = []
    /* Диапазон может заворачиваться через воскресенье: «Sa-Mo». */
    for (let day = from; ; day = (day + 1) % 7) {
      days.push(day)
      if (day === to) break
      if (days.length > 7) break
    }
    return days
  }

  const single = DAY_NAMES.findIndex((day) => day.toLowerCase() === clean.toLowerCase())
  return single >= 0 ? [single] : []
}

/**
 * Открыта ли заправка в указанный момент.
 *
 * Время берётся местное — то, что показывают часы человека: заправка
 * работает по своему городу, а не по серверу.
 */
export function describeOpeningHours(raw: string | null | undefined, now: Date = new Date()): OpeningState {
  const value = raw?.trim()
  if (!value) return { kind: "unknown", label: "" }

  if (/^24\s*\/\s*7$/i.test(value) || /^24 hours$/i.test(value)) {
    return { kind: "always", label: "Круглосуточно" }
  }

  const today = now.getDay()
  const minutesNow = now.getHours() * 60 + now.getMinutes()

  /* Правила разделены точкой с запятой: «Mo-Fr 08:00-20:00; Sa 09:00-18:00». */
  for (const rule of value.split(";")) {
    const parts = rule.trim().split(/\s+/)
    if (parts.length < 2) continue

    const hoursPart = parts[parts.length - 1]
    const daysPart = parts.slice(0, -1).join(" ")

    const days = daysPart.split(",").flatMap(parseDays)
    if (!days.includes(today)) continue

    const interval = hoursPart.match(/^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/)
    if (!interval) continue

    const from = parseTime(interval[1])
    const to = parseTime(interval[2])
    if (from === null || to === null) continue

    /* Смена через полночь: «22:00-06:00» открыта и в 23:00, и в 03:00. */
    const overnight = to <= from
    const open = overnight
      ? minutesNow >= from || minutesNow < to
      : minutesNow >= from && minutesNow < to

    if (open) return { kind: "open", label: "Открыто", until: interval[2] }
    return { kind: "closed", label: "Закрыто", opensAt: interval[1] }
  }

  /* Правило есть, но сегодня оно ничего не говорит — показываем как
     пришло, не выдумывая. */
  return { kind: "unknown", label: value.length > 40 ? "" : value }
}
