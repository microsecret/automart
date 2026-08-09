import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const [
      users, vehicles, parts, listings, reviews, messages, notifications,
      categories, sessions, aiLogs,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.vehicle.count(),
      prisma.part.count(),
      prisma.listing.count(),
      prisma.review.count(),
      prisma.message.count(),
      prisma.notification.count(),
      prisma.category.count(),
      prisma.session.count(),
      prisma.aIServiceLog.count(),
    ])

    // Статистика по типам транспорта
    const byVehicleType = await prisma.vehicle.groupBy({
      by: ["vehicleType"],
      _count: true,
    })

    // По ролям
    const byRole = await prisma.user.groupBy({
      by: ["role"],
      _count: true,
    })

    // Новые за 7 дней
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const newListings = await prisma.listing.count({ where: { createdAt: { gte: weekAgo } } })
    const newUsers = await prisma.user.count({ where: { createdAt: { gte: weekAgo } } })

    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const [visits24h, visits7d, uniqueSessions7d, topPaths, recentVisitors] = await Promise.all([
      prisma.visitEvent.count({ where: { createdAt: { gte: dayAgo } } }),
      prisma.visitEvent.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.visitEvent.findMany({ where: { createdAt: { gte: weekAgo }, sessionKey: { not: null } }, select: { sessionKey: true }, distinct: ["sessionKey"] }),
      prisma.visitEvent.groupBy({ by: ["path"], where: { createdAt: { gte: weekAgo } }, _count: { path: true }, orderBy: { _count: { path: "desc" } }, take: 8 }),
      prisma.visitEvent.findMany({ where: { createdAt: { gte: weekAgo }, userId: { not: null } }, orderBy: { createdAt: "desc" }, take: 10, include: { user: { select: { id: true, name: true, email: true, telegramUsername: true } } } }),
    ])

    // Featured
    const featured = await prisma.listing.count({ where: { isFeatured: true } })

    // Средняя цена
    const avgPriceResult = await prisma.listing.aggregate({ _avg: { price: true } })
    const avgPrice = Math.round(avgPriceResult._avg.price || 0)

    return NextResponse.json({
      counts: { users, vehicles, parts, listings, reviews, messages, notifications, categories, sessions, aiLogs },
      byVehicleType: byVehicleType.reduce((a, r) => { a[r.vehicleType] = r._count; return a }, {} as Record<string, number>),
      byRole: byRole.reduce((a, r) => { a[r.role] = r._count; return a }, {} as Record<string, number>),
      recent: { newListings, newUsers },
      featured,
      avgPrice,
      traffic: {
        visits24h,
        visits7d,
        uniqueVisitors7d: uniqueSessions7d.length,
        topPaths: topPaths.map((item) => ({ path: item.path, count: item._count.path })),
        recentVisitors: recentVisitors.map((visit) => ({
          id: visit.id,
          createdAt: visit.createdAt,
          user: visit.user,
        })),
      },
    })
  } catch (error) {
    console.error("Admin stats error:", error)
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 })
  }
}
