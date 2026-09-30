import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminSession } from "@/lib/admin-route-guard"
import { recordAdminAudit } from "@/lib/admin-audit"

export const dynamic = "force-dynamic"

/**
 * Переписка целиком — для разбора жалобы или подозрения на мошенничество.
 *
 * Обычный маршрут сообщений отдаёт только собственные диалоги, и у
 * администратора не было способа увидеть, что продавец писал покупателю.
 * Каждый просмотр записывается в журнал действий: чужая переписка —
 * чувствительные данные, и след должен оставаться.
 */
export async function GET(request: NextRequest) {
  const guard = await requireAdminSession()
  if (guard.denied) return guard.denied

  const conversationId = (request.nextUrl.searchParams.get("id") || "").slice(0, 200)
  if (!conversationId) return NextResponse.json({ error: "Не указан диалог" }, { status: 400 })

  /* Обращение в поддержку и чат доставки — тем же видом, что переписка:
     администратор читает любой диалог площадки из одной ленты. */
  const type = request.nextUrl.searchParams.get("type") || "message"
  if (type === "support" || type === "delivery") {
    const thread = type === "support"
      ? await prisma.supportTicket.findUnique({
          where: { id: conversationId },
          select: {
            subject: true, guestName: true, user: { select: { name: true, email: true } },
            messages: { orderBy: { createdAt: "asc" }, take: 500, select: { id: true, content: true, createdAt: true, authorType: true, authorUserId: true, authorUser: { select: { id: true, name: true, email: true } } } },
          },
        }).then((ticket) => ticket && {
          title: ticket.subject,
          messages: ticket.messages.map((message) => ({
            id: message.id, content: message.content, createdAt: message.createdAt,
            senderId: message.authorType === "OPERATOR" || message.authorType === "AI" ? "staff" : "visitor",
            sender: message.authorUser || { id: "", name: message.authorType === "AI" ? "Помощник" : message.authorType === "OPERATOR" ? "Оператор" : ticket.user?.name || ticket.guestName || "Гость", email: null },
            _count: { attachments: 0 },
          })),
        })
      : await prisma.deliveryOrder.findUnique({
          where: { id: conversationId },
          select: {
            code: true, title: true,
            messages: { orderBy: { createdAt: "asc" }, take: 500, select: { id: true, content: true, createdAt: true, senderId: true, isSystem: true, sender: { select: { id: true, name: true, email: true } } } },
          },
        }).then((order) => order && {
          title: `${order.code} · ${order.title}`,
          messages: order.messages.map((message) => ({
            id: message.id, content: message.content, createdAt: message.createdAt, senderId: message.senderId,
            sender: message.isSystem ? { id: "", name: "Система", email: null } : message.sender,
            _count: { attachments: 0 },
          })),
        })
    if (!thread) return NextResponse.json({ error: "Диалог не найден" }, { status: 404 })
    await recordAdminAudit({
      actorId: guard.session.user?.id || null,
      actorEmail: guard.session.user?.email || null,
      action: "CONVERSATION_VIEW",
      entityType: type === "support" ? "SupportTicket" : "DeliveryOrder",
      entityId: conversationId,
      summary: `Просмотр: ${thread.title}`,
      metadata: { messages: thread.messages.length },
    })
    return NextResponse.json({ conversationId, listing: { id: conversationId, title: thread.title }, messages: thread.messages })
  }

  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    take: 500,
    select: {
      id: true, content: true, createdAt: true, isRead: true, senderId: true,
      sender: { select: { id: true, name: true, email: true } },
      receiver: { select: { id: true, name: true, email: true } },
      listing: { select: { id: true, title: true } },
      _count: { select: { attachments: true } },
    },
  })
  if (!messages.length) return NextResponse.json({ error: "Диалог не найден" }, { status: 404 })

  const first = messages[0]
  await recordAdminAudit({
    actorId: guard.session.user?.id || null,
    actorEmail: guard.session.user?.email || null,
    action: "CONVERSATION_VIEW",
    entityType: "Conversation",
    entityId: conversationId,
    summary: `Просмотр переписки: ${first.sender.name || first.sender.email} — ${first.receiver.name || first.receiver.email}`,
    metadata: { messages: messages.length },
  })

  return NextResponse.json({ conversationId, listing: first.listing, messages })
}
