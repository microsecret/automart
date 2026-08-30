/**
 * Разбор предложения магазина по заявке «ищу деталь».
 *
 * Магазин отвечает тем, что знает: у одного есть деталь и точная цена, у
 * другого — только «привезу за неделю», у третьего — «есть аналог,
 * пришлите VIN». Поэтому обязательных полей нет ни одного, но и пустое
 * предложение не проходит: человек оставил заявку, чтобы получить ответ,
 * а не отметку «магазин посмотрел».
 */

export type PartOfferInput = {
  price?: unknown
  condition?: unknown
  leadTimeDays?: unknown
  comment?: unknown
}

export type PartOfferData = {
  price: number | null
  condition: "NEW" | "USED" | null
  leadTimeDays: number | null
  comment: string | null
}

export type PartOfferResult =
  | { ok: true; data: PartOfferData }
  | { ok: false; error: string }

/** Пустая строка и отсутствие значения — одно и то же: поле не заполнено. */
function optionalNumber(value: unknown): number | null | undefined {
  if (value === undefined || value === null || value === "") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

export function parsePartOffer(input: PartOfferInput | null | undefined): PartOfferResult {
  const price = optionalNumber(input?.price)
  if (price === undefined || (price !== null && (price <= 0 || price > 100_000_000))) {
    return { ok: false, error: "Цена должна быть положительным числом" }
  }

  /* Ноль дней — не пропуск, а «есть в наличии»: самый ценный ответ из
     возможных, и терять его нельзя. */
  const leadTimeDays = optionalNumber(input?.leadTimeDays)
  if (leadTimeDays === undefined || (leadTimeDays !== null && (leadTimeDays < 0 || leadTimeDays > 365))) {
    return { ok: false, error: "Срок поставки указывается в днях, от 0 до 365" }
  }

  const comment = typeof input?.comment === "string" ? input.comment.trim().slice(0, 1_000) : ""

  if (price === null && leadTimeDays === null && !comment) {
    return { ok: false, error: "Укажите цену, срок или напишите пояснение" }
  }

  return {
    ok: true,
    data: {
      price: price === null ? null : Math.round(price),
      condition: input?.condition === "USED" ? "USED" : input?.condition === "NEW" ? "NEW" : null,
      leadTimeDays: leadTimeDays === null ? null : Math.round(leadTimeDays),
      comment: comment || null,
    },
  }
}

/**
 * Короткая строка предложения для уведомления.
 *
 * Человек читает её в списке уведомлений или в Telegram, не открывая
 * страницу: там должно быть видно, стоит ли открывать вообще.
 */
export function offerSummary(data: Pick<PartOfferData, "price" | "leadTimeDays">): string {
  const parts: string[] = []
  if (data.price !== null) parts.push(`${data.price.toLocaleString("ru-RU")} ₽`)
  if (data.leadTimeDays === 0) parts.push("в наличии")
  else if (data.leadTimeDays !== null) parts.push(`срок ${data.leadTimeDays} дн`)
  return parts.join(" · ")
}
