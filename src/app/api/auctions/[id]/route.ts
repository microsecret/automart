import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const listing = await prisma.auctionListing.findUnique({
      where: { id: params.id },
      include: { inquiries: { orderBy: { createdAt: "desc" }, take: 10 } },
    })
    if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 })

    await prisma.auctionListing.update({ where: { id: params.id }, data: { viewCount: { increment: 1 } } }).catch(() => {})

    return NextResponse.json({ listing })
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
