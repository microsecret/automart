import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const inquiries = await prisma.auctionInquiry.findMany({
      include: { auctionListing: { select: { id: true, make: true, model: true, year: true, finalPrice: true, source: true, country: true, imageUrl: true } } },
      orderBy: { createdAt: "desc" }, take: 100,
    })
    return NextResponse.json({ inquiries })
  } catch { return NextResponse.json({ error: "Failed" }, { status: 500 }) }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const { id, status, managerNotes } = await request.json()
    const updated = await prisma.auctionInquiry.update({ where: { id }, data: { status, managerNotes } })
    return NextResponse.json({ success: true, inquiry: updated })
  } catch { return NextResponse.json({ error: "Failed" }, { status: 500 }) }
}
