import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { buildReferralBalance, nextReferralTier, referralCodeForUser, resolveReferralTier } from "@/lib/referral"
import { getSiteUrl } from "@/lib/site-url"

export const dynamic = "force-dynamic"

/** Статистика партнёрской программы для текущего пользователя. */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Требуется вход" }, { status: 401 })

  const partnerId = session.user.id
  const [invitees, rewards, payouts] = await Promise.all([
    prisma.referralAttribution.findMany({
      where: { partnerId },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        createdAt: true,
        // Имя приглашённого не раскрывается целиком: партнёру достаточно
        // видеть факт регистрации и оплаты, а не чужие контакты.
        invitee: { select: { id: true, name: true, createdAt: true } },
      },
    }),
    prisma.referralReward.findMany({
      where: { partnerId },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, amountRub: true, percent: true, orderAmountRub: true, status: true, createdAt: true },
    }),
    prisma.referralPayout.findMany({
      where: { partnerId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, amountRub: true, method: true, reference: true, comment: true, createdAt: true },
    }),
  ])

  const activeRewards = rewards.filter((reward) => reward.status !== "CANCELLED")
  const accruedRub = activeRewards.reduce((sum, reward) => sum + reward.amountRub, 0)
  const paidOutRub = payouts.reduce((sum, payout) => sum + payout.amountRub, 0)
  // Уровень двигают только приглашённые с оплатой, поэтому считаются
  // уникальные плательщики, а не число начислений.
  const distinctPaidInvitees = await prisma.referralReward.groupBy({
    by: ["inviteeId"],
    where: { partnerId, status: { not: "CANCELLED" } },
  })

  const tier = resolveReferralTier(distinctPaidInvitees.length)
  const next = nextReferralTier(distinctPaidInvitees.length)

  return NextResponse.json({
    code: referralCodeForUser(partnerId),
    link: `${getSiteUrl()}/?ref=${referralCodeForUser(partnerId)}`,
    tier,
    nextTier: next,
    stats: {
      invitedCount: invitees.length,
      paidInviteesCount: distinctPaidInvitees.length,
      ...buildReferralBalance(accruedRub, paidOutRub),
    },
    invitees: invitees.map((item) => ({
      id: item.invitee.id,
      // Показывается только первое имя: полные данные приглашённого партнёру
      // не нужны и не должны раскрываться.
      name: item.invitee.name?.split(" ")[0] || "Пользователь",
      joinedAt: item.createdAt,
    })),
    rewards,
    payouts,
    // Партнёру важно знать, что выплата не автоматическая.
    payoutNote: "Выплаты проводит администратор вручную по расчётному счёту. Свяжитесь с поддержкой, чтобы согласовать перевод.",
  })
}
