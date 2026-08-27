/**
 * Правила опросов форума.
 *
 * Вопрос «какую взять» повторяется в каждом втором обсуждении, и ответы
 * тонут в сотне сообщений. Опрос собирает то же мнение в цифру и
 * удерживает человека в теме: проголосовавший приходит смотреть, чем
 * кончилось.
 *
 * Здесь только проверки и подсчёты, без обращения к базе: правила
 * одинаковы на сервере и в браузере, а форма создания опроса должна
 * сообщать об ошибке до отправки, а не после.
 *
 * Запись голоса — в forum-poll-store.ts: она работает с базой, и
 * запускатель тестов её не разбирает.
 */

/** Ограничения опроса: без них форму можно превратить в анкету на сто пунктов. */
export const POLL_LIMITS = {
  questionMax: 200,
  optionMax: 100,
  /* Меньше двух вариантов — это не опрос, а утверждение. Больше десяти
     не читается: человек выбирает из того, что видит на экране целиком. */
  optionsMin: 2,
  optionsMax: 10,
  /* Год: обсуждение модели живёт годами, но опрос без края превращается
     в мусор, о котором забыли. */
  maxDurationDays: 365,
} as const

export type PollDraft = {
  question: string
  options: string[]
  multiple?: boolean
  closesInDays?: number | null
}

export type PollValidation =
  | { ok: true; question: string; options: string[]; multiple: boolean; closesAt: Date | null }
  | { ok: false; error: string }

/**
 * Проверяет черновик опроса.
 *
 * Возвращает готовые к записи значения, а не только признак годности:
 * обрезка пробелов и отсев пустых строк нужны в любом случае, и делать
 * их дважды — способ разойтись в мелочи.
 */
export function validatePollDraft(draft: PollDraft): PollValidation {
  const question = draft.question.trim()
  if (question.length === 0) return { ok: false, error: "Задайте вопрос" }
  if (question.length > POLL_LIMITS.questionMax) {
    return { ok: false, error: `Вопрос длиннее ${POLL_LIMITS.questionMax} символов` }
  }

  const options = draft.options.map((option) => option.trim()).filter((option) => option.length > 0)
  if (options.length < POLL_LIMITS.optionsMin) {
    return { ok: false, error: "Нужно хотя бы два варианта" }
  }
  if (options.length > POLL_LIMITS.optionsMax) {
    return { ok: false, error: `Не больше ${POLL_LIMITS.optionsMax} вариантов` }
  }
  if (options.some((option) => option.length > POLL_LIMITS.optionMax)) {
    return { ok: false, error: `Вариант длиннее ${POLL_LIMITS.optionMax} символов` }
  }

  /* Одинаковые варианты рассыпают голоса: половина отметит первый
     «Jolion», половина второй, и итог не будет значить ничего. Сравнение
     без учёта регистра и лишних пробелов. */
  const seen = new Set<string>()
  for (const option of options) {
    const key = option.toLowerCase().replace(/\s+/g, " ")
    if (seen.has(key)) return { ok: false, error: `Вариант «${option}» повторяется` }
    seen.add(key)
  }

  let closesAt: Date | null = null
  if (draft.closesInDays !== null && draft.closesInDays !== undefined) {
    const days = Math.trunc(draft.closesInDays)
    if (!Number.isFinite(days) || days < 1) return { ok: false, error: "Срок должен быть хотя бы день" }
    if (days > POLL_LIMITS.maxDurationDays) {
      return { ok: false, error: `Срок не больше ${POLL_LIMITS.maxDurationDays} дней` }
    }
    closesAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
  }

  return { ok: true, question, options, multiple: Boolean(draft.multiple), closesAt }
}

/** Закончилось ли голосование. */
export function isPollClosed(poll: { closesAt: Date | null }, now: Date = new Date()): boolean {
  return poll.closesAt !== null && poll.closesAt.getTime() <= now.getTime()
}

/** Доли в процентах для показа полос. */
export function pollShares(options: { id: string; votes: number }[]): Map<string, number> {
  const total = options.reduce((sum, option) => sum + option.votes, 0)
  const shares = new Map<string, number>()
  for (const option of options) {
    /* При нуле голосов полосы пустые, а не поделены поровну: «по 33% у
       всех» читается как результат, которого нет. */
    shares.set(option.id, total === 0 ? 0 : Math.round((option.votes / total) * 100))
  }
  return shares
}

/** Склонение слова «голос»: 1 голос, 2 голоса, 5 голосов. */
export function pluralVotes(count: number): string {
  const mod100 = count % 100
  const mod10 = count % 10
  if (mod100 >= 11 && mod100 <= 14) return `${count} голосов`
  if (mod10 === 1) return `${count} голос`
  if (mod10 >= 2 && mod10 <= 4) return `${count} голоса`
  return `${count} голосов`
}
