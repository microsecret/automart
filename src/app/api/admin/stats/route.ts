import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { hoursSince } from "@/lib/queue-age"
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
    const [topPaths, recentVisitorEvents, trafficEvents30d, dailyRegistrations, pendingListings, openReports, newAuctionInquiries, activeAuctionInquiries, pendingDeliveryOrganizations, openSupportTickets, waitingSupportTickets, activeSupportTickets, oldestPendingListing, oldestOpenReport, oldestNewInquiry, oldestActiveInquiry, oldestPendingPartner, oldestWaitingTicket, stuckPayments, oldestStuckPayment, latestAuctionSyncRuns, sourceSyncRuns, listingInventory, listingViewEvents14d, listingMessages7d, soldListings7d, topListingViewGroups] = await Promise.all([
      prisma.visitEvent.groupBy({ by: ["path"], where: { createdAt: { gte: weekAgo } }, _count: { path: true }, orderBy: { _count: { path: "desc" } }, take: 8 }),
      prisma.visitEvent.findMany({ where: { createdAt: { gte: weekAgo }, userId: { not: null } }, orderBy: { createdAt: "desc" }, take: 50, include: { user: { select: { id: true, name: true, email: true, telegramUsername: true } } } }),
      /* Месяц визитов читается целиком: уникальные посетители по дням
         считаются пересечением ключей, и группировкой на стороне базы это
         не выражается.

         Предел ставит потолок памяти. Сейчас в таблице около двух тысяч
         записей за месяц, но при тысяче посетителей в день их станет
         тридцать тысяч, а панель открывается на каждой загрузке админки.
         Свежие события важнее старых: при упоре в предел цифры за
         последние дни останутся точными, а за начало месяца — занизятся.

         Правильное решение — почасовые сводки вместо сырых событий; предел
         держит панель работоспособной, пока их нет. */
      prisma.visitEvent.findMany({
        where: { createdAt: { gte: monthAgo } },
        orderBy: { createdAt: "desc" },
        take: 50_000,
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
      /* Возраст самой старой задачи в каждой очереди.

         Счётчик без возраста не отвечает на главный вопрос: три задачи
         возрастом двадцать минут и три, лежащие пятый день, выглядели
         одинаково. `_min` по дате — самый дешёвый способ узнать, сколько
         ждёт самая старая. */
      prisma.listing.aggregate({
        where: { status: "PENDING_MODERATION", deletedAt: null },
        _min: { createdAt: true },
      }),
      prisma.listingReport.aggregate({
        where: { status: { in: ["OPEN", "IN_REVIEW"] } },
        _min: { createdAt: true },
      }),
      prisma.auctionInquiry.aggregate({
        where: { status: "NEW" },
        _min: { createdAt: true },
      }),
      prisma.auctionInquiry.aggregate({
        where: { status: { in: ["CONTACTED", "IN_PROGRESS"] } },
        _min: { createdAt: true },
      }),
      prisma.deliveryOrganization.aggregate({
        where: { verificationStatus: "PENDING" },
        _min: { createdAt: true },
      }),
      prisma.supportTicket.aggregate({
        where: { status: "WAITING_OPERATOR" },
        // Для тикета важна не дата создания, а сколько человек ждёт ответа
        // после своего последнего сообщения.
        _min: { lastMessageAt: true },
      }),
      /* Оплаченное продвижение, которое не действует.

         Деньги получены, а услуга не оказана: заказ отмечен оплаченным,
         но срок продвижения не проставлен или уже прошёл, а объявление
         не продвигается. Такой платёж никто не заметит — раздела
         платежей в панели нет, — и продавец останется без услуги, за
         которую заплатил.

         Пока покупок продвижения не было ни одной; проверка стоит
         заранее, чтобы первый же застрявший платёж не потерялся. */
      prisma.promotionOrder.count({
        where: {
          status: "PAID",
          OR: [{ promoUntil: null }, { promoUntil: { lt: new Date() } }],
        },
      }),
      prisma.promotionOrder.aggregate({
        where: {
          status: "PAID",
          OR: [{ promoUntil: null }, { promoUntil: { lt: new Date() } }],
        },
        _min: { paidAt: true },
      }),
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
    const telegramMiniAppEvents7d = trafficEvents7d.filter((event) => event.trafficSource === "UTM:TELEGRAM-MINI-APP")
    const telegramMiniAppVisitors24h = visitorSet(telegramMiniAppEvents7d.filter((event) => event.createdAt >= dayAgo)).size
    const telegramMiniAppVisitors7d = visitorSet(telegramMiniAppEvents7d).size
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
    // Надёжность источника видна только по серии прогонов: единичная ошибка
    // нормальна для публичного каталога, а устойчивая доля падений означает,
    // что площадка изменила разметку или начала блокировать сбор.
    const reliabilityWindowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const syncRunStats = await prisma.auctionSyncRun.groupBy({
      by: ["source", "status"],
      where: { startedAt: { gte: reliabilityWindowStart } },
      _count: { _all: true },
    })

    const reliabilityBySource = new Map<string, { succeeded: number; partial: number; failed: number }>()
    for (const row of syncRunStats) {
      const entry = reliabilityBySource.get(row.source) || { succeeded: 0, partial: 0, failed: 0 }
      if (row.status === "SUCCEEDED") entry.succeeded += row._count._all
      else if (row.status === "PARTIAL") entry.partial += row._count._all
      else if (row.status === "FAILED") entry.failed += row._count._all
      reliabilityBySource.set(row.source, entry)
    }

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
    // Матрица полноты полей: показывает, какие атрибуты источник реально
    // отдаёт. Ставится по фактическим лотам, поэтому «пустая» колонка означает
    // либо пробел в парсере, либо отсутствие поля у площадки.
    const QUALITY_FIELDS = [
      { key: "mileage", label: "Пробег" },
      { key: "engineVolume", label: "Двигатель" },
      { key: "power", label: "Мощность" },
      { key: "transmission", label: "КПП" },
      { key: "driveType", label: "Привод" },
      { key: "bodyType", label: "Кузов" },
      { key: "color", label: "Цвет" },
      { key: "vin", label: "VIN" },
      { key: "imageUrl", label: "Фото" },
      { key: "descriptionRu", label: "Описание RU" },
    ] as const

    const [sourceTotals, sourceQuarantined, ...sourceFieldCounts] = await Promise.all([
      prisma.auctionListing.groupBy({ by: ["source"], _count: { _all: true } }),
      prisma.auctionListing.groupBy({ by: ["source"], where: { adminHiddenAt: { not: null } }, _count: { _all: true } }),
      ...QUALITY_FIELDS.map((field) =>
        prisma.auctionListing.groupBy({
          by: ["source"],
          where: { [field.key]: { not: null } },
          _count: { _all: true },
        }),
      ),
    ])

    const totalBySource = new Map(sourceTotals.map((row) => [row.source, row._count._all]))
    const quarantinedBySource = new Map(sourceQuarantined.map((row) => [row.source, row._count._all]))
    const filledBySourceField = QUALITY_FIELDS.map((field, index) => ({
      field,
      counts: new Map(sourceFieldCounts[index].map((row) => [row.source, row._count._all])),
    }))

    const sourceFieldMatrix = AUCTION_SOURCE_OPTIONS.map((source) => {
      const total = totalBySource.get(source.value) || 0
      return {
        source: source.value,
        label: source.label,
        total,
        quarantined: quarantinedBySource.get(source.value) || 0,
        fields: filledBySourceField.map(({ field, counts }) => {
          const filled = counts.get(source.value) || 0
          return {
            key: field.key,
            label: field.label,
            filled,
            // Без лотов процент не считается: 0 из 0 — это «нет данных», а не
            // «источник ничего не отдаёт».
            percent: total > 0 ? Math.round((filled / total) * 100) : null,
          }
        }),
      }
    }).filter((row) => row.total > 0)

    const sourceCoverage = AUCTION_SOURCE_OPTIONS.map((source) => {
      const pipeline = AUCTION_SOURCE_PIPELINES[source.value]
      const latest = latestSyncBySource.get(source.value)
      const configured = source.value === "ENCAR" || source.value === "KCAR"
        || configuredFeeds.has(source.value)
        || (source.value === "MOBILE_DE" && Boolean(process.env.MOBILE_DE_API_USERNAME && process.env.MOBILE_DE_API_PASSWORD))
      const reliability = reliabilityBySource.get(source.value)
      const runs24h = reliability ? reliability.succeeded + reliability.partial + reliability.failed : 0
      return {
        source: source.value,
        label: source.label,
        country: auctionSourceCountry(source.value),
        pipeline: pipeline?.pipeline || "PARTNER_FEED",
        pipelineLabel: pipeline?.label || "Защищённый партнёрский feed",
        configured,
        lastStatus: latest?.status || null,
        lastSyncAt: latest?.startedAt || null,
        runs24h,
        failed24h: reliability?.failed || 0,
        partial24h: reliability?.partial || 0,
        // Доля успешных прогонов за сутки: она отвечает на вопрос «источник
        // работает?» точнее, чем статус последнего запуска.
        successRate24h: runs24h > 0 ? Math.round(((reliability?.succeeded || 0) / runs24h) * 100) : null,
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
        telegramMiniAppVisitors24h,
        telegramMiniAppVisitors7d,
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
        stuckPayments,
        /* Возраст самой старой задачи в каждой очереди, часы.

           Счётчик отвечает «сколько», возраст — «что горит». Без него три
           задачи возрастом двадцать минут выглядели так же, как три,
           лежащие пятый день. */
        oldest: {
          pendingListings: hoursSince(oldestPendingListing._min.createdAt),
          openReports: hoursSince(oldestOpenReport._min.createdAt),
          newAuctionInquiries: hoursSince(oldestNewInquiry._min.createdAt),
          activeAuctionInquiries: hoursSince(oldestActiveInquiry._min.createdAt),
          pendingDeliveryOrganizations: hoursSince(oldestPendingPartner._min.createdAt),
          waitingSupportTickets: hoursSince(oldestWaitingTicket._min.lastMessageAt),
          stuckPayments: hoursSince(oldestStuckPayment._min.paidAt),
        },
      },
      auctionSyncRuns: latestAuctionSyncRuns,
      sourceCoverage,
      sourceFieldMatrix,
      sourceTransport: sourceProxyPoolStatus(),
      partnerFeedConfigurationValid,
    })
  } catch (error) {
    console.error("Admin stats error:", error)
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 })
  }
}
