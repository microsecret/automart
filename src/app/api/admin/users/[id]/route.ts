import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getTelegramMiniAppUrl, telegramApi } from "@/lib/telegram"
import { isAdmin, normalizeUserRole, USER_ROLE } from "@/lib/permissions"
import { adminAuditValueLabel, recordAdminAudit } from "@/lib/admin-audit"

export const dynamic = "force-dynamic"

const ACCOUNT_STATUSES = new Set(["ACTIVE", "RESTRICTED", "BANNED"])
const ASSIGNABLE_ROLES = new Set(Object.values(USER_ROLE))

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  return session?.user?.id && isAdmin(session.user.role) ? session : null
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: "Доступ только для администраторов" }, { status: 403 })
  const { id } = await params
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true, name: true, email: true, phone: true, image: true, role: true,
      telegramId: true, telegramUsername: true, telegramVerifiedAt: true,
      emailVerified: true, accountStatus: true, restrictionReason: true,
      statusUpdatedAt: true, createdAt: true, updatedAt: true,
      listings: {
        where: { deletedAt: null },
        orderBy: { updatedAt: "desc" },
        take: 12,
        select: { id: true, title: true, price: true, status: true, updatedAt: true },
      },
      _count: { select: { listings: true, messagesSent: true, notifications: true, deliveryOrdersAsBuyer: true } },
    },
  })
  if (!user) return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 })
  return NextResponse.json({ user })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: "Доступ только для администраторов" }, { status: 403 })
  const { id } = await params
  if (id === session.user.id) return NextResponse.json({ error: "Нельзя менять собственные права или статус" }, { status: 409 })

  const payload = await request.json().catch(() => null)
  const role = typeof payload?.role === "string" ? payload.role : ""
  const accountStatus = typeof payload?.accountStatus === "string" ? payload.accountStatus : ""
  const restrictionReason = typeof payload?.restrictionReason === "string" ? payload.restrictionReason.trim().replace(/\s+/g, " ") : ""
  if (!ASSIGNABLE_ROLES.has(role) || !ACCOUNT_STATUSES.has(accountStatus)) {
    return NextResponse.json({ error: "Некорректная роль или статус" }, { status: 400 })
  }
  if (restrictionReason.length > 500) return NextResponse.json({ error: "Причина не должна превышать 500 символов" }, { status: 400 })
  if (accountStatus !== "ACTIVE" && restrictionReason.length < 3) {
    return NextResponse.json({ error: "Укажите причину ограничения" }, { status: 400 })
  }

  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true, accountStatus: true } })
  if (!target) return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 })
  if (normalizeUserRole(target.role) === USER_ROLE.ADMIN && (role !== USER_ROLE.ADMIN || accountStatus !== "ACTIVE")) {
    const admins = await prisma.user.count({ where: { role: USER_ROLE.ADMIN, accountStatus: "ACTIVE" } })
    if (admins <= 1) return NextResponse.json({ error: "Нельзя ограничить или понизить последнего активного администратора" }, { status: 409 })
  }

  const statusChanged = target.accountStatus !== accountStatus
  const user = await prisma.user.update({
    where: { id },
    data: {
      role,
      accountStatus,
      restrictionReason: accountStatus === "ACTIVE" ? null : restrictionReason,
      statusUpdatedAt: statusChanged ? new Date() : undefined,
    },
    select: { id: true, role: true, accountStatus: true, restrictionReason: true, statusUpdatedAt: true },
  })
  const roleChanged = normalizeUserRole(target.role) !== role
  if (roleChanged || statusChanged) {
    await recordAdminAudit({
      actorId: session.user.id,
      actorEmail: session.user.email,
      action: statusChanged ? "USER_STATUS_CHANGE" : "USER_ROLE_CHANGE",
      entityType: "User",
      entityId: id,
      summary: [
        roleChanged ? `роль «${adminAuditValueLabel(normalizeUserRole(target.role))}» → «${adminAuditValueLabel(role)}»` : null,
        statusChanged ? `статус «${adminAuditValueLabel(target.accountStatus)}» → «${adminAuditValueLabel(accountStatus)}»` : null,
        accountStatus !== "ACTIVE" && restrictionReason ? `причина: ${restrictionReason}` : null,
      ].filter(Boolean).join("; "),
      metadata: {
        previousRole: normalizeUserRole(target.role),
        nextRole: role,
        previousStatus: target.accountStatus,
        nextStatus: accountStatus,
        restrictionReason: accountStatus === "ACTIVE" ? null : restrictionReason,
      },
    })
  }
  return NextResponse.json({ user })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: "Доступ только для администраторов" }, { status: 403 })
  const { id } = await params
  const payload = await request.json().catch(() => null)
  const title = typeof payload?.title === "string" ? payload.title.trim().replace(/\s+/g, " ") : ""
  const content = typeof payload?.content === "string" ? payload.content.trim() : ""
  const deliverTelegram = payload?.deliverTelegram !== false
  if (title.length < 3 || title.length > 100 || content.length < 3 || content.length > 1500) {
    return NextResponse.json({ error: "Проверьте заголовок и текст уведомления" }, { status: 400 })
  }

  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, telegramId: true, telegramVerifiedAt: true } })
  if (!target) return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 })
  const notification = await prisma.notification.create({
    data: { userId: id, title, content, type: "INFO", relatedType: "ADMIN_MESSAGE", relatedId: session.user.id },
  })

  let telegramDelivered = false
  if (deliverTelegram && target.telegramId && target.telegramVerifiedAt) {
    const miniAppUrl = getTelegramMiniAppUrl()
    try {
      await telegramApi("sendMessage", {
        chat_id: target.telegramId,
        text: `📣 <b>${title.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</b>\n\n${content.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}`,
        parse_mode: "HTML",
        reply_markup: miniAppUrl ? { inline_keyboard: [[{ text: "Открыть LeWheel", web_app: { url: miniAppUrl } }]] } : undefined,
      })
      telegramDelivered = true
    } catch (error) {
      console.warn("Admin Telegram notification was not delivered", error instanceof Error ? error.message : error)
    }
  }

  await recordAdminAudit({
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "USER_NOTIFICATION_SEND",
    entityType: "User",
    entityId: id,
    summary: `Пользователю отправлено персональное уведомление${telegramDelivered ? " с доставкой в Telegram" : ""}`,
    metadata: { notificationId: notification.id, telegramRequested: deliverTelegram, telegramDelivered },
  })

  return NextResponse.json({ notification, telegramDelivered })
}
