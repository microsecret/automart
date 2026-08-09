import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
export const dynamic = "force-dynamic"

const PROMOTION_TARIFFS = {
  BOOST: { amount: 499, durationDays: 7 },
  PREMIUM: { amount: 999, durationDays: 14 },
  VIP: { amount: 1999, durationDays: 30 },
} as const

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: "Платежи не настроены (STRIPE_SECRET_KEY отсутствует)" },
        { status: 503 }
      )
    }

    const Stripe = (await import("stripe")).default
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

    const body = await request.json()
    const listingId = typeof body.listingId === "string" ? body.listingId : ""
    const promotionType = typeof body.promotionType === "string" ? body.promotionType.toUpperCase() : ""
    const tariff = PROMOTION_TARIFFS[promotionType as keyof typeof PROMOTION_TARIFFS]

    if (!listingId || !tariff) {
      return NextResponse.json({ error: "Выберите объявление и тариф продвижения" }, { status: 400 })
    }

    const listing = await prisma.listing.findUnique({ where: { id: listingId }, select: { id: true, userId: true } })
    if (!listing) return NextResponse.json({ error: "Объявление не найдено" }, { status: 404 })
    if (listing.userId !== session.user.id) return NextResponse.json({ error: "Нельзя оплатить продвижение чужого объявления" }, { status: 403 })

    const paymentIntent = await stripe.paymentIntents.create({
      amount: tariff.amount * 100,
      currency: "rub",
      metadata: { listingId, userId: session.user.id, promotionType, durationDays: String(tariff.durationDays) }
    })

    return NextResponse.json({ clientSecret: paymentIntent.client_secret, amount: tariff.amount, promotionType })
  } catch (error) {
    console.error("Error creating payment intent:", error)
    return NextResponse.json(
      { error: "Failed to create payment intent" },
      { status: 500 }
    )
  }
}
