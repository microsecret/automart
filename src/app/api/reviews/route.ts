import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { publicListingWhere } from "@/lib/listing-lifecycle"
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit"
import { Prisma } from "@prisma/client"

const REVIEW_PAGE_SIZE = 10

function parsePositiveInteger(value: string | null, fallback: number, max: number) {
  const parsed = Number.parseInt(value || "", 10)
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback
}

function parseRating(value: string | null) {
  if (value === null) return undefined
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 5 ? parsed : null
}

// GET reviews with filtering
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parsePositiveInteger(searchParams.get("page"), 1, 10_000)
    const limit = parsePositiveInteger(searchParams.get("limit"), REVIEW_PAGE_SIZE, 50)
    const skip = (page - 1) * limit

    // Reviews for unpublished, deleted or moderation-only cards are private
    // data. Profile-level reviews without a card remain readable.
    const where: Prisma.ReviewWhereInput = {
      OR: [
        { listingId: null },
        { listing: { is: publicListingWhere } },
      ],
    }

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
    const parsedRatingMin = parseRating(ratingMin)
    const parsedRatingMax = parseRating(ratingMax)
    if (parsedRatingMin === null || parsedRatingMax === null) return NextResponse.json({ error: "Рейтинг должен быть целым числом от 1 до 5" }, { status: 400 })
    if (parsedRatingMin !== undefined || parsedRatingMax !== undefined) {
      if (parsedRatingMin !== undefined && parsedRatingMax !== undefined && parsedRatingMin > parsedRatingMax) {
        return NextResponse.json({ error: "Минимальный рейтинг не может быть больше максимального" }, { status: 400 })
      }
      where.rating = {
        ...(parsedRatingMin !== undefined ? { gte: parsedRatingMin } : {}),
        ...(parsedRatingMax !== undefined ? { lte: parsedRatingMax } : {}),
      }
    }

    // Get reviews
    const [reviews, total, ratingGroups] = await prisma.$transaction([
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
              price: true,
              vehicleId: true,
              partId: true,
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
      }),
      prisma.review.groupBy({
        by: ["rating"],
        where,
        _count: { rating: true },
        orderBy: { rating: "asc" },
      }),
    ])

    const distribution = [5, 4, 3, 2, 1].map((rating) => ({
      rating,
      count: ratingGroups.find((group) => group.rating === rating)?._count.rating || 0,
    }))
    const ratingTotal = distribution.reduce((sum, item) => sum + item.count, 0)
    const averageRating = ratingTotal > 0
      ? distribution.reduce((sum, item) => sum + item.rating * item.count, 0) / ratingTotal
      : null

    return NextResponse.json({
      reviews,
      summary: {
        averageRating,
        total: ratingTotal,
        distribution,
      },
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

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Некорректные данные отзыва" }, { status: 400 })
    const { rating, comment, listingId } = body

    // Validation
    const normalizedRating = Number(rating)
    if (!Number.isInteger(normalizedRating) || normalizedRating < 1 || normalizedRating > 5) {
      return NextResponse.json(
        { error: "Рейтинг должен быть целым числом от 1 до 5" },
        { status: 400 }
      )
    }
    const normalizedComment = typeof comment === "string" ? comment.trim() : ""
    if (normalizedComment.length > 2_000) return NextResponse.json({ error: "Текст отзыва не должен превышать 2000 символов" }, { status: 400 })
    if (typeof listingId !== "string" || !listingId) return NextResponse.json({ error: "Укажите объявление для отзыва" }, { status: 400 })

    const userLimit = rateLimit(`reviews:user:${session.user.id}`, { windowMs: 60 * 60_000, maxRequests: 10 })
    const ipLimit = rateLimit(`reviews:ip:${getClientIp(request)}`, { windowMs: 60 * 60_000, maxRequests: 25 })
    if (!userLimit.success || !ipLimit.success) {
      const limit = !userLimit.success ? userLimit : ipLimit
      return NextResponse.json({ error: "Слишком много отзывов. Попробуйте позже." }, { status: 429, headers: rateLimitHeaders(limit) })
    }

    const listing = await prisma.listing.findFirst({
      where: { id: listingId, ...publicListingWhere },
      select: { id: true, userId: true },
    })
    if (!listing) {
      return NextResponse.json({ error: "Объявление недоступно для отзыва" }, { status: 404 })
    }
    if (listing.userId === session.user.id) {
      return NextResponse.json({ error: "Нельзя оставить отзыв о собственном объявлении" }, { status: 403 })
    }

    const existingReview = await prisma.review.findFirst({
      where: { userId: session.user.id, listingId },
      select: { id: true },
    })
    if (existingReview) {
      return NextResponse.json({ error: "Вы уже оставляли отзыв об этом объявлении" }, { status: 409 })
    }

    // Create the review
    const review = await prisma.review.create({
      data: {
        rating: normalizedRating,
        comment: normalizedComment || null,
        userId: session.user.id,
        listingId,
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
            price: true,
            vehicleId: true,
            partId: true,
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
