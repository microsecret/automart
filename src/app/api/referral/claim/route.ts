import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { referralCodeForUser } from "@/lib/referral"

export const dynamic = "force-dynamic"

/**
 * Закрепляет приглашение за текущим пользователем.
 *
 * Вызывается один раз после регистрации: связь фиксируется навсегда, чтобы
 * вознаграждение нельзя было переписать задним числом, перейдя позже по
 * другой ссылке.
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Требуется вход" }, { status: 401 })

  const body = await request.json().catch(() => null)
  const code = typeof body?.code === "string" ? body.code.trim().toUpperCase().slice(0, 16) : ""
  const source = typeof body?.source === "string" ? body.source.trim().slice(0, 120) || null : null
  if (!code) return NextResponse.json({ error: "Код приглашения не указан" }, { status: 400 })

  const existing = await prisma.referralAttribution.findUnique({
    where: { inviteeId: session.user.id },
    select: { id: true },
  })
  // Повторный переход по другой ссылке ничего не меняет: приглашение
  // принадлежит тому, кто привёл первым.
  if (existing) return NextResponse.json({ attached: false, reason: "Приглашение уже закреплено" })

  // Код выводится из идентификатора, поэтому владелец ищется среди тех, кто
  // уже кого-то пригласил, а если таких нет — среди активных аккаунтов.
  // Перебор ограничен: при росте базы код стоит вынести в поле пользователя.
  const knownPartners = await prisma.referralAttribution.findMany({
    where: { code },
    select: { partnerId: true },
    take: 1,
  })

  let partnerId = knownPartners[0]?.partnerId || null
  if (!partnerId) {
    const candidates = await prisma.user.findMany({
      where: { accountStatus: "ACTIVE" },
      select: { id: true },
      orderBy: { createdAt: "desc" },
      take: 2_000,
    })
    partnerId = candidates.find((candidate) => referralCodeForUser(candidate.id) === code)?.id || null
  }

  const partner = partnerId ? { id: partnerId } : null
  if (!partner) return NextResponse.json({ error: "Приглашение не найдено" }, { status: 404 })
  if (partner.id === session.user.id) {
    return NextResponse.json({ error: "Нельзя пригласить самого себя" }, { status: 409 })
  }

  await prisma.referralAttribution.create({
    data: { partnerId: partner.id, inviteeId: session.user.id, code, source },
  })

  await prisma.notification.create({
    data: {
      userId: partner.id,
      title: "Новый участник по вашей ссылке",
      content: "Приглашённый зарегистрировался. Вознаграждение начислится после оплаты платного тарифа.",
      type: "INFO",
      relatedType: "REFERRAL_ATTRIBUTION",
      relatedId: session.user.id,
    },
  }).catch(() => undefined)

  return NextResponse.json({ attached: true }, { status: 201 })
}
