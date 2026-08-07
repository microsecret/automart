import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "../auth/[...nextauth]/route"
import { PrismaClient } from "@prisma/client"
import Stripe from "stripe"

const prisma = new PrismaClient()
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { listingId } = body

    if (!listingId) {
      return NextResponse.json(
        { error: "Listing ID is required" },
        { status: 400 }
      )
    }

    // Get listing details
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      include: {
        vehicle: true,
        part: true,
        user: true
      }
    })

    if (!listing) {
      return NextResponse.json(
        { error: "Listing not found" },
        { status: 404 }
      )
    }

    // Check if listing belongs to current user
    if (listing.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Unauthorized to promote this listing" },
        { status: 403 }
      )
    }

    // Check if listing is already featured
    if (listing.isFeatured) {
      return NextResponse.json(
        { error: "Listing is already featured" },
        { status: 400 }
      )
    }

    // Define price for featuring (in rubles, convert to cents for Stripe)
    const featuredPriceRUB = 199 // 199 rubles for 30 days of featuring
    const featuredPriceCents = featuredPriceRUB * 100 // Convert to cents

    // Create a PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: featuredPriceCents,
      currency: "rub",
      metadata: {
        listingId: listing.id,
        userId: session.user.id
      }
    })

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret
    })
  } catch (error) {
    console.error("Error creating payment intent:", error)
    return NextResponse.json(
      { error: "Failed to create payment intent" },
      { status: 500 }
    )
  }
}