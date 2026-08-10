import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { LISTING_STATUS } from "@/lib/listing-lifecycle"

export const dynamic = "force-dynamic"

/** GET /api/dashboard/stats — статистика личного кабинета */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const userId = session.user.id

    const [listings, favorites, reviews, garageVehicles] = await Promise.all([
      prisma.listing.findMany({
        where: { userId },
        include: {
          vehicle: { select: { id: true, make: true, model: true, year: true, price: true, mileage: true, images: true, location: true, vehicleType: true, bodyType: true } },
          part: { select: { id: true, name: true, price: true, images: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          createdAt: true,
          favoriteListings: { take: 10, orderBy: { createdAt: "desc" }, include: { vehicle: { select: { id: true, make: true, model: true, year: true, price: true, images: true, mileage: true, vehicleType: true, bodyType: true } } } },
        },
      }),
      prisma.review.findMany({
        where: { userId },
        select: { id: true, rating: true, comment: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.vehicle.count({ where: { userId, category: { name: "Личный гараж" } } }),
    ])

    const totalViews = listings.reduce((sum, l) => sum + (l.views || 0), 0)
    const workflow = {
      drafts: listings.filter((listing) => listing.status === LISTING_STATUS.DRAFT).length,
      pendingModeration: listings.filter((listing) => listing.status === LISTING_STATUS.PENDING_MODERATION).length,
      active: listings.filter((listing) => listing.status === LISTING_STATUS.ACTIVE).length,
      needsAttention: listings.filter((listing) => listing.status === LISTING_STATUS.REJECTED || listing.status === LISTING_STATUS.PAUSED).length,
    }

    return NextResponse.json({
      stats: {
        totalListings: listings.length,
        totalViews,
        favoritesCount: favorites?.favoriteListings?.length || 0,
        reviewsCount: reviews.length,
        garageCount: garageVehicles,
        avgRating: reviews.length > 0 ? Math.round(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length * 10) / 10 : 0,
        memberSince: favorites?.createdAt ?? null,
      },
      workflow,
      listings: listings.slice(0, 10).map((l) => ({
        id: l.id,
        title: l.title,
        price: l.price,
        status: l.status,
        statusReason: l.statusReason,
        isFeatured: l.isFeatured,
        views: l.views || 0,
        createdAt: l.createdAt,
        vehicle: l.vehicle,
        part: l.part,
      })),
      favorites: favorites?.favoriteListings || [],
    })
  } catch (error) {
    console.error("Dashboard stats error:", error)
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 })
  }
}
