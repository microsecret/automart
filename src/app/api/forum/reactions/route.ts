import { NextRequest, NextResponse } from "next/server"
import { requireUser } from "@/lib/api-session-guard"
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit"
import { toggleReaction } from "@/lib/forum-reputation-store"

export const dynamic = "force-dynamic"

/**
 * POST /api/forum/reactions — поставить или снять реакцию.
 *
 * Повторное нажатие снимает: это единственное поведение, которое человек
 * ожидает от значка, который уже подсвечен.
 */
export async function POST(request: NextRequest) {
  const guard = await requireUser()
  if (guard.denied) return guard.denied

  /* Предел выше, чем у сообщений: нажать реакцию быстрее, чем написать
     ответ, и читатель темы проходит по ней сверху вниз. */
  const limit = rateLimit(`forum:reaction:${guard.userId}`, { windowMs: 10 * 60_000, maxRequests: 120 })
  const ipLimit = rateLimit(`forum:reaction:ip:${getClientIp(request)}`, { windowMs: 10 * 60_000, maxRequests: 300 })
  if (!limit.success || !ipLimit.success) {
    return NextResponse.json(
      { error: "Слишком много запросов подряд. Подождите немного." },
      { status: 429, headers: rateLimitHeaders(limit.success ? ipLimit : limit) },
    )
  }

  const body = await request.json().catch(() => null)
  const postId = typeof body?.postId === "string" ? body.postId : ""
  const kind = typeof body?.kind === "string" ? body.kind : ""

  const result = await toggleReaction({ postId, userId: guard.userId, kind })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

  return NextResponse.json({ reacted: result.reacted, reactionCount: result.reactionCount })
}
