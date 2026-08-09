import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const listing = await prisma.auctionListing.findFirst({
      where: {
        id,
        status: "ACTIVE",
        OR: [{ auctionDate: null }, { auctionDate: { gte: new Date() } }],
      },
    })
    if (!listing) return NextResponse.json({ error: "Лот недоступен" }, { status: 404 })

    await prisma.auctionListing.update({ where: { id }, data: { viewCount: { increment: 1 } } }).catch(() => {})

    return NextResponse.json({ listing })
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
