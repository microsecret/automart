import { NextRequest, NextResponse } from "next/server"
import { requireAdminSession } from "@/lib/admin-route-guard"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

const PAGE_SIZE = 30

/** Возвращает журнал решений администраторов. Только чтение: журнал не правится. */
export async function GET(request: NextRequest) {
  const guard = await requireAdminSession()
  if (guard.denied) return guard.denied

  const action = request.nextUrl.searchParams.get("action")?.trim().slice(0, 60) || ""
  const entityType = request.nextUrl.searchParams.get("entityType")?.trim().slice(0, 40) || ""
  const query = request.nextUrl.searchParams.get("q")?.trim().replace(/\s+/g, " ").slice(0, 80) || ""
  const cursor = request.nextUrl.searchParams.get("cursor")?.trim().slice(0, 64) || ""
  if (cursor) {
    const cursorExists = await prisma.adminAuditEvent.findUnique({ where: { id: cursor }, select: { id: true } })
    if (!cursorExists) return NextResponse.json({ error: "Страница журнала устарела. Обновите список." }, { status: 400 })
  }

  const events = await prisma.adminAuditEvent.findMany({
    where: {
      ...(action ? { action } : {}),
      ...(entityType ? { entityType } : {}),
      ...(query
        ? {
            OR: [
              { summary: { contains: query } },
              { actorEmail: { contains: query } },
              { entityId: { contains: query } },
              { actor: { is: { OR: [{ name: { contains: query } }, { email: { contains: query } }] } } },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      action: true,
      entityType: true,
      entityId: true,
      summary: true,
      actorEmail: true,
      createdAt: true,
      actor: { select: { id: true, name: true, email: true } },
    },
  })

  const hasMore = events.length > PAGE_SIZE
  const page = hasMore ? events.slice(0, PAGE_SIZE) : events

  return NextResponse.json({
    events: page,
    nextCursor: hasMore ? page.at(-1)?.id || null : null,
  })
}
