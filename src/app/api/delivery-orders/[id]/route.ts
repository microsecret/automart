import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { asTrimmedString, canManageDeliveryOrder, canReadDeliveryOrder, deliveryOrderPermissions, getDeliveryOrder, isDeliveryAdmin, parseDeliveryDate, safeDealDisplayName } from "@/lib/delivery-access"

export const dynamic = "force-dynamic"

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const order = await getDeliveryOrder(id)
    if (!order) return NextResponse.json({ error: "Сделка не найдена" }, { status: 404 })
    if (!canReadDeliveryOrder(session, order)) return NextResponse.json({ error: "Нет доступа к этой сделке" }, { status: 403 })

    const permissions = deliveryOrderPermissions(session, order)
    const canSeeInternal = permissions.canManage || permissions.isAdmin
    const visibleDocuments = order.documents
      .filter((document) => canSeeInternal || document.visibility === "BUYER_AND_TEAM")
      .map(({ storageKey: _storageKey, ...document }) => ({
        ...document,
        uploadedBy: permissions.isAdmin
          ? document.uploadedBy
          : { ...document.uploadedBy, name: safeDealDisplayName(document.uploadedBy.name, "Участник сделки") },
        downloadUrl: `/api/delivery-orders/${order.id}/documents/${document.id}`,
      }))

    const publicOrder = permissions.isAdmin ? order : {
      ...order,
      buyer: { ...order.buyer, name: safeDealDisplayName(order.buyer.name, "Покупатель") },
      partner: order.partner ? { ...order.partner, name: safeDealDisplayName(order.partner.name, "Партнёр") } : null,
      manager: order.manager ? { ...order.manager, name: safeDealDisplayName(order.manager.name, "Менеджер LeWheel") } : null,
      events: order.events.map((event) => ({
        ...event,
        author: event.author ? { ...event.author, name: safeDealDisplayName(event.author.name, "Участник сделки") } : null,
      })),
      messages: order.messages.map((message) => ({
        ...message,
        sender: { ...message.sender, name: safeDealDisplayName(message.sender.name, message.isSystem ? "LeWheel" : "Участник сделки") },
      })),
    }

    return NextResponse.json({
      order: {
        ...publicOrder,
        events: publicOrder.events.filter((event) => canSeeInternal || event.isVisibleToBuyer),
        documents: visibleDocuments,
      },
      permissions,
    })
  } catch (error) {
    console.error("Delivery order detail GET error:", error)
    return NextResponse.json({ error: "Не удалось загрузить сделку" }, { status: 500 })
  }
}

/** PATCH /api/delivery-orders/[id] — назначение и следующий шаг; статус меняется через подтверждённое событие. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const order = await prisma.deliveryOrder.findUnique({
      where: { id },
      select: { id: true, buyerId: true, partnerId: true, managerId: true },
    })
    if (!order) return NextResponse.json({ error: "Сделка не найдена" }, { status: 404 })
    if (!canManageDeliveryOrder(session, order)) return NextResponse.json({ error: "Только назначенный партнёр или менеджер может изменить сделку" }, { status: 403 })

    const body = await request.json()
    const data: Record<string, unknown> = {}

    if ("nextAction" in body) data.nextAction = asTrimmedString(body.nextAction, 300) || null
    if ("nextActionAt" in body) data.nextActionAt = parseDeliveryDate(body.nextActionAt)
    if ("estimatedDeliveryAt" in body) data.estimatedDeliveryAt = parseDeliveryDate(body.estimatedDeliveryAt)
    if ("originCheckpoint" in body) data.originCheckpoint = asTrimmedString(body.originCheckpoint, 120) || null
    if ("transitCity" in body) data.transitCity = asTrimmedString(body.transitCity, 120) || null

    if (isDeliveryAdmin(session)) {
      if ("partnerId" in body) {
        const partnerId = asTrimmedString(body.partnerId, 80) || null
        if (partnerId) {
          const verifiedPartner = await prisma.deliveryOrganization.findFirst({
            where: { ownerId: partnerId, verificationStatus: "VERIFIED" },
            select: { id: true },
          })
          if (!verifiedPartner) return NextResponse.json({ error: "Можно назначить только проверенного партнёра" }, { status: 409 })
        }
        data.partnerId = partnerId
      }
      if ("managerId" in body) data.managerId = asTrimmedString(body.managerId, 80) || null
    }

    const updated = await prisma.deliveryOrder.update({ where: { id }, data, select: { id: true, updatedAt: true } })
    return NextResponse.json({ order: updated })
  } catch (error) {
    console.error("Delivery order PATCH error:", error)
    return NextResponse.json({ error: "Не удалось обновить сделку" }, { status: 500 })
  }
}
