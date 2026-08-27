/**
 * Цитирование чужого сообщения.
 *
 * Кнопка «Ответить с цитатой» стоит под сообщением, а поле ввода — внизу
 * страницы, и это разные части дерева без общего родителя. Связывать их
 * через хранилище состояния ради одной кнопки — лишняя постройка;
 * событие окна делает то же самое и ничего не тянет за собой.
 */

export const QUOTE_EVENT = "forum:quote"

export type QuoteRequest = {
  /** Имя автора: цитата без имени в длинной ветке ничего не говорит. */
  author: string
  /** Текст сообщения — уже без разметки. */
  text: string
}

/* Цитата обрезается: в ответ на разбор поломки на две тысячи знаков
   вставлять его целиком незачем — читатель видит его выше, а нужен
   кусок, к которому относится ответ. */
const QUOTE_MAX = 280

/**
 * Собирает цитату в пометках разметки.
 *
 * Каждая строка получает «>»: разбор цитат построчный, и без пометки на
 * каждой строке в цитату попадёт только первая.
 */
export function buildQuote(request: QuoteRequest): string {
  const trimmed = request.text.trim().replace(/\s+/g, " ")
  const cut = trimmed.length > QUOTE_MAX ? `${trimmed.slice(0, QUOTE_MAX).trimEnd()}…` : trimmed

  const author = request.author.trim() || "Участник"
  /* Пустая строка после цитаты: без неё ответ прилипнет к ней и станет
     частью цитаты при разборе. */
  return `> **${author}:**\n> ${cut}\n\n`
}

/** Просит форму ответа вставить цитату. */
export function requestQuote(request: QuoteRequest): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent<QuoteRequest>(QUOTE_EVENT, { detail: request }))
}
