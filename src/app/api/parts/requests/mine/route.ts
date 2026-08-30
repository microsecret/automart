import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

/**
 * Заявки человека вместе с ответами магазинов.
 *
 * Уведомление «по вашей заявке пришло предложение» вело в никуда:
 * страницы со своими заявками не было, и увидеть цену со сроком человек
 * не мог — оставалось ждать звонка. Соседний список заявок написан для
 * магазинов и покупателю не подходит: он показывает чужие заявки и
 * скрывает предложения.
 *
 * Заявку оставляют и без входа. Такие сюда не попадают: связать их не с
 * чем, и магазин отвечает по телефону, как обещано в форме.
 */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Требуется вход" }, { status: 401 })

  const requests = await prisma.partRequest.findMany({
    where: { requesterId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      partName: true,
      oemNumber: true,
      make: true,
      model: true,
      year: true,
      condition: true,
      comment: true,
      status: true,
      createdAt: true,
      offers: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          price: true,
          condition: true,
          leadTimeDays: true,
          comment: true,
          createdAt: true,
          /* Название и телефон магазина — весь смысл ответа: дальше
             человек звонит сам, площадка в разговоре не участвует. */
          store: { select: { id: true, name: true, slug: true, contactPhone: true, city: true } },
        },
      },
    },
  })

  return NextResponse.json({ requests })
}
