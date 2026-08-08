import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "../../auth/[...nextauth]/route"
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
    })
  } catch (error) {
    console.error("Admin stats error:", error)
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 })
  }
}
