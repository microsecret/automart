import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { asTrimmedString, canReadDeliveryOrder } from "@/lib/delivery-access"
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit"
import { moderateProtectedDealMessage } from "@/lib/contact-sharing-moderation"
import { moderationAuditSummary } from "@/lib/contact-sharing-policy"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const userLimit = rateLimit(`delivery:message:user:${session.user.id}`, { windowMs: 60_000, maxRequests: 30 })
    const ipLimit = rateLimit(`delivery:message:ip:${getClientIp(request)}`, { windowMs: 60_000, maxRequests: 60 })
    if (!userLimit.success || !ipLimit.success) {
      const limit = !userLimit.success ? userLimit : ipLimit
      return NextResponse.json(
        { error: "Слишком много сообщений. Попробуйте через минуту." },
        { status: 429, headers: rateLimitHeaders(limit) },
      )
    }
    const order = await prisma.deliveryOrder.findUnique({ where: { id }, select: { id: true, buyerId: true, partnerId: true, managerId: true } })
    if (!order) return NextResponse.json({ error: "Сделка не найдена" }, { status: 404 })
    if (!canReadDeliveryOrder(session, order)) return NextResponse.json({ error: "Нет доступа к чату сделки" }, { status: 403 })

    const body = await request.json()
    const content = asTrimmedString(body.content, 3000)
    if (!content) return NextResponse.json({ error: "Введите сообщение" }, { status: 400 })

    const moderation = await moderateProtectedDealMessage(content)
    if (!moderation.allowed) {
      await prisma.communicationModerationEvent.create({
        data: {
          deliveryOrderId: order.id,
          senderId: session.user.id,
          decision: "BLOCKED",
          reasonCodes: JSON.stringify(moderation.reasonCodes),
          redactedPreview: moderationAuditSummary(content),
          provider: moderation.provider,
        },
      })
      return NextResponse.json(
        { error: moderation.message || "Сообщение содержит внешний контакт и не было отправлено.", code: "CONTACT_SHARING_BLOCKED" },
        { status: 422 },
      )
    }

    const message = await prisma.deliveryMessage.create({
      data: { deliveryOrderId: order.id, senderId: session.user.id, content },
      include: { sender: { select: { id: true, name: true, image: true } } },
    })
    return NextResponse.json({ message }, { status: 201 })
  } catch (error) {
    console.error("Delivery message POST error:", error)
    return NextResponse.json({ error: "Не удалось отправить сообщение" }, { status: 500 })
  }
}
