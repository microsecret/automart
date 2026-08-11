import { randomUUID } from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

const REPORT_REASONS = new Set([
  "MISLEADING",
  "FRAUD",
  "PROHIBITED",
  "DUPLICATE",
  "OTHER",
])

const REPORT_REASON_LABELS: Record<string, string> = {
  MISLEADING: "Недостоверная информация",
  FRAUD: "Подозрение на мошенничество",
  PROHIBITED: "Запрещённый контент",
  DUPLICATE: "Повторное объявление",
  OTHER: "Другая причина",
}

/** POST /api/listings/:id/reports — creates one auditable moderation report. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Войдите, чтобы пожаловаться на объявление" }, { status: 401 })

    const { id: listingId } = await params
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Некорректные данные жалобы" }, { status: 400 })
    }

    const reason = typeof body.reason === "string" ? body.reason.trim().toUpperCase() : ""
    const comment = typeof body.comment === "string" ? body.comment.trim() : ""
    if (!REPORT_REASONS.has(reason)) {
      return NextResponse.json({ error: "Выберите причину жалобы" }, { status: 400 })
    }
    if (comment.length > 1_000) {
      return NextResponse.json({ error: "Комментарий не должен превышать 1000 символов" }, { status: 400 })
    }

    const userLimit = rateLimit(`listing:reports:user:${session.user.id}`, { windowMs: 24 * 60 * 60_000, maxRequests: 8 })
    const ipLimit = rateLimit(`listing:reports:ip:${getClientIp(request)}`, { windowMs: 24 * 60 * 60_000, maxRequests: 20 })
    if (!userLimit.success || !ipLimit.success) {
      const limit = !userLimit.success ? userLimit : ipLimit
      return NextResponse.json(
        { error: "Лимит жалоб на сегодня исчерпан. Попробуйте завтра." },
        { status: 429, headers: rateLimitHeaders(limit) },
      )
    }

    const listing = await prisma.listing.findFirst({
      where: { id: listingId, deletedAt: null },
      select: { id: true, title: true, userId: true },
    })
    if (!listing) return NextResponse.json({ error: "Объявление недоступно" }, { status: 404 })
    if (listing.userId === session.user.id) {
      return NextResponse.json({ error: "Нельзя пожаловаться на собственное объявление" }, { status: 403 })
    }

    const reportId = randomUUID()
    const now = new Date()
    const moderators = await prisma.user.findMany({
      where: { role: { in: ["ADMIN", "MODERATOR"] } },
      select: { id: true },
    })

    const created = await prisma.$transaction(async (tx) => {
      const createdCount = await tx.$executeRaw`
        INSERT INTO "ListingReport" (
          "id", "listingId", "reporterId", "reason", "comment", "status", "createdAt", "updatedAt"
        ) VALUES (
          ${reportId}, ${listingId}, ${session.user.id}, ${reason}, ${comment || null}, 'OPEN', ${now}, ${now}
        )
        ON CONFLICT("listingId", "reporterId") DO NOTHING
      `
      if (createdCount === 0) return false
      if (moderators.length > 0) {
        await tx.notification.createMany({
          data: moderators.map((moderator) => ({
            userId: moderator.id,
            type: "WARNING",
            title: "Новая жалоба на объявление",
            content: `${REPORT_REASON_LABELS[reason]}: ${listing.title}`,
            relatedId: reportId,
            relatedType: "LISTING_REPORT",
          })),
        })
      }
      return true
    })

    if (!created) {
      return NextResponse.json({ error: "Вы уже отправляли жалобу на это объявление" }, { status: 409 })
    }

    return NextResponse.json({ id: reportId, status: "OPEN" }, { status: 201 })
  } catch (error) {
    console.error("POST listing report error:", error)
    return NextResponse.json({ error: "Не удалось отправить жалобу. Повторите попытку позже." }, { status: 500 })
  }
}
