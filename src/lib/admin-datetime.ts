/**
 * Дата и время в рабочих разделах.
 *
 * В админке было три разных формата: «24 авг. 2026 · 14:30 ЕКБ» по
 * Екатеринбургу, «24 авг. 14:30» по поясу браузера без подписи и полная
 * дата тоже по браузеру. Сотрудник сверяет «когда пришла заявка» и
 * «когда зарегистрировался» между вкладками — а это разные пояса, и
 * ошибка в два часа никак не видна.
 *
 * Пояс здесь московский: статистика посещаемости уже считается по
 * Москве, и время событий должно совпадать с ней, иначе цифры и записи
 * в журнале расходятся.
 */

/** Пояс, в котором работает площадка. У Москвы он постоянный с 2014 года. */
const TIME_ZONE = "Europe/Moscow"

/** Подпись пояса: без неё непонятно, чьё это время. */
const ZONE_LABEL = "МСК"

/**
 * Полная отметка: «24 авг. 2026 · 14:30 МСК».
 *
 * Год нужен там, где записи живут долго — регистрации, журнал действий,
 * платежи.
 */
export function formatAdminDateTime(value: Date | string | null | undefined): string {
  const date = toDate(value)
  if (!date) return "—"

  const formatted = new Intl.DateTimeFormat("ru-RU", {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)

  /* Разделитель между датой и временем — точка, а не запятая: запятая
     сливается с сокращением месяца («24 авг., 14:30» читается как
     перечисление). */
  return `${formatted.replace(",", " ·")} ${ZONE_LABEL}`
}

/**
 * Короткая отметка: «24 авг. 14:30».
 *
 * Для лент, где всё произошло недавно и год очевиден: обращения в
 * поддержку, сообщения, свежие заявки.
 */
export function formatAdminDateTimeShort(value: Date | string | null | undefined): string {
  const date = toDate(value)
  if (!date) return "—"

  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date).replace(",", "")
}

/** Только дата: «24 авг. 2026». */
export function formatAdminDate(value: Date | string | null | undefined): string {
  const date = toDate(value)
  if (!date) return "—"

  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date)
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}
