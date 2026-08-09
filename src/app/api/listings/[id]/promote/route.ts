import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

const TARIFFS: Record<string, { price: number; days: number; isFeatured: boolean }> = {
  boost: { price: 499, days: 3, isFeatured: false },
  premium: { price: 1490, days: 7, isFeatured: true },
  vip: { price: 3990, days: 30, isFeatured: true },
}

/** POST /api/listings/[id]/promote — применить продвижение (демо: без оплаты) */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const { tariff } = body as { tariff: string }

    const t = TARIFFS[tariff]
    if (!t) return NextResponse.json({ error: "Неизвестный тариф" }, { status: 400 })

    // Проверяем владельца
    const listing = await prisma.listing.findUnique({
      where: { id },
      select: { id: true, userId: true, title: true },
    })
    if (!listing) return NextResponse.json({ error: "Объявление не найдено" }, { status: 404 })
    if (listing.userId !== session.user.id) return NextResponse.json({ error: "Нет прав" }, { status: 403 })

    const promoUntil = new Date(Date.now() + t.days * 24 * 60 * 60 * 1000)

    const updated = await prisma.listing.update({
      where: { id },
      data: {
        isFeatured: t.isFeatured,
        promoType: tariff,
        promoUntil,
      },
      select: { id: true, isFeatured: true, promoType: true, promoUntil: true },
    })

    // Создаём уведомление
    await prisma.notification.create({
      data: {
        userId: session.user.id,
        title: "Продвижение активировано",
        content: `Тариф «${tariff === "vip" ? "VIP" : tariff === "premium" ? "Премиум" : "Поднятие в топ"}» активен до ${promoUntil.toLocaleDateString("ru")}`,
        type: "SUCCESS",
        relatedId: listing.id,
        relatedType: "LISTING",
      },
    }).catch(() => {})

    return NextResponse.json({ success: true, listing: updated })
  } catch (error) {
    console.error("Promote error:", error)
    return NextResponse.json({ error: "Failed to promote" }, { status: 500 })
  }
}
