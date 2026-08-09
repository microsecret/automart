import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { publicListingWhere } from "@/lib/listing-lifecycle"
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Войдите, чтобы делать ставки" }, { status: 401 })
    const limit = rateLimit(`part-bid:user:${session.user.id}:ip:${getClientIp(request)}`, { windowMs: 60_000, maxRequests: 12 })
    if (!limit.success) {
      return NextResponse.json(
        { error: "Слишком много попыток. Попробуйте через минуту." },
        { status: 429, headers: rateLimitHeaders(limit) },
      )
    }
    const body = await request.json().catch(() => null)
    const amount = typeof body === "object" && body && !Array.isArray(body) ? Number((body as Record<string, unknown>).amount) : NaN
    if (!Number.isSafeInteger(amount) || amount <= 0) return NextResponse.json({ error: "Укажите корректную сумму в рублях" }, { status: 400 })

    const result = await prisma.$transaction(async (tx) => {
      const part = await tx.part.findFirst({
        where: { id, listings: { some: publicListingWhere } },
        select: { id: true, userId: true, saleFormat: true, auctionStatus: true, auctionEndsAt: true, auctionCurrentPrice: true, auctionStartPrice: true, auctionMinStep: true },
      })
      if (!part) return { error: "Запчасть не найдена", status: 404 as const }
      if (part.saleFormat !== "AUCTION") return { error: "Это объявление не является аукционом", status: 400 as const }
      if (part.userId === session.user.id) return { error: "Нельзя делать ставку на собственный лот", status: 403 as const }
      if (part.auctionStatus !== "ACTIVE" || !part.auctionEndsAt || part.auctionEndsAt <= new Date()) {
        await tx.part.update({ where: { id: part.id }, data: { auctionStatus: "FINISHED" } })
        return { error: "Аукцион уже завершён", status: 400 as const }
      }
      const current = part.auctionCurrentPrice || part.auctionStartPrice || 0
      const minStep = part.auctionMinStep || 1
      if (amount < current + minStep) return { error: `Минимальная ставка — ${(current + minStep).toLocaleString("ru-RU")} ₽`, status: 400 as const }

      const updated = await tx.part.updateMany({
        where: {
          id: part.id,
          saleFormat: "AUCTION",
          auctionStatus: "ACTIVE",
          auctionEndsAt: { gt: new Date() },
          auctionCurrentPrice: part.auctionCurrentPrice,
        },
        data: { price: amount, auctionCurrentPrice: amount },
      })
      if (updated.count !== 1) return { error: "Ставка уже изменилась. Обновите страницу и укажите новую сумму.", status: 409 as const }
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
