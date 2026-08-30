import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit"
import { referralCodeForUser } from "@/lib/referral"
import { ensureReferralCode } from "@/lib/referral-accrual"

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

  /* Проверка кода перебирает базу пользователей — самый дорогой запрос
     группы, и он был единственным без ограничения частоты. */
  const limit = rateLimit(`referral-claim:${session.user.id}`, { windowMs: 15 * 60_000, maxRequests: 10 })
  if (!limit.success) {
    return NextResponse.json({ error: "Слишком много попыток. Попробуйте позже." }, { status: 429, headers: rateLimitHeaders(limit) })
  }

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

  /* Владелец кода ищется по индексу. Код выводится из идентификатора
     хешем и обратно не разворачивается, поэтому раньше его искали
     перебором двух тысяч свежих аккаунтов — партнёр, за которым успели
     зарегистрироваться две тысячи новых людей, переставал находиться, и
     приглашение молча терялось вместе с его вознаграждением. */
  const byCode = await prisma.user.findFirst({
    where: { referralCode: code, accountStatus: "ACTIVE" },
    select: { id: true },
  })

  let partnerId = byCode?.id || null

  /* Уже закреплённое приглашение с тем же кодом — второй надёжный
     источник: партнёр приводил людей и до появления поля. */
  if (!partnerId) {
    const known = await prisma.referralAttribution.findFirst({
      where: { code },
      select: { partnerId: true },
    })
    partnerId = known?.partnerId || null
  }

  /* Остаются те, кто получил ссылку до заполнения поля и ещё никого не
     привёл. Перебор здесь запасной и работает по всей базе, а найденному
     партнёру код сразу записывается — второй раз перебирать не придётся. */
  if (!partnerId) {
    const candidates = await prisma.user.findMany({
      where: { accountStatus: "ACTIVE", referralCode: null },
      select: { id: true },
    })
    partnerId = candidates.find((candidate) => referralCodeForUser(candidate.id) === code)?.id || null
    if (partnerId) await ensureReferralCode(partnerId)
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
