import { NextResponse } from "next/server"
import { requireUser } from "@/lib/api-session-guard"
import { prisma } from "@/lib/prisma"
import { isDeliveryAdmin } from "@/lib/delivery-access"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const guard = await requireUser()
    if (guard.denied) return guard.denied
    const session = guard.session

    const userId = session.user.id
    const documents = await prisma.deliveryDocument.findMany({
      where: isDeliveryAdmin(session) ? {} : {
        OR: [
          {
            visibility: "BUYER_AND_TEAM",
            deliveryOrder: { OR: [{ buyerId: userId }, { partnerId: userId }, { managerId: userId }] },
          },
          {
            visibility: "TEAM_ONLY",
            deliveryOrder: { OR: [{ partnerId: userId }, { managerId: userId }] },
          },
        ],
      },
      select: {
        id: true,
        title: true,
        category: true,
        fileName: true,
        mimeType: true,
        size: true,
        createdAt: true,
        deliveryOrder: { select: { id: true, code: true, title: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    })

    return NextResponse.json({
      documents: documents.map((document) => ({
        ...document,
        downloadUrl: `/api/delivery-orders/${document.deliveryOrder.id}/documents/${document.id}`,
      })),
    })
  } catch (error) {
    console.error("Delivery documents GET error:", error)
    return NextResponse.json({ error: "Не удалось загрузить документы" }, { status: 500 })
  }
}
