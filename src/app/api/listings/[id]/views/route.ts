import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { publicListingWhere } from "@/lib/listing-lifecycle"
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { hashAnalyticsIp, isAutomatedUserAgent } from "@/lib/analytics-identity"

export const dynamic = "force-dynamic"

/** POST /api/listings/[id]/views — увеличить счётчик просмотров */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const userAgent = request.headers.get("user-agent")?.slice(0, 500) || ""
    const listing = await prisma.listing.findFirst({ where: { id, ...publicListingWhere }, select: { id: true, views: true } })
    if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (isAutomatedUserAgent(userAgent)) return NextResponse.json({ views: listing.views })

    const clientIp = getClientIp(request)
    const limit = rateLimit(`listing-view:${id}:${clientIp}`, { windowMs: 5 * 60_000, maxRequests: 120 })
    if (!limit.success) return NextResponse.json({ views: listing.views }, { status: 429, headers: rateLimitHeaders(limit) })
    const session = await getServerSession(authOptions).catch(() => null)
    const [, updated] = await prisma.$transaction([
      prisma.listingViewEvent.create({ data: { listingId: id, ipHash: hashAnalyticsIp(clientIp), userId: session?.user?.id || null } }),
      prisma.listing.update({ where: { id }, data: { views: { increment: 1 } }, select: { views: true } }),
    ])
    return NextResponse.json({ views: updated.views })
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}

/** GET /api/listings/[id]/views — получить просмотры */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const listing = await prisma.listing.findFirst({
      where: { id, ...publicListingWhere },
      select: { views: true },
    })
    if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ views: listing.views })
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
