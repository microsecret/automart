/**
 * Подтверждение массовой рассылки.
 *
 * Рассылка уходила по одному нажатию: опечатка или недописанный текст
 * разлетались по всей базе бота, и отозвать их нельзя. Между «нажал» и
 * «ушло всем» не было ни одного шага, на котором можно остановиться.
 *
 * Логика вынесена отдельно от страницы: правила «когда предупреждать
 * строже» нужно проверять без Telegram и без базы.
 */

/** Кому уходит рассылка. */
export type BroadcastAudience = "all" | "registered" | "unregistered"

const AUDIENCE_LABELS: Record<BroadcastAudience, string> = {
  all: "всем, кто открывал бота",
  registered: "тем, кто завершил регистрацию",
  unregistered: "тем, кто не завершил регистрацию",
}

/**
 * Размер, начиная с которого рассылка считается крупной.
 *
 * Порог не в том, чтобы запретить, а в том, чтобы человек прочитал
 * число получателей, а не проскочил окно по привычке.
 */
export const LARGE_BROADCAST_THRESHOLD = 500

export type BroadcastConfirmation = {
  title: string
  message: string
  /** Крупная рассылка требует более явного подтверждения. */
  large: boolean
  confirmLabel: string
}

/**
 * Готовит текст подтверждения.
 *
 * Число получателей стоит в заголовке: именно оно останавливает, а не
 * слово «внимание».
 */
export function describeBroadcast(
  audience: BroadcastAudience,
  recipients: number | null,
  text: string,
): BroadcastConfirmation {
  const large = recipients !== null && recipients >= LARGE_BROADCAST_THRESHOLD
  const who = AUDIENCE_LABELS[audience] || AUDIENCE_LABELS.all

  const title = recipients === null
    ? "Отправить рассылку?"
    : `Отправить ${formatRecipients(recipients)}?`

  const parts = [`Сообщение уйдёт ${who}.`]

  /* Отозвать нельзя — это главное, что нужно знать до нажатия. */
  parts.push("Отменить или отредактировать после отправки нельзя.")

  const preview = text.trim().slice(0, 120)
  if (preview) {
    parts.push(`Начало текста: «${preview}${text.trim().length > 120 ? "…" : ""}»`)
  }

  return {
    title,
    message: parts.join(" "),
    large,
    confirmLabel: large ? `Отправить ${formatRecipients(recipients ?? 0)}` : "Отправить",
  }
}

/**
 * Готова ли рассылка к отправке.
 *
 * Пустой текст и отправка без получателей — не ошибки ввода, а признак
 * того, что человек ещё не закончил.
 */
export function broadcastBlockReason(text: string, recipients: number | null): string | null {
  if (!text.trim()) return "Напишите текст рассылки"
  if (text.trim().length < 10) return "Текст слишком короткий для рассылки"
  if (recipients === 0) return "В выбранной группе никого нет"
  return null
}

/** «1 получателю», «2 получателям», «5 получателям». */
function formatRecipients(count: number): string {
  const lastTwo = count % 100
  const lastOne = count % 10

  if (lastTwo >= 11 && lastTwo <= 14) return `${count} получателям`
  if (lastOne === 1) return `${count} получателю`
  return `${count} получателям`
}
