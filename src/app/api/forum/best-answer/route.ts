import { NextRequest, NextResponse } from "next/server"
import { requireUser } from "@/lib/api-session-guard"
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit"
import { toggleBestAnswer } from "@/lib/forum-reputation-store"

export const dynamic = "force-dynamic"

/**
 * POST /api/forum/best-answer — отметить ответ, решивший вопрос.
 *
 * Отмечает автор темы: он единственный знает, что именно помогло.
 * Отметка одна на тему, повтор её снимает.
 */
export async function POST(request: NextRequest) {
  const guard = await requireUser()
  if (guard.denied) return guard.denied

  const limit = rateLimit(`forum:best:${guard.userId}`, { windowMs: 10 * 60_000, maxRequests: 40 })
  const ipLimit = rateLimit(`forum:best:ip:${getClientIp(request)}`, { windowMs: 10 * 60_000, maxRequests: 120 })
  if (!limit.success || !ipLimit.success) {
    return NextResponse.json(
      { error: "Слишком много запросов подряд. Подождите немного." },
      { status: 429, headers: rateLimitHeaders(limit.success ? ipLimit : limit) },
    )
  }

  const body = await request.json().catch(() => null)
  const postId = typeof body?.postId === "string" ? body.postId : ""

  const result = await toggleBestAnswer({ postId, userId: guard.userId })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

  return NextResponse.json({ marked: result.marked })
}
