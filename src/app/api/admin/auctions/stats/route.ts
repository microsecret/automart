import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const now = new Date()
    const freshnessBoundary = new Date(now.getTime() - 8 * 60 * 60 * 1000)
    const sourceState = { source: "ENCAR", status: "ACTIVE" }
    const [byStatus, total, totalAuctions, visibleAuctions, latestAuctionCheck, recent, activeEncar, freshEncar, staleEncar, pendingRemoval, latestSyncRun] = await Promise.all([
      prisma.auctionInquiry.groupBy({ by: ["status"], _count: true }),
      prisma.auctionInquiry.count(),
      prisma.auctionListing.count({ where: { status: "ACTIVE" } }),
      prisma.auctionListing.count({ where: { status: "ACTIVE", OR: [{ auctionDate: null }, { auctionDate: { gte: now } }] } }),
      prisma.auctionListing.aggregate({ _max: { sourceLastSeenAt: true } }),
      prisma.auctionInquiry.count({ where: { createdAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } } }),
      prisma.auctionListing.count({ where: sourceState }),
      prisma.auctionListing.count({ where: { ...sourceState, sourceLastSeenAt: { gte: freshnessBoundary } } }),
      prisma.auctionListing.count({ where: { ...sourceState, OR: [{ sourceLastSeenAt: null }, { sourceLastSeenAt: { lt: freshnessBoundary } }] } }),
      prisma.auctionListing.count({ where: { ...sourceState, sourceMissingChecks: { gte: 1 } } }),
      prisma.auctionSyncRun.findFirst({
        where: { source: "ENCAR" },
        orderBy: { startedAt: "desc" },
        select: { startedAt: true, completedAt: true, status: true, syncKind: true, failed: true, expired: true },
      }),
    ])

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
      catalogHealth: {
        source: "ENCAR",
        active: activeEncar,
        freshWithin8Hours: freshEncar,
        staleMoreThan8Hours: staleEncar,
        pendingRemoval,
        latestRun: latestSyncRun,
      },
      byStatus: {
        NEW: statusCounts.NEW || 0,
        CONTACTED: statusCounts.CONTACTED || 0,
        IN_PROGRESS: statusCounts.IN_PROGRESS || 0,
        CLOSED: statusCounts.CLOSED || 0,
        SOLD: statusCounts.SOLD || 0,
      },
    })
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
