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

    const [byStatus, total, totalAuctions, recent] = await Promise.all([
      prisma.auctionInquiry.groupBy({ by: ["status"], _count: true }),
      prisma.auctionInquiry.count(),
      prisma.auctionListing.count({ where: { status: "ACTIVE" } }),
      prisma.auctionInquiry.count({ where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } }),
    ])

    const statusCounts = byStatus.reduce((acc, s) => {
      acc[s.status] = s._count
      return acc
    }, {} as Record<string, number>)

    return NextResponse.json({
      total,
      totalAuctions,
      recent,
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
