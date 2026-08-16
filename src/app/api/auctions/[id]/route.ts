import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getClientIp, rateLimit } from "@/lib/rate-limit"
import { buildPublicAuctionPolicy } from "@/lib/auction-public-catalog"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const publicPolicy = buildPublicAuctionPolicy()
    const listing = await prisma.auctionListing.findFirst({
      where: {
        id,
        ...publicPolicy.where,
      },
    })
    if (!listing) return NextResponse.json({ error: "Лот недоступен" }, { status: 404 })

    const viewCookieName = `auction-view-${listing.id}`
    const alreadyCounted = request.cookies.get(viewCookieName)?.value === "1"
    const uniqueView = rateLimit(`auction-view:${listing.id}:${getClientIp(request)}`, { windowMs: 60 * 60_000, maxRequests: 1 })
    const viewedListing = !alreadyCounted && uniqueView.success
      ? await prisma.auctionListing.update({
          where: { id },
          data: { viewCount: { increment: 1 } },
        }).catch(() => listing)
      : listing

    const response = NextResponse.json({ listing: viewedListing })
    if (!alreadyCounted) response.cookies.set(viewCookieName, "1", { httpOnly: true, sameSite: "lax", maxAge: 60 * 60, path: "/" })
    return response
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
