import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { buildPublicAuctionPolicy } from "@/lib/auction-public-catalog"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const publicAuctionWhere = buildPublicAuctionPolicy().where
    const [vehicles, parts, auctions, listings, users, news] = await Promise.all([
      prisma.vehicle.count(),
      prisma.part.count(),
      prisma.auctionListing.count({ where: publicAuctionWhere }),
      prisma.listing.count(),
      prisma.user.count(),
      prisma.news.count(),
    ])

    // Статистика аукционов по странам
    const auctionByCountry = await prisma.auctionListing.groupBy({
      by: ["country"],
      where: publicAuctionWhere,
      _count: true,
    })

    return NextResponse.json({
      vehicles, parts, auctions, listings, users, news,
      auctionByCountry: auctionByCountry.reduce((acc, c) => {
        acc[c.country] = c._count
        return acc
      }, {} as Record<string, number>),
    })
  } catch {
    return NextResponse.json({ vehicles: 0, parts: 0, auctions: 0, listings: 0, users: 0, news: 0 })
  }
}
