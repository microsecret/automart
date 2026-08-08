import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "../auth/[...nextauth]/route"
import { prisma } from "@/lib/prisma"
// GET reviews with filtering
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    // Note: We don't require authentication for reading reviews
    // but we might want to show different info based on auth status

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "10")
    const skip = (page - 1) * limit

    // Get where clause for filtering
    const where: any = {}

    // Filter by reviewer userId if specified
    const userId = searchParams.get("userId")
    if (userId) {
      where.userId = userId
    }

    // Filter by listingId if specified
    const listingId = searchParams.get("listingId")
    if (listingId) {
      where.listingId = listingId
    }

    // Filter by rating range if specified
    const ratingMin = searchParams.get("ratingMin")
    const ratingMax = searchParams.get("ratingMax")
    if (ratingMin) {
      where.rating = {
        ...(where.rating ?? {}),
        gte: parseInt(ratingMin)
      }
    }
    if (ratingMax) {
      where.rating = {
        ...(where.rating ?? {}),
        lte: parseInt(ratingMax)
      }
    }

    // Get reviews
    const [reviews, total] = await prisma.$transaction([
      prisma.review.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              image: true
            }
          },
          listing: {
            select: {
              id: true,
              title: true,
              price: true
            }
          }
        },
        skip,
        take: limit,
        orderBy: {
          createdAt: "desc"
        }
      }),
      prisma.review.count({
        where
      })
    ])

    return NextResponse.json({
      reviews,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error("Error fetching reviews:", error)
    return NextResponse.json(
      { error: "Failed to fetch reviews" },
      { status: 500 }
    )
  }
}

// POST create a new review
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
    const { rating, comment, listingId } = body

    // Validation
    if (rating === undefined || rating === null || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: "Rating must be between 1 and 5" },
        { status: 400 }
      )
    }

    // Validate listingId if provided
    if (listingId) {
      const listing = await prisma.listing.findUnique({
        where: { id: listingId },
        select: { id: true }
      })

      if (!listing) {
        return NextResponse.json(
          { error: "Listing not found" },
          { status: 404 }
        )
      }
    }

    // Check if user has already left a review for this listing (if listingId provided)
    if (listingId) {
      const existingReview = await prisma.review.findFirst({
        where: {
          userId: session.user.id,
          listingId: listingId
        },
        select: {
          id: true
        }
      })

      if (existingReview) {
        return NextResponse.json(
          { error: "You have already left a review for this listing" },
          { status: 409 } // Conflict
        )
      }
    }

    // Create the review
    const review = await prisma.review.create({
      data: {
        rating: parseInt(rating),
        comment: comment?.trim() || null,
        userId: session.user.id,
        listingId: listingId || null
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true
          }
        },
        listing: {
          select: {
            id: true,
            title: true,
            price: true
          }
        }
      }
    })

    return NextResponse.json(review, { status: 201 })
  } catch (error) {
    console.error("Error creating review:", error)
    return NextResponse.json(
      { error: "Failed to create review" },
      { status: 500 }
    )
  }
}