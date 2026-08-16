import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin, normalizeUserRole, USER_ROLE } from "@/lib/permissions"

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
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || !isAdmin(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { id } = await params
    const payload = await request.json().catch(() => null)
    const role = typeof payload?.role === "string" ? payload.role : ""
    if (!id || !ASSIGNABLE_ROLES.has(role)) return NextResponse.json({ error: "Некорректная роль" }, { status: 400 })
    if (id === session.user.id) return NextResponse.json({ error: "Нельзя изменить собственную роль из этой панели" }, { status: 409 })

    const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true, name: true, email: true } })
    if (!target) return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 })

    const currentRole = normalizeUserRole(target.role)
    if (currentRole === USER_ROLE.ADMIN && role !== USER_ROLE.ADMIN) {
      const admins = await prisma.user.count({ where: { role: USER_ROLE.ADMIN } })
      if (admins <= 1) return NextResponse.json({ error: "Нельзя понизить последнего администратора" }, { status: 409 })
    }

    const user = await prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, name: true, email: true, role: true, updatedAt: true },
    })

    return NextResponse.json({ user })
  } catch (error) {
    console.error("Admin role update error:", error)
    return NextResponse.json({ error: "Не удалось изменить роль" }, { status: 500 })
  }
}
