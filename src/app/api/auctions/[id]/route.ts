import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const listing = await prisma.auctionListing.findUnique({
      where: { id },
      include: { inquiries: { orderBy: { createdAt: "desc" }, take: 10 } },
    })
    if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 })

    await prisma.auctionListing.update({ where: { id }, data: { viewCount: { increment: 1 } } }).catch(() => {})

    return NextResponse.json({ listing })
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
