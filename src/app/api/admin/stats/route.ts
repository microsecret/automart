import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { AUCTION_SOURCE_OPTIONS, AUCTION_SOURCE_PIPELINES, auctionSourceCountry } from "@/lib/auction-sources"
import { sourceProxyPoolStatus } from "@/lib/authorized-source-http"

export const dynamic = "force-dynamic"

type DailyTrafficPoint = {
  date: string
  visits: number
  uniqueVisitors: number
  registrations: number
}

type TrafficEvent = {
  createdAt: Date
  visitorKey: string | null
  sessionKey: string | null
  ipHash: string | null
}

function utcDayKey(value: Date) {
  return value.toISOString().slice(0, 10)
}

function visitorIdentity(event: Pick<TrafficEvent, "visitorKey" | "sessionKey" | "ipHash">) {
  if (event.visitorKey) return `visitor:${event.visitorKey}`
  if (event.sessionKey) return `legacy-session:${event.sessionKey}`
  return event.ipHash ? `ip:${event.ipHash}` : null
}

function countByDimension(values: Array<string | null>) {
  const counts = new Map<string, number>()
  for (const value of values) counts.set(value || "UNKNOWN", (counts.get(value || "UNKNOWN") || 0) + 1)
  return [...counts.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count)
}

function createDailyTraffic(events: TrafficEvent[], users: Array<{ createdAt: Date }>, start: Date): DailyTrafficPoint[] {
  const points = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start)
    date.setUTCDate(start.getUTCDate() + index)
    return { date: utcDayKey(date), visits: 0, uniqueVisitors: 0, registrations: 0, visitorKeys: new Set<string>() }
  })
  const byDate = new Map(points.map((point) => [point.date, point]))

  for (const event of events) {
    const point = byDate.get(utcDayKey(event.createdAt))
    if (point) {
      point.visits += 1
      const identity = visitorIdentity(event)
      if (identity) point.visitorKeys.add(identity)
    }
  }
  for (const user of users) {
    const point = byDate.get(utcDayKey(user.createdAt))
    if (point) point.registrations += 1
  }
  return points.map(({ visitorKeys, ...point }) => ({ ...point, uniqueVisitors: visitorKeys.size }))
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const [
      users, vehicles, parts, listings, reviews, messages, notifications,
      categories, sessions, aiLogs, supportTickets,
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
      prisma.supportTicket.count(),
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
    const dailyTrafficStart = new Date()
    dailyTrafficStart.setUTCHours(0, 0, 0, 0)
    dailyTrafficStart.setUTCDate(dailyTrafficStart.getUTCDate() - 6)
    const [visits24h, visits7d, topPaths, recentVisitors, trafficEvents7d, dailyRegistrations, pendingListings, openReports, newAuctionInquiries, activeAuctionInquiries, pendingDeliveryOrganizations, openSupportTickets, waitingSupportTickets, activeSupportTickets, latestAuctionSyncRuns, sourceSyncRuns] = await Promise.all([
      prisma.visitEvent.count({ where: { createdAt: { gte: dayAgo } } }),
      prisma.visitEvent.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.visitEvent.groupBy({ by: ["path"], where: { createdAt: { gte: weekAgo } }, _count: { path: true }, orderBy: { _count: { path: "desc" } }, take: 8 }),
      prisma.visitEvent.findMany({ where: { createdAt: { gte: weekAgo }, userId: { not: null } }, orderBy: { createdAt: "desc" }, take: 10, include: { user: { select: { id: true, name: true, email: true, telegramUsername: true } } } }),
      prisma.visitEvent.findMany({
        where: { createdAt: { gte: weekAgo } },
        select: { createdAt: true, visitorKey: true, sessionKey: true, ipHash: true, userId: true, deviceType: true, trafficSource: true },
      }),
      prisma.user.findMany({ where: { createdAt: { gte: dailyTrafficStart } }, select: { id: true, createdAt: true } }),
      prisma.listing.count({ where: { status: "PENDING_MODERATION", deletedAt: null } }),
      prisma.listingReport.count({ where: { status: { in: ["OPEN", "IN_REVIEW"] } } }),
      prisma.auctionInquiry.count({ where: { status: "NEW" } }),
      prisma.auctionInquiry.count({ where: { status: { in: ["CONTACTED", "IN_PROGRESS"] } } }),
      prisma.deliveryOrganization.count({ where: { verificationStatus: "PENDING" } }),
      prisma.supportTicket.count({ where: { status: { not: "CLOSED" } } }),
      prisma.supportTicket.count({ where: { status: "WAITING_OPERATOR" } }),
      prisma.supportTicket.count({ where: { status: "IN_PROGRESS" } }),
      prisma.auctionSyncRun.findMany({
        orderBy: { startedAt: "desc" },
        take: 5,
        select: {
          id: true,
          source: true,
          syncKind: true,
          status: true,
          discovered: true,
          imported: true,
          created: true,
          updated: true,
          failed: true,
          skippedByPolicy: true,
          excludedByPolicy: true,
          expired: true,
          startedAt: true,
          completedAt: true,
          error: true,
        },
      }),
      prisma.auctionSyncRun.findMany({
        orderBy: { startedAt: "desc" },
        take: 100,
        select: { source: true, status: true, startedAt: true },
      }),
    ])

    const uniqueVisitors7d = new Set(trafficEvents7d.map(visitorIdentity).filter((value): value is string => Boolean(value))).size
    const uniqueVisitors24h = new Set(trafficEvents7d.filter((event) => event.createdAt >= dayAgo).map(visitorIdentity).filter((value): value is string => Boolean(value))).size
    const sessions7d = new Set(trafficEvents7d.map((event) => event.sessionKey).filter((value): value is string => Boolean(value))).size
    const authenticatedVisitors7d = new Set(trafficEvents7d.map((event) => event.userId).filter((value): value is string => Boolean(value))).size
    const newRegistrationIds7d = new Set(dailyRegistrations.filter((user) => user.createdAt >= weekAgo).map((user) => user.id))
    const attributedRegistrations7d = new Set(
      trafficEvents7d
        .map((event) => event.userId)
        .filter((value): value is string => typeof value === "string" && newRegistrationIds7d.has(value)),
    ).size
    const pagesPerVisitor7d = uniqueVisitors7d ? Math.round(visits7d / uniqueVisitors7d * 10) / 10 : 0
    const registrationConversion7d = uniqueVisitors7d ? Math.round(attributedRegistrations7d / uniqueVisitors7d * 1_000) / 10 : 0

    // Featured
    const featured = await prisma.listing.count({ where: { isFeatured: true } })

    const now = new Date()
    const [revenue, paidOrders, pendingOrders, reviewRequiredOrders, activePromotions, revenueByTariff, recentPromotionOrders] = await Promise.all([
      prisma.promotionOrder.aggregate({ where: { status: "PAID" }, _sum: { amountRub: true } }),
      prisma.promotionOrder.count({ where: { status: "PAID" } }),
      prisma.promotionOrder.count({ where: { status: "PENDING" } }),
      prisma.promotionOrder.count({ where: { status: "REVIEW_REQUIRED" } }),
      prisma.listing.count({ where: { promoType: { not: null }, promoUntil: { gt: now }, status: "ACTIVE", deletedAt: null } }),
      prisma.promotionOrder.groupBy({
        by: ["tariffId"],
        where: { status: "PAID" },
        _count: true,
        _sum: { amountRub: true },
        orderBy: { _sum: { amountRub: "desc" } },
      }),
      prisma.promotionOrder.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          tariffId: true,
          amountRub: true,
          status: true,
          provider: true,
          createdAt: true,
          paidAt: true,
          listing: { select: { id: true, title: true } },
          user: { select: { id: true, name: true, email: true } },
        },
      }),
    ])

    // Средняя цена
    const avgPriceResult = await prisma.listing.aggregate({ _avg: { price: true } })
    const avgPrice = Math.round(avgPriceResult._avg.price || 0)
    const latestSyncBySource = new Map<string, { status: string; startedAt: Date }>()
    for (const run of sourceSyncRuns) {
      if (!latestSyncBySource.has(run.source)) latestSyncBySource.set(run.source, run)
    }
    const sourceCoverage = AUCTION_SOURCE_OPTIONS.map((source) => {
      const pipeline = AUCTION_SOURCE_PIPELINES[source.value]
      const latest = latestSyncBySource.get(source.value)
      return {
        source: source.value,
        label: source.label,
        country: auctionSourceCountry(source.value),
        pipeline: pipeline?.pipeline || "PARTNER_FEED",
        pipelineLabel: pipeline?.label || "Защищённый партнёрский feed",
        lastStatus: latest?.status || null,
        lastSyncAt: latest?.startedAt || null,
      }
    })

    return NextResponse.json({
      counts: { users, vehicles, parts, listings, reviews, messages, notifications, categories, sessions, aiLogs, supportTickets },
      byVehicleType: byVehicleType.reduce((a, r) => { a[r.vehicleType] = r._count; return a }, {} as Record<string, number>),
      byRole: byRole.reduce((a, r) => { a[r.role] = r._count; return a }, {} as Record<string, number>),
      recent: { newListings, newUsers },
      featured,
      avgPrice,
      monetization: {
        provider: "STRIPE",
        paymentsConfigured: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET),
        safeDealConfigured: Boolean(process.env.YOOKASSA_SHOP_ID && process.env.YOOKASSA_SECRET_KEY),
        confirmedRevenueRub: revenue._sum.amountRub || 0,
        paidOrders,
        pendingOrders,
        reviewRequiredOrders,
        activePromotions,
        byTariff: revenueByTariff.map((item) => ({
          tariffId: item.tariffId,
          count: item._count,
          revenueRub: item._sum.amountRub || 0,
        })),
        recentOrders: recentPromotionOrders,
      },
      traffic: {
        visits24h,
        visits7d,
        pageViews24h: visits24h,
        pageViews7d: visits7d,
        uniqueVisitors24h,
        uniqueVisitors7d,
        sessions7d,
        authenticatedVisitors7d,
        attributedRegistrations7d,
        pagesPerVisitor7d,
        registrationConversion7d,
        daily: createDailyTraffic(trafficEvents7d, dailyRegistrations, dailyTrafficStart),
        devices: countByDimension(trafficEvents7d.map((event) => event.deviceType)),
        sources: countByDimension(trafficEvents7d.map((event) => event.trafficSource)),
        topPaths: topPaths.map((item) => ({ path: item.path, count: item._count.path })),
        recentVisitors: recentVisitors.map((visit) => ({
          id: visit.id,
          createdAt: visit.createdAt,
          user: visit.user,
        })),
      },
      operations: {
        pendingListings,
        openReports,
        newAuctionInquiries,
        activeAuctionInquiries,
        pendingDeliveryOrganizations,
        openSupportTickets,
        waitingSupportTickets,
        activeSupportTickets,
      },
      auctionSyncRuns: latestAuctionSyncRuns,
      sourceCoverage,
      sourceTransport: sourceProxyPoolStatus(),
    })
  } catch (error) {
    console.error("Admin stats error:", error)
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 })
  }
}
