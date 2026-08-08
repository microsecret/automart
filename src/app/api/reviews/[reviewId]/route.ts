import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "../../auth/[...nextauth]/route"
import { prisma } from "@/lib/prisma"
// GET a specific review
export async function GET(request: NextRequest, { params }: { params: { reviewId: string } }) {
  try {
    const session = await getServerSession(authOptions)
    // Note: We don't require authentication for reading a review
    // but we might want to show different info based on auth status

    const { reviewId } = params

    // Get the review
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
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

    if (!review) {
      return NextResponse.json(
        { error: "Review not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ review })
  } catch (error) {
    console.error("Error fetching review:", error)
    return NextResponse.json(
      { error: "Failed to fetch review" },
      { status: 500 }
    )
  }
}

// PUT update a review
export async function PUT(request: NextRequest, { params }: { params: { reviewId: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { reviewId } = params

    // Verify the review exists and belongs to the current user
    const existingReview = await prisma.review.findFirst({
      where: {
        id: reviewId,
        userId: session.user.id
      },
      select: {
        id: true
      }
    })

    if (!existingReview) {
      return NextResponse.json(
        { error: "Review not found or unauthorized" },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { rating, comment } = body

    // Validation
    if (rating === undefined || rating === null || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: "Rating must be between 1 and 5" },
        { status: 400 }
      )
    }

    // Update the review
    const review = await prisma.review.update({
      where: { id: reviewId },
      data: {
        rating: parseInt(rating),
        comment: comment?.trim() || null
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

    return NextResponse.json(review)
  } catch (error) {
    console.error("Error updating review:", error)
    return NextResponse.json(
      { error: "Failed to update review" },
      { status: 500 }
    )
  }
}

// DELETE a review
export async function DELETE(request: NextRequest, { params }: { params: { reviewId: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { reviewId } = params

    // Verify the review exists and belongs to the current user
    const existingReview = await prisma.review.findFirst({
      where: {
        id: reviewId,
        userId: session.user.id
      },
      select: {
        id: true
      }
    })

    if (!existingReview) {
      return NextResponse.json(
        { error: "Review not found or unauthorized" },
        { status: 404 }
      )
    }

    // Delete the review
    await prisma.review.delete({
      where: { id: reviewId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting review:", error)
    return NextResponse.json(
      { error: "Failed to delete review" },
      { status: 500 }
    )
  }
}