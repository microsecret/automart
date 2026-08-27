import { NextRequest, NextResponse } from "next/server"
import { requireAdminSession } from "@/lib/admin-route-guard"
import { prisma } from "@/lib/prisma"
import { normalizeUserRole, USER_ROLE } from "@/lib/permissions"
import { adminAuditValueLabel, recordAdminAudit } from "@/lib/admin-audit"

export const dynamic = "force-dynamic"

const ASSIGNABLE_ROLES = new Set<string>([
  USER_ROLE.USER,
  USER_ROLE.VERIFIED_USER,
  USER_ROLE.PARTNER,
  USER_ROLE.MODERATOR,
  USER_ROLE.ADMIN,
])

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireAdminSession()
    if (guard.denied) return guard.denied
    const session = guard.session

    const { id } = await params
    const payload = await request.json().catch(() => null)
    const role = typeof payload?.role === "string" ? payload.role : ""
    if (!id || !ASSIGNABLE_ROLES.has(role)) return NextResponse.json({ error: "Некорректная роль" }, { status: 400 })
    if (id === session.user.id) return NextResponse.json({ error: "Нельзя изменить собственную роль из этой панели" }, { status: 409 })

    const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true, name: true, email: true } })
    if (!target) return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 })

    const currentRole = normalizeUserRole(target.role)
    if (currentRole === USER_ROLE.ADMIN && role !== USER_ROLE.ADMIN) {
      const admins = await prisma.user.count({ where: { role: USER_ROLE.ADMIN, accountStatus: "ACTIVE" } })
      if (admins <= 1) return NextResponse.json({ error: "Нельзя понизить последнего администратора" }, { status: 409 })
    }

    const user = await prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, name: true, email: true, role: true, updatedAt: true },
    })

    await recordAdminAudit({
      actorId: session.user.id,
      actorEmail: session.user.email,
      action: "USER_ROLE_CHANGE",
      entityType: "User",
      entityId: id,
      summary: `Роль пользователя ${target.email || target.name || id} изменена: «${adminAuditValueLabel(currentRole)}» → «${adminAuditValueLabel(role)}»`,
      metadata: { previousRole: currentRole, nextRole: role },
    })

    return NextResponse.json({ user })
  } catch (error) {
    console.error("Admin role update error:", error)
    return NextResponse.json({ error: "Не удалось изменить роль" }, { status: 500 })
  }
}
