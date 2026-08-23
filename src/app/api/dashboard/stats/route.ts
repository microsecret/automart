import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { LISTING_STATUS } from "@/lib/listing-lifecycle"
import { checkPartnerAccess } from "@/lib/partner-access"

export const dynamic = "force-dynamic"

/** GET /api/dashboard/stats — статистика личного кабинета */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const userId = session.user.id

    const deliveryAccess = {
      OR: [
        { buyerId: userId },
        { partnerId: userId },
        { managerId: userId },
      ],
    }

    const [
      listings,
      favorites,
      reviews,
      garageVehicles,
      deliveryTotal,
      activeDeliveries,
      unreadMessages,
      unreadNotifications,
      promotionSummary,
      promotionOrders,
      listingTotals,
      listingsByStatus,
      activePromotions,
      favoritesCount,
    ] = await Promise.all([
      prisma.listing.findMany({
        where: { userId },
        include: {
          vehicle: { select: { id: true, make: true, model: true, year: true, price: true, mileage: true, images: true, location: true, vehicleType: true, bodyType: true } },
          part: { select: { id: true, name: true, price: true, images: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          createdAt: true,
          favoriteListings: { take: 10, orderBy: { createdAt: "desc" }, include: { vehicle: { select: { id: true, make: true, model: true, year: true, price: true, images: true, mileage: true, vehicleType: true, bodyType: true } } } },
        },
      }),
      prisma.review.aggregate({
        where: { userId },
        _count: true,
        _avg: { rating: true },
      }),
      prisma.vehicle.count({ where: { userId, category: { name: "Личный гараж" } } }),
      prisma.deliveryOrder.count({ where: deliveryAccess }),
      prisma.deliveryOrder.count({
        where: {
          AND: [deliveryAccess, { status: { notIn: ["COMPLETED", "CANCELED"] } }],
        },
      }),
      prisma.message.count({ where: { receiverId: userId, isRead: false } }),
      prisma.notification.count({ where: { userId, isRead: false } }),
      prisma.promotionOrder.aggregate({
        where: { userId, status: "PAID" },
        _count: true,
        _sum: { amountRub: true },
      }),
      prisma.promotionOrder.findMany({
        where: { userId },
        select: {
          id: true,
          tariffId: true,
          amountRub: true,
          durationDays: true,
          status: true,
          provider: true,
          promoUntil: true,
          paidAt: true,
          createdAt: true,
          listing: { select: { id: true, title: true, status: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      /* Сводки считает база, а не перебор всех объявлений в памяти.

         Кабинет показывает десять последних объявлений, но общее их
         число, сумма просмотров и разбивка по статусам нужны по всем.
         Раньше ради этого выбирались все объявления со связями. */
      prisma.listing.aggregate({
        where: { userId },
        _count: true,
        _sum: { views: true },
      }),
      prisma.listing.groupBy({
        by: ["status"],
        where: { userId },
        _count: true,
      }),
      prisma.listing.count({
        where: { userId, promoUntil: { gt: new Date() } },
      }),
      /* Число избранного считается запросом, а не по выборке.

         Выше избранное берётся с `take: 10` — для показа в кабинете, — и
         счётчик, построенный на длине этой выборки, у человека с
         пятьюдесятью сохранёнными объявлениями показывал десять. */
      prisma.listing.count({
        where: { favoritedBy: { some: { id: userId } } },
      }),
    ])

    const countByStatus = Object.fromEntries(
      listingsByStatus.map((row) => [row.status, row._count]),
    ) as Record<string, number>

    const totalViews = listingTotals._sum.views ?? 0
    const workflow = {
      drafts: countByStatus[LISTING_STATUS.DRAFT] || 0,
      pendingModeration: countByStatus[LISTING_STATUS.PENDING_MODERATION] || 0,
      active: countByStatus[LISTING_STATUS.ACTIVE] || 0,
      needsAttention: (countByStatus[LISTING_STATUS.REJECTED] || 0) + (countByStatus[LISTING_STATUS.PAUSED] || 0),
    }

    const partnerAccess = await checkPartnerAccess(userId, session.user.role)

    return NextResponse.json({
      stats: {
        totalListings: listingTotals._count,
        totalViews,
        favoritesCount,
        reviewsCount: reviews._count,
        garageCount: garageVehicles,
        avgRating: reviews._avg.rating ? Math.round(reviews._avg.rating * 10) / 10 : 0,
        memberSince: favorites?.createdAt ?? null,
        deliveryTotal,
        activeDeliveries,
        unreadMessages,
        unreadNotifications,
        promotionPaidCount: promotionSummary._count,
        promotionSpentRub: promotionSummary._sum.amountRub ?? 0,
        activePromotions,
      },
      workflow,
      listings: listings.map((l) => ({
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
      promotionOrders,
      // Меню кабинета показывало партнёрские разделы всем подряд, поэтому
      // обычный продавец открывал магазин и упирался в отказ доступа.
      // Статус приходит вместе со статистикой, чтобы не звать отдельный запрос
      // на каждой странице.
      partnerAccess,
    })
  } catch (error) {
    console.error("Dashboard stats error:", error)
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 })
  }
}
