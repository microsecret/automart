import { NextRequest, NextResponse } from "next/server"
import { requireUser } from "@/lib/api-session-guard"
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit"
import { toggleSubscription } from "@/lib/forum-subscriptions"

export const dynamic = "force-dynamic"

/**
 * POST /api/forum/subscriptions — подписаться на тему или отписаться.
 *
 * Человек спросил и ушёл: без уведомления он не узнает, что ответили, и
 * вернётся разве что случайно.
 */
export async function POST(request: NextRequest) {
  const guard = await requireUser()
  if (guard.denied) return guard.denied

  const limit = rateLimit(`forum:subscribe:${guard.userId}`, { windowMs: 10 * 60_000, maxRequests: 60 })
  const ipLimit = rateLimit(`forum:subscribe:ip:${getClientIp(request)}`, { windowMs: 10 * 60_000, maxRequests: 200 })
  if (!limit.success || !ipLimit.success) {
    return NextResponse.json(
      { error: "Слишком много запросов подряд. Подождите немного." },
      { status: 429, headers: rateLimitHeaders(limit.success ? ipLimit : limit) },
    )
  }

  const body = await request.json().catch(() => null)
  const topicId = typeof body?.topicId === "string" ? body.topicId : ""

  const result = await toggleSubscription({ topicId, userId: guard.userId })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

  return NextResponse.json({ subscribed: result.subscribed })
}
