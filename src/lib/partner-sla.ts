// Заявка достаётся партнёру, который реально её отработает. Регион и загрузка
// говорят только о доступности, поэтому к ним добавляется качество работы:
// как быстро партнёр отвечает, как часто вообще отвечает и доводит ли сделку
// до закрытия. Показатели считаются из фактических заявок, без ручных оценок.

import { calculatePartnerRating } from "./partner-scoring.js"

export { calculatePartnerRating, SLA_NEUTRAL_RATING, SLA_RESPONSE_TARGET_MINUTES } from "./partner-scoring.js"

export type PartnerOfferOutcome = {
  status: string
  createdAt: Date
  respondedAt: Date | null
  expiresAt: Date
}

export type PartnerSlaMetrics = {
  responseMinutes: number | null
  acceptedOffers: number
  missedOffers: number
  closedDeals: number
  rating: number
}

function median(values: number[]) {
  if (!values.length) return null
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? Math.round((sorted[middle - 1] + sorted[middle]) / 2)
    : sorted[middle]
}

/**
 * Сводит историю офферов партнёра к показателям качества.
 *
 * `closedDeals` приходит отдельно: сделка закрывается уже вне оффера, поэтому
 * считать её по офферам нельзя.
 */
export function buildPartnerSlaMetrics(offers: PartnerOfferOutcome[], closedDeals = 0, now = new Date()): PartnerSlaMetrics {
  // Предложение, перехваченное другим партнёром, закрывается системой, а не
  // самим партнёром: его нельзя считать ни ответом, ни пропуском.
  const partnerOwned = offers.filter((offer) => offer.status !== "SUPERSEDED")
  const responded = partnerOwned.filter((offer) => offer.respondedAt)
  const responseMinutes = median(
    responded.map((offer) => Math.max(0, Math.round((offer.respondedAt!.getTime() - offer.createdAt.getTime()) / 60_000))),
  )
  const acceptedOffers = partnerOwned.filter((offer) => offer.status === "ACCEPTED").length
  // Пропущенным считается только истёкший оффер: явный отказ — это ответ, а
  // ещё открытый оффер партнёр вправе обдумывать до срока.
  const missedOffers = partnerOwned.filter((offer) => offer.status !== "ACCEPTED" && offer.status !== "DECLINED" && !offer.respondedAt && offer.expiresAt <= now).length

  return {
    responseMinutes,
    acceptedOffers,
    missedOffers,
    closedDeals,
    rating: calculatePartnerRating({ responseMinutes, acceptedOffers, missedOffers, closedDeals }),
  }
}

/**
 * Рейтинг 0..100. Партнёр без истории получает нейтральные 50, иначе новый
 * участник никогда не получил бы первую заявку.
 */
/** Человекочитаемое описание уровня партнёра для админки и карточки. */
export function describePartnerRating(rating: number, hasHistory: boolean) {
  if (!hasHistory) return { label: "Новый партнёр", color: "gray" as const }
  if (rating >= 80) return { label: "Отвечает быстро", color: "teal" as const }
  if (rating >= 60) return { label: "Стабильно отвечает", color: "blue" as const }
  if (rating >= 40) return { label: "Отвечает не всегда", color: "yellow" as const }
  return { label: "Часто пропускает заявки", color: "red" as const }
}
