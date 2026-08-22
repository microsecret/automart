/**
 * Возраст задачи в очереди администратора.
 *
 * Панель показывала «3 объявления на проверке» — и три задачи возрастом
 * двадцать минут выглядели так же, как три, лежащие пятый день. Число само
 * по себе не отвечает на вопрос «что горит», а именно за этим владелец и
 * открывает панель утром.
 */

/**
 * Пороги срочности, часы.
 *
 * Значения выбраны по смыслу задачи, а не по круглым числам: объявление на
 * проверке блокирует продавца, поэтому сутки — уже плохо. Заявка на импорт
 * — живой человек, ждущий ответа, для неё порог жёстче.
 */
export const QUEUE_THRESHOLDS = {
  /** Всё, что дольше, подсвечивается как требующее внимания. */
  warning: 24,
  /** Всё, что дольше, подсвечивается как просроченное. */
  critical: 72,
} as const

export type QueueUrgency = "fresh" | "warning" | "critical"

/** Часы с указанного момента. Дробные значения не нужны: решения принимают в часах. */
export function hoursSince(date: Date | string | null | undefined, now = new Date()): number | null {
  if (!date) return null
  const value = date instanceof Date ? date : new Date(date)
  const ms = now.getTime() - value.getTime()
  // Дата из будущего — данные повреждены, показывать «минус три часа» нельзя.
  if (!Number.isFinite(ms) || ms < 0) return null
  return Math.floor(ms / (60 * 60 * 1000))
}

/** Насколько срочна задача такого возраста. */
export function queueUrgency(hours: number | null): QueueUrgency {
  if (hours === null) return "fresh"
  if (hours >= QUEUE_THRESHOLDS.critical) return "critical"
  if (hours >= QUEUE_THRESHOLDS.warning) return "warning"
  return "fresh"
}

/**
 * Возраст словами: «4 часа», «2 дня».
 *
 * Часы читаются, пока их немного; дальше человек мыслит днями, и «73 часа»
 * приходится переводить в уме.
 */
export function formatQueueAge(hours: number | null): string | null {
  if (hours === null) return null
  if (hours < 1) return "меньше часа"
  if (hours < 24) return `${hours} ${plural(hours, "час", "часа", "часов")}`
  const days = Math.floor(hours / 24)
  return `${days} ${plural(days, "день", "дня", "дней")}`
}

function plural(count: number, one: string, few: string, many: string): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few
  return many
}

/**
 * Порядок задач в очереди: сначала то, что ждёт дольше.
 *
 * Раньше очередь сортировалась по величине счётчика — наверх попадало то,
 * чего просто больше, а не то, что горит. Пункт с одной задачей возрастом
 * неделю важнее пункта с пятью задачами возрастом час.
 */
export function compareByUrgency(
  a: { oldestHours: number | null },
  b: { oldestHours: number | null },
): number {
  // Пустые очереди уходят вниз: там нечего делать.
  if (a.oldestHours === null && b.oldestHours === null) return 0
  if (a.oldestHours === null) return 1
  if (b.oldestHours === null) return -1
  return b.oldestHours - a.oldestHours
}
