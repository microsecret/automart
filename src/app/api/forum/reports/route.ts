import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requireUser } from "@/lib/api-session-guard"
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit"
import { canReportPost, validateReport } from "@/lib/forum-reports"

export const dynamic = "force-dynamic"

/**
 * POST /api/forum/reports — пожаловаться на сообщение.
 *
 * Без жалоб спам убирать некому: модератор не читает каждую тему, а
 * участник, наткнувшийся на рекламу, уходит и больше не возвращается.
 */
export async function POST(request: NextRequest) {
  const guard = await requireUser()
  if (guard.denied) return guard.denied

  /* Предел жёсткий: жалоба это не обычное действие, а десяток жалоб
     подряд от одного человека — сам по себе повод присмотреться. */
  const limit = rateLimit(`forum:report:${guard.userId}`, { windowMs: 60 * 60_000, maxRequests: 15 })
  const ipLimit = rateLimit(`forum:report:ip:${getClientIp(request)}`, { windowMs: 60 * 60_000, maxRequests: 40 })
  if (!limit.success || !ipLimit.success) {
    return NextResponse.json(
      { error: "Слишком много жалоб подряд. Подождите немного." },
      { status: 429, headers: rateLimitHeaders(limit.success ? ipLimit : limit) },
    )
  }

  const body = await request.json().catch(() => null)
  const postId = typeof body?.postId === "string" ? body.postId : ""

  const check = validateReport({
    reason: typeof body?.reason === "string" ? body.reason : "",
    comment: typeof body?.comment === "string" ? body.comment : null,
  })
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 })

  const post = await prisma.forumPost.findUnique({
    where: { id: postId },
    select: { id: true, authorId: true, deletedAt: true },
  })
  if (!post) return NextResponse.json({ error: "Сообщение не найдено" }, { status: 404 })

  if (!canReportPost({ postAuthorId: post.authorId, viewerId: guard.userId, postDeleted: post.deletedAt !== null })) {
    /* На своё сообщение жаловаться нечего: если написал не то, есть
       правка. */
    return NextResponse.json({ error: "На это сообщение пожаловаться нельзя" }, { status: 403 })
  }

  try {
    await prisma.forumReport.create({
      data: { postId: post.id, authorId: guard.userId, reason: check.reason, comment: check.comment },
    })
  } catch (error) {
    /* Повторная жалоба того же человека — не сбой: она уже в очереди, и
       человеку так и надо сказать. */
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Вы уже пожаловались на это сообщение" }, { status: 409 })
    }
    console.error("Жалоба на форуме:", error)
    return NextResponse.json({ error: "Не удалось отправить жалобу" }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
