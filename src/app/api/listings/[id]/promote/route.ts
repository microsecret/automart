import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import Stripe from "stripe"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { LISTING_STATUS } from "@/lib/listing-lifecycle"
import { absoluteUrl } from "@/lib/site-url"
import { getPromotionTariff } from "@/lib/promotion-tariffs"

export const dynamic = "force-dynamic"

/** POST /api/listings/[id]/promote — создать защищённую оплату продвижения. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json().catch(() => null)
    const tariff = getPromotionTariff(body?.tariff)
    if (!tariff) return NextResponse.json({ error: "Неизвестный тариф" }, { status: 400 })

    // Проверяем владельца
    const listing = await prisma.listing.findUnique({
      where: { id },
      select: { id: true, userId: true, title: true, status: true, deletedAt: true },
    })
    if (!listing) return NextResponse.json({ error: "Объявление не найдено" }, { status: 404 })
    if (listing.userId !== session.user.id) return NextResponse.json({ error: "Нет прав" }, { status: 403 })
    if (listing.status !== LISTING_STATUS.ACTIVE || listing.deletedAt) {
      return NextResponse.json({ error: "Продвижение доступно только активному объявлению" }, { status: 409 })
    }

    const stripeSecret = process.env.STRIPE_SECRET_KEY
    if (!stripeSecret) {
      return NextResponse.json(
        { error: "Онлайн-оплата пока не подключена. Продвижение не активировано." },
        { status: 503 },
      )
    }

    const stripe = new Stripe(stripeSecret)
    const order = await prisma.promotionOrder.create({
      data: {
        listingId: listing.id,
        userId: session.user.id,
        tariffId: tariff.id,
        amountRub: tariff.amountRub,
        durationDays: tariff.durationDays,
        provider: "STRIPE",
      },
      select: { id: true },
    })
    const metadata = {
      orderId: order.id,
      listingId: listing.id,
      userId: session.user.id,
      promotionType: tariff.id.toUpperCase(),
    }
    try {
      const checkout = await stripe.checkout.sessions.create({
        mode: "payment",
        client_reference_id: order.id,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "rub",
              unit_amount: tariff.amountRub * 100,
              product_data: {
                name: `${tariff.title}: ${listing.title}`,
                description: `${tariff.description}. Срок: ${tariff.durationDays} дн.`,
              },
            },
          },
        ],
        success_url: absoluteUrl(`/listings/${listing.id}/promote?payment=success`),
        cancel_url: absoluteUrl(`/listings/${listing.id}/promote?payment=canceled`),
        metadata,
        payment_intent_data: { metadata },
      })

      if (!checkout.url) throw new Error("Stripe Checkout session has no URL")

      await prisma.promotionOrder.update({
        where: { id: order.id },
        data: { providerCheckoutId: checkout.id },
      })

      return NextResponse.json({ checkoutUrl: checkout.url })
    } catch (error) {
      await prisma.promotionOrder.updateMany({
        where: { id: order.id, status: "PENDING" },
        data: { status: "FAILED" },
      })
      throw error
    }
  } catch (error) {
    console.error("Promote error:", error)
    return NextResponse.json({ error: "Failed to promote" }, { status: 500 })
  }
}
