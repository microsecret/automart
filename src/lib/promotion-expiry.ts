import { prisma } from "@/lib/prisma"

/**
 * Снимает отметку продвижения, срок которого прошёл.
 *
 * Активация ставит объявлению isFeatured и promoType, но снимать их было
 * некому: значок «Премиум» висел на карточке вечно, а объявление стояло
 * выше других и после конца оплаченного срока (аудит 28.10.2026). Это и
 * ложный сигнал покупателю, и бесплатное продвижение.
 *
 * Отдельно от сверки: та по правилу не трогает объявления сама и включает
 * продвижение только через activatePaidPromotion. Одна запись в базу на
 * весь проход, без цикла.
 */
export async function expireFinishedPromotions(now = new Date()): Promise<number> {
  const result = await prisma.listing.updateMany({
    where: { promoUntil: { lte: now }, OR: [{ isFeatured: true }, { promoType: { not: null } }] },
    data: { isFeatured: false, promoType: null },
  })
  return result.count
}
