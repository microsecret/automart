import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { asTrimmedString, canReadDeliveryOrder } from "@/lib/delivery-access"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const order = await prisma.deliveryOrder.findUnique({ where: { id: params.id }, select: { id: true, buyerId: true, partnerId: true, managerId: true } })
    if (!order) return NextResponse.json({ error: "Сделка не найдена" }, { status: 404 })
    if (!canReadDeliveryOrder(session, order)) return NextResponse.json({ error: "Нет доступа к чату сделки" }, { status: 403 })

    const body = await request.json()
    const content = asTrimmedString(body.content, 3000)
    if (!content) return NextResponse.json({ error: "Введите сообщение" }, { status: 400 })

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
