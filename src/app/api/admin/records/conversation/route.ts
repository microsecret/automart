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
