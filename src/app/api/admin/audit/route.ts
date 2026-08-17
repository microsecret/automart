import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { isAdmin } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

const PAGE_SIZE = 40

/** Возвращает журнал решений администраторов. Только чтение: журнал не правится. */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Доступ только для администраторов" }, { status: 403 })
  }

  const action = request.nextUrl.searchParams.get("action")?.trim().slice(0, 60) || ""
  const entityType = request.nextUrl.searchParams.get("entityType")?.trim().slice(0, 40) || ""

  const events = await prisma.adminAuditEvent.findMany({
    where: {
      ...(action ? { action } : {}),
      ...(entityType ? { entityType } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE,
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

  return NextResponse.json({ events })
}
