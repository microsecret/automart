import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { prisma } from "@/lib/prisma"
import { accrueReferralReward } from "@/lib/referral-accrual"
import { LISTING_STATUS } from "@/lib/listing-lifecycle"
import { getPromotionTariff } from "@/lib/promotion-tariffs"
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

        const order = await prisma.promotionOrder.findUnique({ where: { id: orderId } })
        if (
          !order
          || order.listingId !== listingId
          || order.userId !== userId
          || order.tariffId !== tariff.id
          || order.amountRub !== tariff.amountRub
          || order.durationDays !== tariff.durationDays
        ) {
          console.error(`Payment ${paymentIntent.id} does not match promotion order ${orderId}`)
          break
        }
        if (order.status === "PAID" && order.providerPaymentId === paymentIntent.id) break

        // The end date is anchored to Stripe's immutable creation timestamp.
        // Replayed webhooks therefore cannot extend a promotion.
        const promoUntil = new Date((paymentIntent.created + tariff.durationDays * 86_400) * 1_000)
        const activated = await prisma.$transaction(async (tx) => {
          const claimed = await tx.promotionOrder.updateMany({
            where: { id: orderId, status: { in: ["PENDING", "FAILED"] }, providerPaymentId: null },
            data: { status: "PAID", providerPaymentId: paymentIntent.id, promoUntil, paidAt: new Date() },
          })
          if (!claimed.count) return false

          const updated = await tx.listing.updateMany({
            where: { id: listingId, userId, status: LISTING_STATUS.ACTIVE, deletedAt: null },
            data: {
              isFeatured: tariff.isFeatured,
              promoType: tariff.id,
              promoUntil,
            },
          })
          if (!updated.count) {
            await tx.promotionOrder.update({ where: { id: orderId }, data: { status: "REVIEW_REQUIRED" } })
            await tx.notification.create({
              data: {
                userId,
                title: "Платёж требует проверки",
                content: "Оплата получена, но объявление уже не активно. Поддержка проверит активацию или возврат.",
                type: "WARNING",
                relatedId: listingId,
                relatedType: "LISTING",
              },
            })
            return false
          }

          await tx.notification.create({
            data: {
              userId,
              title: "Продвижение активировано",
              content: `Тариф «${tariff.title}» активен до ${promoUntil.toLocaleDateString("ru-RU")}`,
              type: "SUCCESS",
              relatedId: listingId,
              relatedType: "LISTING",
            },
          })
          return true
        })

        if (activated) {
          console.log(`Listing ${listingId} has been featured via payment ${paymentIntent.id}`)
          // Начисление идёт после активации и вне транзакции: сбой в
          // партнёрской программе не должен отменять уже оплаченный тариф.
          await accrueReferralReward(orderId)
        }
        break
      }

      case "payment_intent.payment_failed": {
        const failedIntent = event.data.object as Stripe.PaymentIntent
        const orderId = failedIntent.metadata.orderId
        if (orderId) {
          await prisma.promotionOrder.updateMany({
            where: { id: orderId, status: "PENDING" },
            data: { status: "FAILED" },
          })
        }
        console.log(`Payment failed for intent: ${failedIntent.id}`)
        break
      }

      case "checkout.session.expired": {
        const checkout = event.data.object as Stripe.Checkout.Session
        const orderId = checkout.metadata?.orderId
        if (orderId) {
          await prisma.promotionOrder.updateMany({
            where: { id: orderId, status: "PENDING" },
            data: { status: "CANCELED" },
          })
        }
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
