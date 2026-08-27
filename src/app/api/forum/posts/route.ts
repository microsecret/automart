import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit"
import { canEditPost, validatePostContent } from "@/lib/forum"
import { isModerator } from "@/lib/permissions"

export const dynamic = "force-dynamic"

/** POST /api/forum/posts — ответить в теме. */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Войдите, чтобы ответить" }, { status: 401 })

  const limit = rateLimit(`forum:post:${session.user.id}`, { windowMs: 10 * 60_000, maxRequests: 20 })
  const ipLimit = rateLimit(`forum:post:ip:${getClientIp(request)}`, { windowMs: 10 * 60_000, maxRequests: 60 })
  if (!limit.success || !ipLimit.success) {
    return NextResponse.json({ error: "Слишком много сообщений подряд. Подождите немного." }, { status: 429, headers: rateLimitHeaders(limit.success ? ipLimit : limit) })
  }

  const body = await request.json().catch(() => null)
  const topicId = typeof body?.topicId === "string" ? body.topicId : ""
  const content = typeof body?.content === "string" ? body.content.trim() : ""

  const contentError = validatePostContent(content)
  if (contentError) return NextResponse.json({ error: contentError }, { status: 400 })

  const topic = await prisma.forumTopic.findFirst({
    where: { id: topicId, deletedAt: null },
    select: { id: true, isClosed: true, sectionId: true },
  })
  if (!topic) return NextResponse.json({ error: "Тема не найдена" }, { status: 404 })
  if (topic.isClosed) return NextResponse.json({ error: "Тема закрыта для ответов" }, { status: 409 })

  const now = new Date()

  /* Сообщение и счётчики — одной транзакцией: расхождение счётчика с
     действительностью заметно сразу, список тем показывает неверный
     порядок и число ответов. */
  const post = await prisma.$transaction(async (tx) => {
    const created = await tx.forumPost.create({
      data: { topicId: topic.id, authorId: session.user.id, content },
      select: { id: true, createdAt: true },
    })
    await tx.forumTopic.update({
      where: { id: topic.id },
      data: { replyCount: { increment: 1 }, lastPostAt: now },
    })
    await tx.forumSection.update({
      where: { id: topic.sectionId },
      data: { postCount: { increment: 1 }, lastPostAt: now },
    })
    /* Счётчик автора в той же сделке, что и остальные: разъедься он с
       действительностью — под именем человека будет одно число, а
       сообщений в базе другое. */
    await tx.user.update({
      where: { id: session.user.id },
      data: { forumPostCount: { increment: 1 } },
    })
    return created
  })

  return NextResponse.json({ post }, { status: 201 })
}

/**
 * PATCH /api/forum/posts — поправить своё сообщение.
 *
 * Без правки опечатку в номере детали или в годе выпуска исправить
 * нечем, а отвечать самому себе «извините, там 2019» — это лишнее
 * сообщение в каждой теме.
 */
export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Требуется вход" }, { status: 401 })

  const limit = rateLimit(`forum:edit:${session.user.id}`, { windowMs: 10 * 60_000, maxRequests: 30 })
  if (!limit.success) {
    return NextResponse.json(
      { error: "Слишком много правок подряд. Подождите немного." },
      { status: 429, headers: rateLimitHeaders(limit) },
    )
  }

  const body = await request.json().catch(() => null)
  const postId = typeof body?.postId === "string" ? body.postId : ""
  const content = typeof body?.content === "string" ? body.content.trim() : ""

  const contentError = validatePostContent(content)
  if (contentError) return NextResponse.json({ error: contentError }, { status: 400 })

  const post = await prisma.forumPost.findUnique({
    where: { id: postId },
    select: {
      id: true,
      authorId: true,
      createdAt: true,
      deletedAt: true,
      topic: { select: { isClosed: true } },
    },
  })
  if (!post) return NextResponse.json({ error: "Сообщение не найдено" }, { status: 404 })

  const permission = canEditPost({
    postAuthorId: post.authorId,
    postCreatedAt: post.createdAt,
    postDeleted: post.deletedAt !== null,
    topicClosed: post.topic.isClosed,
    viewerId: session.user.id,
    viewerIsModerator: isModerator(session.user.role),
  })
  if (!permission.allowed) {
    return NextResponse.json({ error: permission.reason }, { status: 403 })
  }

  /* Метка правки ставится всегда: читатель должен видеть, что текст под
     чужим ответом менялся после того, как ему ответили. */
  const updated = await prisma.forumPost.update({
    where: { id: post.id },
    data: { content, editedAt: new Date() },
    select: { id: true, content: true, editedAt: true },
  })

  return NextResponse.json({ post: updated })
}
