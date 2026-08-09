import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { prisma } from "@/lib/prisma"
export const dynamic = "force-dynamic"

const PROMOTION_DURATIONS: Record<string, number> = { BOOST: 7, PREMIUM: 14, VIP: 30 }

export async function POST(request: NextRequest) {
  try {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
    if (!process.env.STRIPE_SECRET_KEY || !webhookSecret) {
      return NextResponse.json({ error: "Webhook not configured" }, { status: 503 })
    }
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    const body = await request.text()
    const signature = request.headers.get("stripe-signature")
    if (!signature) return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 })

    let event: Stripe.Event

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err) {
      console.error(`Webhook signature verification failed.`, err)
      return NextResponse.json(
        { error: `Webhook Error: ${err instanceof Error ? err.message : "invalid signature"}` },
        { status: 400 }
      )
    }

    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        const listingId = paymentIntent.metadata.listingId
        const userId = paymentIntent.metadata.userId
        const promotionType = paymentIntent.metadata.promotionType
        const durationDays = PROMOTION_DURATIONS[promotionType]

        if (listingId && userId && durationDays) {
          await prisma.listing.updateMany({
            where: { id: listingId, userId },
            data: {
              isFeatured: true,
              promoType: promotionType.toLowerCase(),
              promoUntil: new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000),
            },
          })
          console.log(`Listing ${listingId} has been featured via payment ${paymentIntent.id}`)
        }
        break

      case 'payment_intent.payment_failed':
        const failedIntent = event.data.object as Stripe.PaymentIntent
        console.log(`Payment failed for intent: ${failedIntent.id}`)
        // Optionally notify the user about failed payment
        break

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    // Return a 200 response to acknowledge receipt of the webhook
    return NextResponse.json({ received: true })
  } catch (error) {
    console.error("Error processing webhook:", error)
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    )
  }
}
