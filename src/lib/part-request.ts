/**
 * Заявка «ищу деталь».
 *
 * В разделе запчастей нет ни одной позиции: продавцы ещё не пришли, а
 * покупатели уже заходят и упираются в пустую страницу. Заявка
 * переворачивает порядок — человек описывает нужную деталь, а магазины
 * отвечают предложениями. Витрине не нужно быть полной, чтобы раздел
 * приносил пользу.
 *
 * Разбор вынесен отдельно от маршрута: правила «какая заявка полезна»
 * нужно проверять без базы и сети.
 */

/** Как продавец может связаться с человеком. */
export const CONTACT_METHODS = ["PHONE", "MESSENGER", "EMAIL"] as const
export type ContactMethod = (typeof CONTACT_METHODS)[number]

/** Состояние детали, которое человек готов принять. */
export const ACCEPTED_CONDITIONS = ["NEW", "USED", "ANY"] as const
export type AcceptedCondition = (typeof ACCEPTED_CONDITIONS)[number]

export type PartRequestDraft = {
  partName?: string | null
  oemNumber?: string | null
  make?: string | null
  model?: string | null
  year?: number | string | null
  vin?: string | null
  condition?: string | null
  comment?: string | null
  contactMethod?: string | null
}

export type ValidationIssue = { field: string; message: string }

/**
 * Достаточно ли в заявке сведений, чтобы продавец мог ответить.
 *
 * Порог намеренно низкий: требовать VIN и год от человека, который знает
 * только «нужен насос на Камри», значит потерять заявку. Но заявка без
 * названия и без номера детали бесполезна обеим сторонам — продавец не
 * поймёт, что искать.
 */
export function validatePartRequest(draft: PartRequestDraft): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  const name = trim(draft.partName)
  const oem = trim(draft.oemNumber)

  /* Либо название, либо номер — одного достаточно. По номеру продавец
     найдёт деталь точнее, чем по названию, и наоборот: название
     понятно человеку, который номера не знает. */
  if (!name && !oem) {
    issues.push({ field: "partName", message: "Назовите деталь или укажите её номер" })
  }

  if (name && name.length < 2) {
    issues.push({ field: "partName", message: "Слишком короткое название" })
  }

  if (name && name.length > 200) {
    issues.push({ field: "partName", message: "Название длиннее 200 символов" })
  }

  const year = parseYear(draft.year)
  if (draft.year !== null && draft.year !== undefined && draft.year !== "" && year === null) {
    issues.push({ field: "year", message: "Год выпуска указан неверно" })
  }

  const vin = trim(draft.vin)
  if (vin && !isPlausibleVin(vin)) {
    issues.push({ field: "vin", message: "VIN состоит из 17 знаков без букв I, O и Q" })
  }

  if (draft.condition && !ACCEPTED_CONDITIONS.includes(draft.condition as AcceptedCondition)) {
    issues.push({ field: "condition", message: "Неизвестное состояние детали" })
  }

  if (draft.contactMethod && !CONTACT_METHODS.includes(draft.contactMethod as ContactMethod)) {
    issues.push({ field: "contactMethod", message: "Неизвестный способ связи" })
  }

  const comment = trim(draft.comment)
  if (comment && comment.length > 2000) {
    issues.push({ field: "comment", message: "Комментарий длиннее 2000 символов" })
  }

  return issues
}

/**
 * Приводит заявку к виду для записи.
 *
 * Отдельно от проверки: маршрут сначала убеждается, что заявка годная, и
 * только потом получает готовые поля.
 */
export function normalizePartRequest(draft: PartRequestDraft) {
  return {
    partName: trim(draft.partName),
    oemNumber: normalizeOem(draft.oemNumber),
    make: trim(draft.make),
    model: trim(draft.model),
    year: parseYear(draft.year),
    vin: normalizeVin(draft.vin),
    condition: (draft.condition && ACCEPTED_CONDITIONS.includes(draft.condition as AcceptedCondition)
      ? draft.condition
      : "ANY") as AcceptedCondition,
    comment: trim(draft.comment),
    contactMethod: (draft.contactMethod && CONTACT_METHODS.includes(draft.contactMethod as ContactMethod)
      ? draft.contactMethod
      : "PHONE") as ContactMethod,
  }
}

/**
 * Насколько заявка понятна продавцу — от 0 до 100.
 *
 * Нужно для сортировки в кабинете магазина: заявка с номером детали и
 * VIN обрабатывается за минуту, а «нужен фильтр на японку» требует
 * переписки. Показывать их вперемешку значит хоронить хорошие заявки
 * под плохими.
 */
export function requestClarity(draft: PartRequestDraft): number {
  const normalized = normalizePartRequest(draft)
  let score = 0

  if (normalized.partName) score += 25
  if (normalized.oemNumber) score += 30
  if (normalized.make) score += 15
  if (normalized.model) score += 10
  if (normalized.year) score += 10
  if (normalized.vin) score += 10

  return Math.min(100, score)
}

/** Заголовок заявки для списка: «Насос ГУР · Toyota Camry, 2015». */
export function requestSummary(draft: PartRequestDraft): string {
  const n = normalizePartRequest(draft)
  const what = n.partName || (n.oemNumber ? `Деталь ${n.oemNumber}` : "Деталь")

  const car = [n.make, n.model].filter(Boolean).join(" ")
  const carWithYear = [car, n.year ? String(n.year) : null].filter(Boolean).join(", ")

  return carWithYear ? `${what} · ${carWithYear}` : what
}

function trim(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed || null
}

/** Номер детали сравнивается без пробелов и дефисов: их пишут как придётся. */
function normalizeOem(value: string | null | undefined): string | null {
  const trimmed = trim(value)
  if (!trimmed) return null
  const cleaned = trimmed.toUpperCase().replace(/[\s\-.]/g, "")
  return cleaned || null
}

function normalizeVin(value: string | null | undefined): string | null {
  const trimmed = trim(value)
  if (!trimmed) return null
  const upper = trimmed.toUpperCase()
  return isPlausibleVin(upper) ? upper : null
}

/**
 * VIN — 17 знаков без I, O и Q: их исключили, чтобы не путать с 1 и 0.
 * Полную проверку контрольного разряда здесь не делаем: у части
 * европейских машин она не сходится, и отказ был бы ложным.
 */
function isPlausibleVin(value: string): boolean {
  return /^[A-HJ-NPR-Z0-9]{17}$/i.test(value)
}

function parseYear(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null
  const year = typeof value === "number" ? value : Number.parseInt(String(value).trim(), 10)
  if (!Number.isInteger(year)) return null

  /* Нижняя граница — год, раньше которого запчасти на площадке не ищут;
     верхняя — следующий год: машины продаются до наступления модельного. */
  const nextYear = new Date().getFullYear() + 1
  if (year < 1950 || year > nextYear) return null
  return year
}
