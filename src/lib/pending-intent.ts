/**
 * Намерение, отложенное на время входа.
 *
 * Человек нажимает «Показать телефон», его отправляют на вход, он
 * регистрируется и возвращается на ту же страницу — где надо нажать
 * кнопку заново. Половина на этом уходит: они уже сделали шаг, который
 * от них требовали, и не понимают, почему ничего не произошло.
 *
 * Намерение едет в адресе возврата и выполняется само. Здесь только
 * разбор и сборка — без сети и базы, чтобы это можно было проверить.
 */

/**
 * Что человек хотел сделать.
 *
 * Список закрытый: произвольная строка из адреса превратилась бы в
 * способ заставить чужой браузер выполнить действие по ссылке.
 */
export const PENDING_INTENTS = ["phone", "favorite", "message"] as const

export type PendingIntent = (typeof PENDING_INTENTS)[number]

const INTENT_SET = new Set<string>(PENDING_INTENTS)

export function isPendingIntent(value: string | null | undefined): value is PendingIntent {
  return typeof value === "string" && INTENT_SET.has(value)
}

/** Имя параметра в адресе. */
export const INTENT_PARAM = "after"

/**
 * Собирает адрес возврата с намерением.
 *
 * Возврат всегда на ту же страницу: уводить человека после входа в
 * другое место — верный способ его потерять.
 */
export function returnUrlWithIntent(path: string, intent: PendingIntent): string {
  const separator = path.includes("?") ? "&" : "?"
  return `${path}${separator}${INTENT_PARAM}=${intent}`
}

/**
 * Читает намерение из адреса.
 *
 * Неизвестное значение отбрасывается молча: человек мог поправить адрес
 * руками, и падать из-за этого незачем.
 */
export function readIntent(search: string | URLSearchParams): PendingIntent | null {
  const params = typeof search === "string" ? new URLSearchParams(search) : search
  const value = params.get(INTENT_PARAM)
  return isPendingIntent(value) ? value : null
}

/**
 * Адрес без намерения — для замены в истории браузера.
 *
 * Без очистки намерение повторится при обновлении страницы, а «Назад»
 * будет всякий раз открывать телефон заново.
 */
export function stripIntent(path: string): string {
  const [base, query] = path.split("?")
  if (!query) return base

  const params = new URLSearchParams(query)
  params.delete(INTENT_PARAM)
  const rest = params.toString()
  return rest ? `${base}?${rest}` : base
}
