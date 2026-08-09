import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { asTrimmedString, canManageDeliveryOrder, isDeliveryAdmin, parseDeliveryDate } from "@/lib/delivery-access"
import { canTransitionDeliveryStatus, DELIVERY_STATUS_META, isDeliveryStatus } from "@/lib/delivery"

export const dynamic = "force-dynamic"
const STATE_CONFLICT = "DELIVERY_STATE_CONFLICT"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const order = await prisma.deliveryOrder.findUnique({ where: { id }, select: { id: true, partnerId: true, managerId: true, status: true } })
    if (!order) return NextResponse.json({ error: "Сделка не найдена" }, { status: 404 })
    if (!canManageDeliveryOrder(session, order)) return NextResponse.json({ error: "Нет прав на обновление маршрута" }, { status: 403 })

    const body = await request.json()
    const status = asTrimmedString(body.status, 40)
    if (!isDeliveryStatus(status)) return NextResponse.json({ error: "Недопустимый статус" }, { status: 400 })
    if (!canTransitionDeliveryStatus(order.status, status)) {
      return NextResponse.json({ error: "Можно подтвердить только следующий этап, паузу или отмену сделки" }, { status: 409 })
    }

    const title = asTrimmedString(body.title, 160) || DELIVERY_STATUS_META[status].label
    const description = asTrimmedString(body.description, 2000) || null
    if ((status === "ON_HOLD" || status === "CANCELED") && !description) {
      return NextResponse.json({ error: "Для паузы или отмены укажите причину" }, { status: 400 })
    }
    const responsibleRole = asTrimmedString(body.responsibleRole, 30) || DELIVERY_STATUS_META[status].responsible.toUpperCase()
    const source = isDeliveryAdmin(session) ? "MANUAL" : "PARTNER"
    const completedAt = parseDeliveryDate(body.completedAt) || new Date()
    const expectedAt = parseDeliveryDate(body.expectedAt)
    const isVisibleToBuyer = body.isVisibleToBuyer !== false

    const event = await prisma.$transaction(async (tx) => {
      const updated = await tx.deliveryOrder.updateMany({
        where: { id: order.id, status: order.status },
        data: {
          status,
          statusSource: source,
          purchasedAt: status === "PURCHASED" ? completedAt : undefined,
          completedAt: status === "COMPLETED" ? completedAt : undefined,
          nextAction: asTrimmedString(body.nextAction, 300) || null,
          nextActionAt: parseDeliveryDate(body.nextActionAt),
        },
      })
      if (updated.count === 0) throw new Error(STATE_CONFLICT)

      return tx.deliveryEvent.create({
        data: { deliveryOrderId: order.id, status, title, description, responsibleRole, source, completedAt, expectedAt, isVisibleToBuyer, authorId: session.user.id },
        include: { author: { select: { id: true, name: true, image: true } } },
      })
    })

    return NextResponse.json({ event }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === STATE_CONFLICT) {
      return NextResponse.json({ error: "Статус уже изменился. Обновите страницу." }, { status: 409 })
    }
    console.error("Delivery event POST error:", error)
    return NextResponse.json({ error: "Не удалось добавить событие" }, { status: 500 })
  }
}
