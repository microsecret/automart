import { NextResponse } from "next/server"
import { requireAdminSession, runAdminRoute } from "@/lib/admin-route-guard"
import { prisma } from "@/lib/prisma"
import { refreshDueCutoff, refreshIntervalHours } from "@/lib/auction-crawl-policy"
import { QUALITY_HOLD_PREFIX } from "@/lib/auction-quality"
import { auctionSourceCountry, auctionSourceLabel } from "@/lib/auction-sources"
import { deriveAuctionSourceRunHealth } from "@/lib/auction-source-health"

export const dynamic = "force-dynamic"

export async function GET() {
  /* Роль сравнивалась строкой напрямую, в обход нормализации из
     permissions.ts: на тех же данных маршрут вёл себя иначе, чем соседние.
     Теперь проверка общая. */
  const guard = await requireAdminSession()
  if (guard.denied) return guard.denied

  return runAdminRoute("Статистика аукционов", async () => {
    const now = new Date()
    const [
      byStatus, total, totalAuctions, visibleAuctions, latestAuctionCheck, recent,
      activeBySource, pendingRemovalBySource, qualityHoldBySource, latestSeenBySource, recentSyncRuns,
    ] = await Promise.all([
      prisma.auctionInquiry.groupBy({ by: ["status"], _count: true }),
      prisma.auctionInquiry.count(),
      prisma.auctionListing.count({ where: { status: "ACTIVE" } }),
      prisma.auctionListing.count({ where: { status: "ACTIVE", adminHiddenAt: null, OR: [{ auctionDate: null }, { auctionDate: { gte: now } }] } }),
      prisma.auctionListing.aggregate({ _max: { sourceLastSeenAt: true } }),
      prisma.auctionInquiry.count({ where: { createdAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } } }),
      prisma.auctionListing.groupBy({
        by: ["source"],
        where: { status: "ACTIVE", adminHiddenAt: null },
        _count: { _all: true },
      }),
      prisma.auctionListing.groupBy({
        by: ["source"],
        where: { status: "ACTIVE", adminHiddenAt: null, sourceMissingChecks: { gte: 1 } },
        _count: { _all: true },
      }),
      prisma.auctionListing.groupBy({
        by: ["source"],
        where: { status: "POLICY_EXCLUDED", adminHiddenReason: { startsWith: QUALITY_HOLD_PREFIX } },
        _count: { _all: true },
      }),
      prisma.auctionListing.groupBy({
        by: ["source"],
        _max: { sourceLastSeenAt: true },
      }),
      prisma.auctionSyncRun.findMany({
        orderBy: { startedAt: "desc" },
        take: 250,
        select: {
          source: true,
          syncKind: true,
          status: true,
          startedAt: true,
          completedAt: true,
          error: true,
        },
      }),
    ])

    const activeCounts = new Map(activeBySource.map((row) => [row.source, row._count._all]))
    const pendingCounts = new Map(pendingRemovalBySource.map((row) => [row.source, row._count._all]))
    const qualityHoldCounts = new Map(qualityHoldBySource.map((row) => [row.source, row._count._all]))
    const latestSeen = new Map(latestSeenBySource.map((row) => [row.source, row._max.sourceLastSeenAt]))
    const sourceNames = [...new Set([
      ...activeCounts.keys(), ...qualityHoldCounts.keys(), ...latestSeen.keys(), ...recentSyncRuns.map((run) => run.source),
    ])]
    const freshCounts = new Map(await Promise.all(sourceNames.map(async (source) => [
      source,
      await prisma.auctionListing.count({
        where: {
          source,
          status: "ACTIVE",
          adminHiddenAt: null,
          sourceLastSeenAt: { gte: refreshDueCutoff(source, now) },
        },
      }),
    ] as const)))

    const sourceHealth = sourceNames.map((source) => {
      const active = activeCounts.get(source) || 0
      const fresh = freshCounts.get(source) || 0
      const runHealth = deriveAuctionSourceRunHealth(source, recentSyncRuns, now)
      return {
        source,
        label: auctionSourceLabel(source),
        country: auctionSourceCountry(source),
        active,
        fresh,
        stale: Math.max(0, active - fresh),
        freshPercent: active > 0 ? Math.round((fresh / active) * 100) : null,
        pendingRemoval: pendingCounts.get(source) || 0,
        qualityHold: qualityHoldCounts.get(source) || 0,
        expectedRefreshHours: refreshIntervalHours(source),
        latestSeenAt: latestSeen.get(source) || null,
        latestRunAt: runHealth.latestRunStartedAt,
        ...runHealth,
      }
    }).sort((left, right) => {
      const operationalWeight = { STUCK: 5, FAILED: 4, DEGRADED: 3, NOT_RUN: 2, RUNNING: 1, HEALTHY: 0 } as const
      const leftAttention = left.stale + left.pendingRemoval + left.qualityHold + operationalWeight[left.operationalStatus] * 1_000
      const rightAttention = right.stale + right.pendingRemoval + right.qualityHold + operationalWeight[right.operationalStatus] * 1_000
      return rightAttention - leftAttention || right.active - left.active || left.label.localeCompare(right.label, "ru")
    })

    const statusCounts = byStatus.reduce((acc, s) => {
      acc[s.status] = s._count
      return acc
    }, {} as Record<string, number>)

    return NextResponse.json({
      total,
      totalAuctions,
      visibleAuctions,
      lastAuctionSync: latestAuctionCheck._max.sourceLastSeenAt,
      recent,
      sourceHealth,
      byStatus: {
        NEW: statusCounts.NEW || 0,
        CONTACTED: statusCounts.CONTACTED || 0,
        IN_PROGRESS: statusCounts.IN_PROGRESS || 0,
        CLOSED: statusCounts.CLOSED || 0,
        SOLD: statusCounts.SOLD || 0,
      },
    })
  }, "Не удалось загрузить статистику аукционов")
}
