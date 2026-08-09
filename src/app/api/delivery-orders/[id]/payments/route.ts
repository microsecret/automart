import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { asTrimmedString, canManageDeliveryOrder, parseDeliveryDate } from "@/lib/delivery-access"
import { DELIVERY_PAYMENT_META } from "@/lib/delivery"

export const dynamic = "force-dynamic"

const currencies = new Set(["RUB", "CNY", "KRW", "JPY", "USD", "EUR"])

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const order = await prisma.deliveryOrder.findUnique({ where: { id }, select: { id: true, partnerId: true, managerId: true } })
    if (!order) return NextResponse.json({ error: "Сделка не найдена" }, { status: 404 })
    if (!canManageDeliveryOrder(session, order)) return NextResponse.json({ error: "Нет прав на выставление счёта" }, { status: 403 })

    const body = await request.json()
    const category = asTrimmedString(body.category, 30)
    const amount = Number(body.amount)
    const currency = asTrimmedString(body.currency, 5) || "RUB"
    if (!DELIVERY_PAYMENT_META[category] || !Number.isSafeInteger(amount) || amount <= 0 || !currencies.has(currency)) {
      return NextResponse.json({ error: "Проверьте вид платежа, сумму и валюту" }, { status: 400 })
    }

    const payment = await prisma.deliveryPayment.create({
      data: {
        deliveryOrderId: order.id,
        category,
        amount,
        currency,
        status: "INVOICE_ISSUED",
        payeeName: asTrimmedString(body.payeeName, 160) || null,
        invoiceNumber: asTrimmedString(body.invoiceNumber, 100) || null,
        instruction: asTrimmedString(body.instruction, 2000) || null,
        dueAt: parseDeliveryDate(body.dueAt),
      },
    })

    return NextResponse.json({ payment }, { status: 201 })
  } catch (error) {
    console.error("Delivery payment POST error:", error)
    return NextResponse.json({ error: "Не удалось создать счёт" }, { status: 500 })
  }
}
