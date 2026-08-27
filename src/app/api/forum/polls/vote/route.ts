import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireUser } from "@/lib/api-session-guard"
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit"
import { castPollVote } from "@/lib/forum-poll-store"

export const dynamic = "force-dynamic"

/**
 * POST /api/forum/polls/vote — отдать голос.
 *
 * Возвращает свежие цифры: без них клиенту пришлось бы перезапрашивать
 * тему целиком, чтобы показать результат, который он и так только что
 * изменил.
 */
export async function POST(request: NextRequest) {
  const guard = await requireUser()
  if (guard.denied) return guard.denied

  /* Предел щедрый: голосуют по разу в опросе, и упереться в него можно
     только перебором чужих опросов. */
  const limit = rateLimit(`forum:vote:${guard.userId}`, { windowMs: 10 * 60_000, maxRequests: 60 })
  const ipLimit = rateLimit(`forum:vote:ip:${getClientIp(request)}`, { windowMs: 10 * 60_000, maxRequests: 200 })
  if (!limit.success || !ipLimit.success) {
    return NextResponse.json(
      { error: "Слишком много запросов подряд. Подождите немного." },
      { status: 429, headers: rateLimitHeaders(limit.success ? ipLimit : limit) },
    )
  }

  const body = await request.json().catch(() => null)
  const pollId = typeof body?.pollId === "string" ? body.pollId : ""
  const optionIds = Array.isArray(body?.optionIds)
    ? body.optionIds.filter((id: unknown): id is string => typeof id === "string")
    : []

  const result = await castPollVote({ pollId, optionIds, userId: guard.userId })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

  const options = await prisma.forumPollOption.findMany({
    where: { pollId },
    select: { id: true, text: true, votes: true },
    orderBy: { position: "asc" },
  })

  return NextResponse.json({ options, voted: optionIds })
}
