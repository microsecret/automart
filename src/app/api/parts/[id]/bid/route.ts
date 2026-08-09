import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "../../../auth/[...nextauth]/route"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Войдите, чтобы делать ставки" }, { status: 401 })
    const body = await request.json()
    const amount = Math.trunc(Number(body.amount))
    if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "Укажите корректную сумму" }, { status: 400 })

    const result = await prisma.$transaction(async (tx) => {
      const part = await tx.part.findUnique({ where: { id: params.id }, select: { id: true, saleFormat: true, auctionStatus: true, auctionEndsAt: true, auctionCurrentPrice: true, auctionStartPrice: true, auctionMinStep: true } })
      if (!part) return { error: "Запчасть не найдена", status: 404 as const }
      if (part.saleFormat !== "AUCTION") return { error: "Это объявление не является аукционом", status: 400 as const }
      if (part.auctionStatus !== "ACTIVE" || !part.auctionEndsAt || part.auctionEndsAt <= new Date()) {
        await tx.part.update({ where: { id: part.id }, data: { auctionStatus: "FINISHED" } })
        return { error: "Аукцион уже завершён", status: 400 as const }
      }
      const current = part.auctionCurrentPrice || part.auctionStartPrice || 0
      const minStep = part.auctionMinStep || 1
      if (amount < current + minStep) return { error: `Минимальная ставка — ${(current + minStep).toLocaleString("ru-RU")} ₽`, status: 400 as const }

      await tx.part.update({ where: { id: part.id }, data: { price: amount, auctionCurrentPrice: amount } })
      const bid = await tx.partBid.create({ data: { partId: part.id, userId: session.user.id, amount } })
      return { ok: true, bid: { id: bid.id, amount: bid.amount, createdAt: bid.createdAt } }
    })

    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error("Part bid error:", error)
    return NextResponse.json({ error: "Не удалось принять ставку" }, { status: 500 })
  }
}
