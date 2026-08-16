import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getClientIp, rateLimit } from "@/lib/rate-limit"
import { buildPublicAuctionPolicy } from "@/lib/auction-public-catalog"
import { auctionVehicleIdentity } from "@/lib/auction-normalization"

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

    const identity = auctionVehicleIdentity(listing.make, listing.model)
    const candidates = await prisma.auctionListing.findMany({
      where: {
        ...publicPolicy.where,
        id: { not: listing.id },
        country: listing.country,
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 60,
    })
    const similar = candidates
      .map((candidate) => {
        const candidateIdentity = auctionVehicleIdentity(candidate.make, candidate.model)
        const makePenalty = candidateIdentity.make.toLocaleLowerCase("ru-RU") === identity.make.toLocaleLowerCase("ru-RU") ? 0 : 8
        const yearPenalty = Math.abs(candidate.year - listing.year)
        const pricePenalty = listing.finalPrice > 0
          ? Math.min(4, Math.abs(candidate.finalPrice - listing.finalPrice) / listing.finalPrice * 4)
          : 0
        return { candidate, score: makePenalty + yearPenalty + pricePenalty }
      })
      .sort((left, right) => left.score - right.score)
      .slice(0, 4)
      .map(({ candidate }) => candidate)

    const response = NextResponse.json({ listing: viewedListing, similar })
    if (!alreadyCounted) response.cookies.set(viewCookieName, "1", { httpOnly: true, sameSite: "lax", maxAge: 60 * 60, path: "/" })
    return response
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
