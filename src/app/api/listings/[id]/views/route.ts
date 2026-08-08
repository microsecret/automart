import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

/** POST /api/listings/[id]/views — увеличить счётчик просмотров */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const listing = await prisma.listing.update({
      where: { id: params.id },
      data: { views: { increment: 1 } },
      select: { id: true, views: true },
    })
    return NextResponse.json({ views: listing.views })
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}

/** GET /api/listings/[id]/views — получить просмотры */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const listing = await prisma.listing.findUnique({
      where: { id: params.id },
      select: { views: true },
    })
    if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ views: listing.views })
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
