import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { publicListingWhere } from "@/lib/listing-lifecycle"

export const dynamic = "force-dynamic"

/** POST /api/listings/[id]/views — увеличить счётчик просмотров */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const result = await prisma.listing.updateMany({
      where: { id, ...publicListingWhere },
      data: { views: { increment: 1 } },
    })
    if (!result.count) return NextResponse.json({ error: "Not found" }, { status: 404 })
    const listing = await prisma.listing.findUnique({ where: { id }, select: { views: true } })
    if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ views: listing.views })
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
