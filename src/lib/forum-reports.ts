/**
 * Жалобы на сообщения форума.
 *
 * Без них спам убирать некому: модератор не читает каждую тему, а
 * участник, наткнувшийся на рекламу или на грубость, уходит и больше не
 * возвращается.
 *
 * Здесь только правила, без обращения к базе.
 */

/**
 * Причины жалобы.
 *
 * Список короткий: длинный перечень человек не читает, а выбирает первый
 * пункт, и очередь модератора наполняется жалобами «прочее» без
 * пояснений.
 */
export const REPORT_REASONS = [
  { value: "SPAM", label: "Реклама или спам" },
  { value: "RUDE", label: "Грубость, оскорбление" },
  { value: "OFFTOPIC", label: "Не по теме" },
  { value: "WRONG", label: "Опасный или неверный совет" },
  { value: "OTHER", label: "Другое" },
] as const

export type ReportReason = (typeof REPORT_REASONS)[number]["value"]

const REASON_SET = new Set<string>(REPORT_REASONS.map((item) => item.value))

export function isReportReason(value: string): value is ReportReason {
  return REASON_SET.has(value)
}

/** Подпись причины для очереди модератора. */
export function reportReasonLabel(value: string): string {
  return REPORT_REASONS.find((item) => item.value === value)?.label || value
}

export const REPORT_COMMENT_MAX = 500

export type ReportValidation =
  | { ok: true; reason: ReportReason; comment: string | null }
  | { ok: false; error: string }

/**
 * Проверяет жалобу.
 *
 * «Опасный совет» требует пояснения: без него модератор не отличит
 * неверную рекомендацию от несогласия с ней, а на форуме о технике это
 * разные вещи.
 */
export function validateReport(input: { reason: string; comment?: string | null }): ReportValidation {
  if (!isReportReason(input.reason)) return { ok: false, error: "Выберите причину" }

  const comment = (input.comment || "").trim()
  if (comment.length > REPORT_COMMENT_MAX) {
    return { ok: false, error: `Пояснение длиннее ${REPORT_COMMENT_MAX} символов` }
  }

  if ((input.reason === "OTHER" || input.reason === "WRONG") && comment.length < 5) {
    return {
      ok: false,
      error: input.reason === "OTHER"
        ? "Опишите, что не так"
        : "Напишите, чем именно совет опасен",
    }
  }

  return { ok: true, reason: input.reason, comment: comment || null }
}

/**
 * Можно ли жаловаться на это сообщение.
 *
 * На своё — нет: если написал не то, есть правка. Жалоба на себя только
 * занимает очередь модератора.
 */
export function canReportPost(input: {
  postAuthorId: string
  viewerId: string | null
  postDeleted: boolean
}): boolean {
  if (!input.viewerId) return false
  if (input.postDeleted) return false
  return input.postAuthorId !== input.viewerId
}
