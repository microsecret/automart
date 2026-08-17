import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canManageDeliveryOrder } from "@/lib/delivery-access"
import { canTransitionDeliveryPayment, isDeliveryPaymentStatus } from "@/lib/delivery"

export const dynamic = "force-dynamic"

const manageableStatuses = new Set(["CONFIRMED", "OVERDUE", "CANCELED"])

/** PATCH /api/delivery-orders/[id]/payments/[paymentId] — подтверждение квитанции представителем. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; paymentId: string }> }) {
  try {
    const { id, paymentId } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const order = await prisma.deliveryOrder.findUnique({ where: { id }, select: { id: true, partnerId: true, managerId: true, status: true } })
    if (!order) return NextResponse.json({ error: "Сделка не найдена" }, { status: 404 })
    if (!canManageDeliveryOrder(session, order)) return NextResponse.json({ error: "Нет прав на проверку платежа" }, { status: 403 })

    const body = await request.json()
    const status = typeof body.status === "string" ? body.status : ""
    if (!manageableStatuses.has(status) || !isDeliveryPaymentStatus(status)) return NextResponse.json({ error: "Недопустимый статус платежа" }, { status: 400 })

    const existingPayment = await prisma.deliveryPayment.findFirst({
      where: { id: paymentId, deliveryOrderId: order.id },
      select: { id: true, status: true, category: true, amount: true },
    })
    if (!existingPayment) return NextResponse.json({ error: "Счёт не найден" }, { status: 404 })
    if (!canTransitionDeliveryPayment(existingPayment.status, status)) {
      return NextResponse.json({ error: "Этот переход статуса счёта недопустим" }, { status: 409 })
    }

    const confirmedAt = status === "CONFIRMED" ? new Date() : null
    const updated = await prisma.$transaction(async (tx) => {
      const payment = await tx.deliveryPayment.updateMany({
        where: { id: paymentId, deliveryOrderId: order.id, status: existingPayment.status },
        data: { status, confirmedAt, paidAt: confirmedAt },
      })
      if (payment.count === 0) return false

      if (existingPayment.category === "DEPOSIT") {
        const shouldAdvanceDeal = status === "CONFIRMED" && ["REQUEST_CREATED", "DEPOSIT_PENDING"].includes(order.status)
        await tx.deliveryOrder.update({
          where: { id: order.id },
          data: {
            buyerDepositStatus: status,
            depositPaidAt: confirmedAt,
            ...(shouldAdvanceDeal ? { status: "DEPOSIT_CONFIRMED", nextAction: "Партнёр подтверждает лимит и начинает выкуп автомобиля" } : {}),
          },
        })
        if (shouldAdvanceDeal) {
          await tx.deliveryEvent.create({
            data: {
              deliveryOrderId: order.id,
              status: "DEPOSIT_CONFIRMED",
              title: "Задаток подтверждён",
              description: existingPayment.amount ? `Подтверждена сумма ${existingPayment.amount.toLocaleString("ru-RU")} ₽. Заявка передана в работу.` : "Заявка передана в работу.",
              responsibleRole: "PLATFORM",
              source: "MANUAL",
              authorId: session.user.id,
            },
          })
        }
      }

      if (existingPayment.category === "PLATFORM_FEE") {
        await tx.deliveryOrder.update({
          where: { id: order.id },
          data: { platformFeeStatus: status },
        })
      }

      return true
    })
    if (!updated) return NextResponse.json({ error: "Статус счёта уже изменился. Обновите страницу." }, { status: 409 })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delivery payment PATCH error:", error)
    return NextResponse.json({ error: "Не удалось обновить статус платежа" }, { status: 500 })
  }
}
