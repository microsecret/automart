import { NextRequest, NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"
import Stripe from "stripe"

const prisma = new PrismaClient()
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
})

// Webhook secret for verifying webhook signatures
// In production, this should be set as an environment variable
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "whsec_..."

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get("stripe-signature") as string

    let event: Stripe.Event

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err) {
      console.error(`Webhook signature verification failed.`, err)
      return NextResponse.json(
        { error: `Webhook Error: ${err.message}` },
        { status: 400 }
      )
    }

    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        const listingId = paymentIntent.metadata.listingId
        const userId = paymentIntent.metadata.userId

        if (listingId && userId) {
          // Update the listing to be featured
          await prisma.listing.update({
            where: { id: listingId },
            data: {
              isFeatured: true,
              // Optionally, we could set an expiration date for featuring
              // For simplicity, we'll leave it as indefinitely featured
              // In a real implementation, we might want to add a featuredUntil field
            }
          })

          // Optionally, create a record of the payment for tracking
          // We could create a Payment table or add metadata to the listing
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