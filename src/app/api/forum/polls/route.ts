import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireUser } from "@/lib/api-session-guard"
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit"
import { validatePollDraft } from "@/lib/forum-poll"

export const dynamic = "force-dynamic"

/**
 * POST /api/forum/polls — добавить опрос к своей теме.
 *
 * Опрос заводит автор темы и только он: возможность приложить
 * голосование к чужому обсуждению — это способ увести разговор в сторону
 * чужими руками.
 */
export async function POST(request: NextRequest) {
  const guard = await requireUser()
  if (guard.denied) return guard.denied

  const limit = rateLimit(`forum:poll:${guard.userId}`, { windowMs: 60 * 60_000, maxRequests: 10 })
  const ipLimit = rateLimit(`forum:poll:ip:${getClientIp(request)}`, { windowMs: 60 * 60_000, maxRequests: 30 })
  if (!limit.success || !ipLimit.success) {
    return NextResponse.json(
      { error: "Слишком много опросов подряд. Подождите немного." },
      { status: 429, headers: rateLimitHeaders(limit.success ? ipLimit : limit) },
    )
  }

  const body = await request.json().catch(() => null)
  const topicId = typeof body?.topicId === "string" ? body.topicId : ""
  const rawOptions = Array.isArray(body?.options) ? body.options : []

  const draft = validatePollDraft({
    question: typeof body?.question === "string" ? body.question : "",
    options: rawOptions.filter((option: unknown): option is string => typeof option === "string"),
    multiple: body?.multiple === true,
    closesInDays: typeof body?.closesInDays === "number" ? body.closesInDays : null,
  })
  if (!draft.ok) return NextResponse.json({ error: draft.error }, { status: 400 })

  const topic = await prisma.forumTopic.findFirst({
    where: { id: topicId, deletedAt: null },
    select: { id: true, authorId: true, isClosed: true, poll: { select: { id: true } } },
  })
  if (!topic) return NextResponse.json({ error: "Тема не найдена" }, { status: 404 })
  if (topic.authorId !== guard.userId) {
    return NextResponse.json({ error: "Опрос добавляет автор темы" }, { status: 403 })
  }
  if (topic.isClosed) return NextResponse.json({ error: "Тема закрыта" }, { status: 409 })
  if (topic.poll) return NextResponse.json({ error: "В теме уже есть опрос" }, { status: 409 })

  const poll = await prisma.forumPoll.create({
    data: {
      topicId: topic.id,
      question: draft.question,
      multiple: draft.multiple,
      closesAt: draft.closesAt,
      /* Порядок вариантов задаётся явно: без него база вольна вернуть их
         как угодно, и опрос при каждом обновлении страницы выглядит
         перетасованным. */
      options: {
        create: draft.options.map((text, index) => ({ text, position: index })),
      },
    },
    select: {
      id: true,
      question: true,
      multiple: true,
      closesAt: true,
      options: { select: { id: true, text: true, votes: true }, orderBy: { position: "asc" } },
    },
  })

  return NextResponse.json({ poll })
}
