import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireModeratorSession, runAdminRoute } from "@/lib/admin-route-guard"

export const dynamic = "force-dynamic"

const PER_PAGE = 30

/**
 * GET /api/admin/forum-reports — очередь жалоб.
 *
 * Неразобранные первыми: разобранные нужны редко, и держать их вперемешку
 * значит заставлять модератора искать работу глазами.
 */
export async function GET(request: NextRequest) {
  const guard = await requireModeratorSession()
  if (guard.denied) return guard.denied

  return runAdminRoute("Очередь жалоб форума", async () => {
    const resolved = request.nextUrl.searchParams.get("resolved") === "true"
    const page = Math.max(1, Math.min(100, Number.parseInt(request.nextUrl.searchParams.get("page") || "1", 10) || 1))

    const where = resolved ? { resolvedAt: { not: null } } : { resolvedAt: null }

    const [reports, total, pending] = await Promise.all([
      prisma.forumReport.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PER_PAGE,
        take: PER_PAGE,
        select: {
          id: true,
          reason: true,
          comment: true,
          createdAt: true,
          resolvedAt: true,
          author: { select: { name: true } },
          post: {
            select: {
              id: true,
              content: true,
              deletedAt: true,
              createdAt: true,
              author: { select: { id: true, name: true } },
              topic: { select: { title: true, slug: true, section: { select: { slug: true } } } },
            },
          },
        },
      }),
      prisma.forumReport.count({ where }),
      /* Счётчик неразобранных отдаётся всегда: по нему видно, есть ли
         работа, не переключая вкладку. */
      prisma.forumReport.count({ where: { resolvedAt: null } }),
    ])

    return NextResponse.json({
      reports,
      total,
      pending,
      pages: Math.max(1, Math.ceil(total / PER_PAGE)),
    })
  })
}

/**
 * PATCH /api/admin/forum-reports — разобрать жалобу.
 *
 * Действия: пометить разобранной, удалить сообщение, вернуть удалённое.
 * Удаление мягкое — на месте сообщения остаётся пометка, иначе ответы на
 * него теряют смысл.
 */
export async function PATCH(request: NextRequest) {
  const guard = await requireModeratorSession()
  if (guard.denied) return guard.denied

  return runAdminRoute("Разбор жалобы форума", async () => {
    const body = await request.json().catch(() => null)
    const reportId = typeof body?.reportId === "string" ? body.reportId : ""
    const action = typeof body?.action === "string" ? body.action : ""

    const report = await prisma.forumReport.findUnique({
      where: { id: reportId },
      select: { id: true, postId: true, post: { select: { deletedAt: true, authorId: true } } },
    })
    if (!report) return NextResponse.json({ error: "Жалоба не найдена" }, { status: 404 })

    if (action === "resolve") {
      await prisma.forumReport.update({ where: { id: report.id }, data: { resolvedAt: new Date() } })
      return NextResponse.json({ ok: true })
    }

    if (action === "reopen") {
      await prisma.forumReport.update({ where: { id: report.id }, data: { resolvedAt: null } })
      return NextResponse.json({ ok: true })
    }

    if (action === "delete-post") {
      /* Удаление и разбор одной сделкой: жалоба, оставшаяся открытой при
         удалённом сообщении, вернётся в очередь второй раз. */
      await prisma.$transaction([
        prisma.forumPost.update({ where: { id: report.postId }, data: { deletedAt: new Date() } }),
        prisma.forumReport.update({ where: { id: report.id }, data: { resolvedAt: new Date() } }),
        /* Счётчик автора уменьшается: удалённое сообщение не должно
           продолжать работать на его репутацию. */
        prisma.user.update({
          where: { id: report.post.authorId },
          data: { forumPostCount: { decrement: 1 } },
        }),
      ])
      return NextResponse.json({ ok: true })
    }

    if (action === "restore-post") {
      await prisma.$transaction([
        prisma.forumPost.update({ where: { id: report.postId }, data: { deletedAt: null } }),
        prisma.user.update({
          where: { id: report.post.authorId },
          data: { forumPostCount: { increment: 1 } },
        }),
      ])
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 })
  })
}
