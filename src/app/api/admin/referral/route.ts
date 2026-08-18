import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { isAdmin } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { recordAdminAudit } from "@/lib/admin-audit"
import { buildReferralBalance, resolveReferralTier } from "@/lib/referral"

export const dynamic = "force-dynamic"

/** Партнёры с начислениями: кому и сколько площадка должна перевести. */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Доступ только для администраторов" }, { status: 403 })
  }

  const [rewards, payouts] = await Promise.all([
    prisma.referralReward.groupBy({
      by: ["partnerId"],
      where: { status: { not: "CANCELLED" } },
      _sum: { amountRub: true },
      _count: { _all: true },
    }),
    prisma.referralPayout.groupBy({
      by: ["partnerId"],
      _sum: { amountRub: true },
    }),
  ])

  const paidByPartner = new Map(payouts.map((row) => [row.partnerId, row._sum.amountRub || 0]))
  const partnerIds = [...new Set([...rewards.map((r) => r.partnerId), ...payouts.map((p) => p.partnerId)])]
  const users = await prisma.user.findMany({
    where: { id: { in: partnerIds } },
    select: { id: true, name: true, email: true, telegramUsername: true },
  })
  const userById = new Map(users.map((user) => [user.id, user]))

  const paidInvitees = await prisma.referralReward.groupBy({
    by: ["partnerId", "inviteeId"],
    where: { status: { not: "CANCELLED" } },
  })
  const inviteeCount = new Map<string, number>()
  for (const row of paidInvitees) {
    inviteeCount.set(row.partnerId, (inviteeCount.get(row.partnerId) || 0) + 1)
  }

  const partners = partnerIds.map((partnerId) => {
    const accrued = rewards.find((r) => r.partnerId === partnerId)?._sum.amountRub || 0
    const balance = buildReferralBalance(accrued, paidByPartner.get(partnerId) || 0)
    const user = userById.get(partnerId)
    return {
      partnerId,
      name: user?.name || null,
      email: user?.email || null,
      telegramUsername: user?.telegramUsername || null,
      tier: resolveReferralTier(inviteeCount.get(partnerId) || 0),
      paidInvitees: inviteeCount.get(partnerId) || 0,
      ...balance,
    }
  })
  // Первыми идут те, кому площадка должна больше всего: их выплаты нельзя
  // затягивать.
  .sort((left, right) => right.availableRub - left.availableRub)

  return NextResponse.json({ partners })
}

/** Фиксирует перевод, который администратор уже провёл по расчётному счёту. */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Доступ только для администраторов" }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const partnerId = typeof body?.partnerId === "string" ? body.partnerId : ""
  const amountRub = Number(body?.amountRub)
  const method = typeof body?.method === "string" ? body.method.trim().slice(0, 80) || null : null
  const reference = typeof body?.reference === "string" ? body.reference.trim().slice(0, 120) || null : null
  const comment = typeof body?.comment === "string" ? body.comment.trim().slice(0, 500) || null : null

  if (!partnerId) return NextResponse.json({ error: "Партнёр не указан" }, { status: 400 })
  if (!Number.isFinite(amountRub) || amountRub <= 0 || amountRub > 10_000_000) {
    return NextResponse.json({ error: "Сумма перевода должна быть положительной" }, { status: 400 })
  }

  const partner = await prisma.user.findUnique({ where: { id: partnerId }, select: { id: true, email: true, name: true } })
  if (!partner) return NextResponse.json({ error: "Партнёр не найден" }, { status: 404 })

  const [accrued, alreadyPaid] = await Promise.all([
    prisma.referralReward.aggregate({ where: { partnerId, status: { not: "CANCELLED" } }, _sum: { amountRub: true } }),
    prisma.referralPayout.aggregate({ where: { partnerId }, _sum: { amountRub: true } }),
  ])
  const balance = buildReferralBalance(accrued._sum.amountRub || 0, alreadyPaid._sum.amountRub || 0)
  // Перевод больше долга — почти всегда опечатка в сумме, а исправить запись
  // о деньгах задним числом сложнее, чем ввести её заново.
  if (Math.round(amountRub) > balance.availableRub) {
    return NextResponse.json(
      { error: `Доступно к выплате ${balance.availableRub.toLocaleString("ru-RU")} ₽. Проверьте сумму.` },
      { status: 409 },
    )
  }

  const payout = await prisma.referralPayout.create({
    data: {
      partnerId,
      amountRub: Math.round(amountRub),
      method,
      reference,
      comment,
      createdById: session.user.id,
    },
    select: { id: true, amountRub: true, createdAt: true },
  })

  // Партнёр должен увидеть перевод, не дожидаясь ответа поддержки.
  await prisma.notification.create({
    data: {
      userId: partnerId,
      title: "Выплата по партнёрской программе",
      content: `Переведено ${payout.amountRub.toLocaleString("ru-RU")} ₽${reference ? `, платёж № ${reference}` : ""}.`,
      type: "SUCCESS",
      relatedType: "REFERRAL_PAYOUT",
      relatedId: payout.id,
    },
  }).catch(() => undefined)

  await recordAdminAudit({
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "REFERRAL_PAYOUT",
    entityType: "ReferralPayout",
    entityId: payout.id,
    summary: `Выплата ${payout.amountRub.toLocaleString("ru-RU")} ₽ партнёру ${partner.email || partner.name || partnerId}`,
    metadata: { partnerId, amountRub: payout.amountRub, method, reference },
  })

  return NextResponse.json({ payout }, { status: 201 })
}
