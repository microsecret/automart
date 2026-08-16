import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { publicListingWhere } from "@/lib/listing-lifecycle"
// GET a specific review
export async function GET(_request: NextRequest, { params }: { params: Promise<{ reviewId: string }> }) {
  try {
    const { reviewId } = await params

    // Get the review
    const review = await prisma.review.findFirst({
      where: {
        id: reviewId,
        OR: [
          { listingId: null },
          { listing: { is: publicListingWhere } },
        ],
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
export async function PUT(request: NextRequest, { params }: { params: Promise<{ reviewId: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { reviewId } = await params

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

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Некорректные данные отзыва" }, { status: 400 })
    }
    const { rating, comment } = body as Record<string, unknown>

    // Validation
    const normalizedRating = Number(rating)
    if (!Number.isInteger(normalizedRating) || normalizedRating < 1 || normalizedRating > 5) {
      return NextResponse.json(
        { error: "Рейтинг должен быть целым числом от 1 до 5" },
        { status: 400 }
      )
    }
    if (comment !== undefined && typeof comment !== "string") {
      return NextResponse.json({ error: "Текст отзыва должен быть строкой" }, { status: 400 })
    }
    const normalizedComment = typeof comment === "string" ? comment.trim() : ""
    if (normalizedComment.length > 2_000) {
      return NextResponse.json({ error: "Текст отзыва не должен превышать 2000 символов" }, { status: 400 })
    }

    // Update the review
    const review = await prisma.review.update({
      where: { id: reviewId },
      data: {
        rating: normalizedRating,
        comment: normalizedComment || null
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
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ reviewId: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { reviewId } = await params

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
