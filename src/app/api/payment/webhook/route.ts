import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { getPromotionTariff } from "@/lib/promotion-tariffs"
import { activatePaidPromotion, markPromotionOrderFailed } from "@/lib/promotion-activation"
export const dynamic = "force-dynamic"

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
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        const orderId = paymentIntent.metadata.orderId
        const listingId = paymentIntent.metadata.listingId
        const userId = paymentIntent.metadata.userId
        const tariff = getPromotionTariff(paymentIntent.metadata.promotionType)

        if (!orderId || !listingId || !userId || !tariff) {
          console.error(`Payment ${paymentIntent.id} has invalid promotion metadata`)
          break
        }
        if (paymentIntent.currency !== "rub" || paymentIntent.amount_received !== tariff.amountRub * 100) {
          console.error(`Payment ${paymentIntent.id} amount or currency does not match the tariff`)
          break
        }

        /* Активация общая с ЮKassa: проверка заказа, включение тарифа и
           уведомление продавца не зависят от кассы. */
        const result = await activatePaidPromotion({
          orderId,
          listingId,
          userId,
          tariff,
          providerPaymentId: paymentIntent.id,
          paymentCreatedAt: new Date(paymentIntent.created * 1_000),
        })
        if (result === "activated") {
          console.log(`Listing ${listingId} has been featured via payment ${paymentIntent.id}`)
        }
        break
      }

      case "payment_intent.payment_failed": {
        const failedIntent = event.data.object as Stripe.PaymentIntent
        const orderId = failedIntent.metadata.orderId
        if (orderId) await markPromotionOrderFailed(orderId, "FAILED")
        console.log(`Payment failed for intent: ${failedIntent.id}`)
        break
      }

      case "checkout.session.expired": {
        const checkout = event.data.object as Stripe.Checkout.Session
        const orderId = checkout.metadata?.orderId
        if (orderId) await markPromotionOrderFailed(orderId, "CANCELED")
        break
      }

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
