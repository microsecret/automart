import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminSession } from "@/lib/admin-route-guard"
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit"
import { getWeeklyDigestStats, processWeeklyDigest, sendWeeklyDigestPreview } from "@/lib/telegram-weekly-digest"

export const dynamic = "force-dynamic"

/** Сводка еженедельного письма: подписаны, отписались, ушло за неделю, ждут сегодня. */
export async function GET() {
  const guard = await requireAdminSession()
  if (guard.denied) return guard.denied
  try {
    const [stats, plan] = await Promise.all([getWeeklyDigestStats(), processWeeklyDigest({ dryRun: true })])
    return NextResponse.json({ ...stats, dueToday: plan.due })
  } catch (error) {
    console.error("Weekly digest stats failed:", error)
    return NextResponse.json({ error: "Не удалось загрузить сводку" }, { status: 500 })
  }
}

/**
 * Пример письма — в собственный Telegram администратора.
 *
 * Ровно то, что получит человек: текст, кнопки и личная ссылка. Посмотреть
 * до того, как письмо уйдёт сотням людей.
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdminSession()
  if (guard.denied) return guard.denied
  const userId = guard.session?.user?.id
  const limit = rateLimit(`weekly-digest-preview:${userId || getClientIp(request)}`, { windowMs: 60_000, maxRequests: 3 })
  if (!limit.success) return NextResponse.json({ error: "Слишком часто" }, { status: 429, headers: rateLimitHeaders(limit) })

  const admin = userId ? await prisma.user.findUnique({ where: { id: userId }, select: { telegramId: true, telegramVerifiedAt: true } }) : null
  if (!admin?.telegramId || !admin.telegramVerifiedAt) {
    return NextResponse.json({ error: "К вашему аккаунту не привязан Telegram" }, { status: 409 })
  }
  try {
    await sendWeeklyDigestPreview(admin.telegramId)
    return NextResponse.json({ sent: true })
  } catch (error) {
    console.error("Weekly digest preview failed:", error)
    return NextResponse.json({ error: "Не удалось отправить пример" }, { status: 502 })
  }
}
