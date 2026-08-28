import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireModeratorSession, runAdminRoute } from "@/lib/admin-route-guard"

export const dynamic = "force-dynamic"

/**
 * PATCH /api/admin/forum-topics — модерация темы.
 *
 * Закрепление, закрытие и перенос в другой раздел. Перенос нужен чаще
 * прочего: на форуме о машинах постоянно пишут не туда — вопрос про
 * растаможку в разделе марки, объявление о продаже в разделе ремонта.
 */
export async function PATCH(request: NextRequest) {
  const guard = await requireModeratorSession()
  if (guard.denied) return guard.denied

  return runAdminRoute("Модерация темы форума", async () => {
    const body = await request.json().catch(() => null)
    const topicId = typeof body?.topicId === "string" ? body.topicId : ""
    const action = typeof body?.action === "string" ? body.action : ""

    const topic = await prisma.forumTopic.findFirst({
      where: { id: topicId, deletedAt: null },
      select: { id: true, sectionId: true, isPinned: true, isClosed: true },
    })
    if (!topic) return NextResponse.json({ error: "Тема не найдена" }, { status: 404 })

    if (action === "pin" || action === "unpin") {
      await prisma.forumTopic.update({
        where: { id: topic.id },
        data: { isPinned: action === "pin" },
      })
      return NextResponse.json({ ok: true, isPinned: action === "pin" })
    }

    if (action === "close" || action === "open") {
      await prisma.forumTopic.update({
        where: { id: topic.id },
        data: { isClosed: action === "close" },
      })
      return NextResponse.json({ ok: true, isClosed: action === "close" })
    }

    if (action === "move") {
      const targetSlug = typeof body?.sectionSlug === "string" ? body.sectionSlug.trim() : ""
      const target = await prisma.forumSection.findUnique({
        where: { slug: targetSlug },
        select: { id: true, slug: true },
      })
      if (!target) return NextResponse.json({ error: "Раздел не найден" }, { status: 404 })
      if (target.id === topic.sectionId) {
        return NextResponse.json({ error: "Тема уже в этом разделе" }, { status: 400 })
      }

      /* Сообщения считаются до сделки: счётчик сообщений раздела должен
         переехать вместе с темой, а у темы их может быть сотня. */
      const postCount = await prisma.forumPost.count({ where: { topicId: topic.id } })

      /* Перенос и оба счётчика — одной сделкой: разъедься они, и в списке
         разделов будет «12 тем» там, где их одиннадцать, а восстановить
         правду можно только полным пересчётом по всей базе. */
      const [moved] = await prisma.$transaction([
        prisma.forumTopic.update({
          where: { id: topic.id },
          data: { sectionId: target.id },
          select: { id: true, slug: true },
        }),
        prisma.forumSection.update({
          where: { id: topic.sectionId },
          data: { topicCount: { decrement: 1 }, postCount: { decrement: postCount } },
        }),
        prisma.forumSection.update({
          where: { id: target.id },
          data: { topicCount: { increment: 1 }, postCount: { increment: postCount } },
        }),
      ])

      return NextResponse.json({ ok: true, slug: moved.slug, sectionSlug: target.slug })
    }

    return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 })
  })
}
