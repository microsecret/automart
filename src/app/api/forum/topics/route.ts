import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit"
import { isTopicPrefix, topicSlug, validatePostContent, validateTopicTitle } from "@/lib/forum"

export const dynamic = "force-dynamic"

/**
 * POST /api/forum/topics — создать тему с первым сообщением.
 *
 * Тема без текста бессмысленна, поэтому создаётся сразу вместе с первым
 * сообщением, одной транзакцией: иначе при сбое остался бы пустой заголовок,
 * на который никто не ответит.
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Войдите, чтобы создать тему" }, { status: 401 })

  /* Тема — дорогое действие: она попадает в списки и в поиск. Ограничение
     жёстче, чем у ответов. */
  const limit = rateLimit(`forum:topic:${session.user.id}`, { windowMs: 60 * 60_000, maxRequests: 5 })
  const ipLimit = rateLimit(`forum:topic:ip:${getClientIp(request)}`, { windowMs: 60 * 60_000, maxRequests: 15 })
  if (!limit.success || !ipLimit.success) {
    return NextResponse.json({ error: "Слишком много новых тем. Попробуйте позже." }, { status: 429, headers: rateLimitHeaders(limit.success ? ipLimit : limit) })
  }

  const body = await request.json().catch(() => null)
  const sectionSlug = typeof body?.section === "string" ? body.section.trim() : ""
  const title = typeof body?.title === "string" ? body.title.trim() : ""
  const content = typeof body?.content === "string" ? body.content.trim() : ""
  /* Метка необязательна: тема без неё нормальна, а принуждение выбрать
     из списка заканчивается тем, что все жмут первый пункт. */
  const prefix = typeof body?.prefix === "string" && isTopicPrefix(body.prefix) ? body.prefix : null

  const titleError = validateTopicTitle(title)
  if (titleError) return NextResponse.json({ error: titleError }, { status: 400 })
  const contentError = validatePostContent(content)
  if (contentError) return NextResponse.json({ error: contentError }, { status: 400 })

  const section = await prisma.forumSection.findUnique({ where: { slug: sectionSlug }, select: { id: true, slug: true } })
  if (!section) return NextResponse.json({ error: "Раздел не найден" }, { status: 404 })

  const now = new Date()
  const slug = topicSlug(title, randomUUID())

  const topic = await prisma.$transaction(async (tx) => {
    const created = await tx.forumTopic.create({
      data: {
        slug,
        title,
        sectionId: section.id,
        authorId: session.user.id,
        lastPostAt: now,
        prefix,
        posts: { create: { authorId: session.user.id, content } },
      },
      select: { id: true, slug: true },
    })

    /* Счётчики раздела — полями: список разделов открывается на каждый
       заход, и COUNT по всем темам был бы самым дорогим запросом страницы. */
    await tx.forumSection.update({
      where: { id: section.id },
      data: { topicCount: { increment: 1 }, postCount: { increment: 1 }, lastPostAt: now },
    })

    /* Первое сообщение темы тоже считается: иначе у автора, который
       только заводит темы и не отвечает в чужих, счётчик остался бы на
       нуле при десятке написанных сообщений. */
    await tx.user.update({
      where: { id: session.user.id },
      data: { forumPostCount: { increment: 1 } },
    })

    return created
  })

  return NextResponse.json({ topic: { ...topic, section: section.slug } }, { status: 201 })
}
