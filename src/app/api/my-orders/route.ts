import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

/** Возвращает заказы текущего покупателя. */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Требуется вход" }, { status: 401 })

  const orders = await prisma.partOrder.findMany({
    where: { buyerId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true, itemName: true, itemPriceRub: true, itemOemNumber: true, quantity: true,
      leadTimeDaysMin: true, leadTimeDaysMax: true, status: true, statusReason: true,
      city: true, comment: true, createdAt: true, updatedAt: true,
      // Контакты магазина нужны покупателю, чтобы уточнить статус самому,
      // не дожидаясь звонка продавца.
      store: { select: { name: true, slug: true, city: true, contactPhone: true, contactEmail: true } },
    },
  })

  return NextResponse.json({ orders })
}
