import { prisma } from "@/lib/prisma"
import { calculateRewardAmount, referralCodeForUser, resolveReferralTier } from "@/lib/referral"

/**
 * Начисляет партнёру вознаграждение за оплату приглашённого.
 *
 * Вызывается после подтверждённой оплаты. Ошибка начисления не отменяет саму
 * оплату: тариф уже активирован, и терять его из-за сбоя в партнёрской
 * программе нельзя — начисление можно восстановить, платёж нет.
 */
export async function accrueReferralReward(promotionOrderId: string) {
  try {
    const order = await prisma.promotionOrder.findUnique({
      where: { id: promotionOrderId },
      select: { id: true, userId: true, amountRub: true, status: true },
    })
    if (!order || order.status !== "PAID" || order.amountRub <= 0) return

    const attribution = await prisma.referralAttribution.findUnique({
      where: { inviteeId: order.userId },
      select: { partnerId: true },
    })
    if (!attribution) return
    // Самоприглашение не должно приносить вознаграждение.
    if (attribution.partnerId === order.userId) return

    // Уровень определяется по числу приглашённых, у которых уже есть
    // начисление: сам этот платёж в расчёт ставки ещё не входит.
    const paidInvitees = await prisma.referralReward.groupBy({
      by: ["inviteeId"],
      where: { partnerId: attribution.partnerId, status: { not: "CANCELLED" } },
    })
    const tier = resolveReferralTier(paidInvitees.length)
    const amountRub = calculateRewardAmount(order.amountRub, tier.percent)
    if (amountRub <= 0) return

    // Уникальность по заказу защищает от повторного начисления, если вебхук
    // придёт дважды.
    await prisma.referralReward.create({
      data: {
        partnerId: attribution.partnerId,
        inviteeId: order.userId,
        promotionOrderId: order.id,
        orderAmountRub: order.amountRub,
        percent: tier.percent,
        amountRub,
      },
    })

    await prisma.notification.create({
      data: {
        userId: attribution.partnerId,
        title: "Начисление по партнёрской программе",
        content: `Приглашённый оплатил тариф. Начислено ${amountRub.toLocaleString("ru-RU")} ₽ по ставке ${tier.percent}%.`,
        type: "SUCCESS",
        relatedType: "REFERRAL_REWARD",
        relatedId: order.id,
      },
    }).catch(() => undefined)
  } catch (error) {
    // Повторное начисление отсекается уникальным индексом, поэтому такая
    // ошибка ожидаема и не требует внимания оператора.
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes("Unique constraint")) return
    console.error("Referral accrual failed", message)
  }
}

/**
 * Записывает код партнёра в поле пользователя, если его там ещё нет.
 *
 * Код всегда выводится из идентификатора и потому не может разойтись с
 * аккаунтом — поле нужно ради обратного поиска: по хешу владельца не
 * найти, и раньше его искали перебором двух тысяч свежих аккаунтов.
 * Партнёр, за которым зарегистрировались две тысячи новых людей,
 * переставал находиться: приглашение отклонялось как «не найдено», а
 * вознаграждение не начислялось — молча, никто из двоих об этом не
 * узнавал.
 *
 * Вызывается там, где человек и так открывает кабинет партнёра или
 * переходит по приглашению: отдельного прохода по базе не нужно, поле
 * наполняется само.
 */
export async function ensureReferralCode(userId: string) {
  const code = referralCodeForUser(userId)
  try {
    await prisma.user.update({ where: { id: userId }, data: { referralCode: code } })
  } catch {
    /* Запись не удалась — код всё равно верен: он выводится из
       идентификатора. Поиск по нему просто останется прежним. */
  }
  return code
}
