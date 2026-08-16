import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { AUCTION_SOURCE_OPTIONS, AUCTION_SOURCE_PIPELINES, auctionSourceCountry } from "@/lib/auction-sources"
import { sourceProxyPoolStatus } from "@/lib/authorized-source-http"
import { percentageChange, trafficVisitorIdentity } from "@/lib/analytics-identity"
import { configuredPartnerAuctionFeeds } from "@/lib/partner-auction-feeds"

export const dynamic = "force-dynamic"

type DailyTrafficPoint = {
  date: string
  pageViews: number
  uniqueVisitors: number
  registrations: number
  newListings: number
}

type TrafficEvent = {
  createdAt: Date
  visitorKey: string | null
  sessionKey: string | null
  ipHash: string | null
  userId?: string | null
  deviceType?: string | null
  trafficSource?: string | null
}

function utcDayKey(value: Date) {
  return value.toISOString().slice(0, 10)
}

function countUniqueByDimension(events: TrafficEvent[], key: "deviceType" | "trafficSource") {
  const identities = new Map<string, Set<string>>()
  for (const event of events) {
    const identity = trafficVisitorIdentity(event)
    if (!identity) continue
    const dimension = event[key] || "UNKNOWN"
    const values = identities.get(dimension) || new Set<string>()
    values.add(identity)
    identities.set(dimension, values)
  }
  return [...identities.entries()].map(([dimension, values]) => ({ key: dimension, count: values.size })).sort((a, b) => b.count - a.count)
}

function createDailyTraffic(events: TrafficEvent[], users: Array<{ createdAt: Date }>, listings: Array<{ createdAt: Date }>, start: Date): DailyTrafficPoint[] {
  const points = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start)
    date.setUTCDate(start.getUTCDate() + index)
    return { date: utcDayKey(date), pageViews: 0, uniqueVisitors: 0, registrations: 0, newListings: 0, visitorKeys: new Set<string>() }
  })
  const byDate = new Map(points.map((point) => [point.date, point]))

  for (const event of events) {
    const point = byDate.get(utcDayKey(event.createdAt))
    if (point) {
      point.pageViews += 1
      const identity = trafficVisitorIdentity(event)
      if (identity) point.visitorKeys.add(identity)
    }
  }
  for (const user of users) {
    const point = byDate.get(utcDayKey(user.createdAt))
    if (point) point.registrations += 1
  }
  for (const listing of listings) {
    const point = byDate.get(utcDayKey(listing.createdAt))
    if (point) point.newListings += 1
  }
  return points.map(({ visitorKeys, ...point }) => ({ ...point, uniqueVisitors: visitorKeys.size }))
}

function createDailyListingViews(events: Array<{ createdAt: Date; ipHash: string }>, start: Date) {
  const points = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start)
    date.setUTCDate(start.getUTCDate() + index)
    return { date: utcDayKey(date), views: 0, uniqueViewers: 0, viewerKeys: new Set<string>() }
  })
  const byDate = new Map(points.map((point) => [point.date, point]))
  for (const event of events) {
    const point = byDate.get(utcDayKey(event.createdAt))
    if (!point) continue
    point.views += 1
    point.viewerKeys.add(event.ipHash)
  }
  return points.map(({ viewerKeys, ...point }) => ({ ...point, uniqueViewers: viewerKeys.size }))
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

    const now = new Date()
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const previousWeekStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const newListings = await prisma.listing.count({ where: { createdAt: { gte: weekAgo } } })
    const newUsers = await prisma.user.count({ where: { createdAt: { gte: weekAgo } } })

    const dailyTrafficStart = new Date()
    dailyTrafficStart.setUTCHours(0, 0, 0, 0)
    dailyTrafficStart.setUTCDate(dailyTrafficStart.getUTCDate() - 6)
    const [topPaths, recentVisitorEvents, trafficEvents30d, dailyRegistrations, pendingListings, openReports, newAuctionInquiries, activeAuctionInquiries, pendingDeliveryOrganizations, openSupportTickets, waitingSupportTickets, activeSupportTickets, latestAuctionSyncRuns, sourceSyncRuns, listingInventory, listingViewEvents14d, listingMessages7d, soldListings7d, topListingViewGroups] = await Promise.all([
      prisma.visitEvent.groupBy({ by: ["path"], where: { createdAt: { gte: weekAgo } }, _count: { path: true }, orderBy: { _count: { path: "desc" } }, take: 8 }),
      prisma.visitEvent.findMany({ where: { createdAt: { gte: weekAgo }, userId: { not: null } }, orderBy: { createdAt: "desc" }, take: 50, include: { user: { select: { id: true, name: true, email: true, telegramUsername: true } } } }),
      prisma.visitEvent.findMany({
        where: { createdAt: { gte: monthAgo } },
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
      prisma.listing.findMany({
        where: { deletedAt: null },
        select: { id: true, title: true, status: true, views: true, vehicleId: true, partId: true, createdAt: true, publishedAt: true, _count: { select: { favoritedBy: true } } },
      }),
      prisma.listingViewEvent.findMany({
        where: { createdAt: { gte: previousWeekStart } },
        select: { listingId: true, ipHash: true, createdAt: true },
      }),
      prisma.message.count({ where: { listingId: { not: null }, createdAt: { gte: weekAgo } } }),
      prisma.listingStatusEvent.count({ where: { toStatus: "SOLD", createdAt: { gte: weekAgo } } }),
      prisma.listingViewEvent.groupBy({
        by: ["listingId"],
        where: { createdAt: { gte: weekAgo } },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 5,
      }),
    ])

    const trafficEvents7d = trafficEvents30d.filter((event) => event.createdAt >= weekAgo)
    const previousTrafficEvents7d = trafficEvents30d.filter((event) => event.createdAt >= previousWeekStart && event.createdAt < weekAgo)
    const pageViews24h = trafficEvents7d.filter((event) => event.createdAt >= dayAgo).length
    const pageViews7d = trafficEvents7d.length
    const pageViews30d = trafficEvents30d.length
    const visitorSet = (events: TrafficEvent[]) => new Set(events.map(trafficVisitorIdentity).filter((value): value is string => Boolean(value)))
    const uniqueVisitors7dSet = visitorSet(trafficEvents7d)
    const previousUniqueVisitors7dSet = visitorSet(previousTrafficEvents7d)
    const historicalVisitorSet = visitorSet(trafficEvents30d.filter((event) => event.createdAt < weekAgo))
    const uniqueVisitors7d = uniqueVisitors7dSet.size
    const uniqueVisitors24h = visitorSet(trafficEvents7d.filter((event) => event.createdAt >= dayAgo)).size
    const uniqueVisitors30d = visitorSet(trafficEvents30d).size
    const returningVisitors7d = [...uniqueVisitors7dSet].filter((identity) => historicalVisitorSet.has(identity)).length
    const newVisitors7d = uniqueVisitors7d - returningVisitors7d
    const sessions7d = new Set(trafficEvents7d.map((event) => event.sessionKey).filter((value): value is string => Boolean(value))).size
    const sessionViews = new Map<string, number>()
    for (const event of trafficEvents7d) if (event.sessionKey) sessionViews.set(event.sessionKey, (sessionViews.get(event.sessionKey) || 0) + 1)
    const bounceRate7d = sessionViews.size
      ? Math.round(([...sessionViews.values()].filter((count) => count === 1).length / sessionViews.size) * 1_000) / 10
      : 0
    const authenticatedVisitors7d = new Set(trafficEvents7d.map((event) => event.userId).filter((value): value is string => Boolean(value))).size
    const newRegistrationIds7d = new Set(dailyRegistrations.filter((user) => user.createdAt >= weekAgo).map((user) => user.id))
    const attributedRegistrations7d = new Set(
      trafficEvents7d
        .map((event) => event.userId)
        .filter((value): value is string => typeof value === "string" && newRegistrationIds7d.has(value)),
    ).size
    const pagesPerVisitor7d = uniqueVisitors7d ? Math.round(pageViews7d / uniqueVisitors7d * 10) / 10 : 0
    const registrationConversion7d = uniqueVisitors7d ? Math.min(100, Math.round(attributedRegistrations7d / uniqueVisitors7d * 1_000) / 10) : 0
    const recentVisitors = recentVisitorEvents.filter((visit, index, values) => visit.userId && values.findIndex((candidate) => candidate.userId === visit.userId) === index).slice(0, 10)

    const listingViews7d = listingViewEvents14d.filter((event) => event.createdAt >= weekAgo)
    const previousListingViews7d = listingViewEvents14d.filter((event) => event.createdAt < weekAgo)
    const listingStatusCounts = listingInventory.reduce<Record<string, number>>((counts, listing) => {
      counts[listing.status] = (counts[listing.status] || 0) + 1
      return counts
    }, {})
    const listingUniqueViewers7d = new Set(listingViews7d.map((event) => event.ipHash)).size
    const listingDetails = new Map(listingInventory.map((listing) => [listing.id, listing]))
    const topListings = topListingViewGroups.map((group) => {
      const listing = listingDetails.get(group.listingId)
      const events = listingViews7d.filter((event) => event.listingId === group.listingId)
      return {
        id: group.listingId,
        href: listing?.vehicleId ? `/listings/vehicle/${listing.vehicleId}` : listing?.partId ? `/listings/part/${listing.partId}` : null,
        title: listing?.title || "Удалённое объявление",
        status: listing?.status || "ARCHIVED",
        views7d: group._count.id,
        uniqueViewers7d: new Set(events.map((event) => event.ipHash)).size,
        favorites: listing?._count.favoritedBy || 0,
      }
    })

    // Featured
    const featured = await prisma.listing.count({ where: { isFeatured: true } })

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
    let configuredFeeds = new Set<string>()
    let partnerFeedConfigurationValid = true
    try {
      configuredFeeds = new Set(configuredPartnerAuctionFeeds().map((feed) => feed.source))
    } catch {
      partnerFeedConfigurationValid = false
    }
    const sourceCoverage = AUCTION_SOURCE_OPTIONS.map((source) => {
      const pipeline = AUCTION_SOURCE_PIPELINES[source.value]
      const latest = latestSyncBySource.get(source.value)
      const configured = source.value === "ENCAR" || source.value === "KCAR"
        || configuredFeeds.has(source.value)
        || (source.value === "MOBILE_DE" && Boolean(process.env.MOBILE_DE_API_USERNAME && process.env.MOBILE_DE_API_PASSWORD))
      return {
        source: source.value,
        label: source.label,
        country: auctionSourceCountry(source.value),
        pipeline: pipeline?.pipeline || "PARTNER_FEED",
        pipelineLabel: pipeline?.label || "Защищённый партнёрский feed",
        configured,
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
        pageViews24h,
        pageViews7d,
        pageViews30d,
        uniqueVisitors24h,
        uniqueVisitors7d,
        uniqueVisitors30d,
        pageViewsTrend7d: percentageChange(pageViews7d, previousTrafficEvents7d.length),
        uniqueVisitorsTrend7d: percentageChange(uniqueVisitors7d, previousUniqueVisitors7dSet.size),
        returningVisitors7d,
        newVisitors7d,
        sessions7d,
        bounceRate7d,
        authenticatedVisitors7d,
        attributedRegistrations7d,
        pagesPerVisitor7d,
        registrationConversion7d,
        daily: createDailyTraffic(trafficEvents7d, dailyRegistrations, listingInventory, dailyTrafficStart),
        devices: countUniqueByDimension(trafficEvents7d, "deviceType"),
        sources: countUniqueByDimension(trafficEvents7d, "trafficSource"),
        topPaths: topPaths.map((item) => ({ path: item.path, count: item._count.path })),
        recentVisitors: recentVisitors.map((visit) => ({
          id: visit.id,
          createdAt: visit.createdAt,
          user: visit.user,
        })),
      },
      listingPerformance: {
        statusCounts: listingStatusCounts,
        active: listingStatusCounts.ACTIVE || 0,
        pending: listingStatusCounts.PENDING_MODERATION || 0,
        sold: listingStatusCounts.SOLD || 0,
        published7d: listingInventory.filter((listing) => listing.publishedAt && listing.publishedAt >= weekAgo).length,
        sold7d: soldListings7d,
        totalViews: listingInventory.reduce((sum, listing) => sum + listing.views, 0),
        views7d: listingViews7d.length,
        uniqueViewers7d: listingUniqueViewers7d,
        viewsTrend7d: percentageChange(listingViews7d.length, previousListingViews7d.length),
        favorites: listingInventory.reduce((sum, listing) => sum + listing._count.favoritedBy, 0),
        messageLeads7d: listingMessages7d,
        leadConversion7d: listingViews7d.length ? Math.min(100, Math.round((listingMessages7d / listingViews7d.length) * 1_000) / 10) : 0,
        daily: createDailyListingViews(listingViews7d, dailyTrafficStart),
        topListings,
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
      partnerFeedConfigurationValid,
    })
  } catch (error) {
    console.error("Admin stats error:", error)
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 })
  }
}
