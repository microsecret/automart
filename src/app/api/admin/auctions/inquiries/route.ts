import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

const INQUIRY_STATUSES = new Set(["NEW", "CONTACTED", "IN_PROGRESS", "CLOSED", "SOLD"])

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const status = request.nextUrl.searchParams.get("status")
    if (status && !INQUIRY_STATUSES.has(status)) return NextResponse.json({ error: "Некорректный статус заявки" }, { status: 400 })

    const inquiries = await prisma.auctionInquiry.findMany({
      where: status ? { status } : undefined,
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
    if (!id || typeof id !== "string" || !INQUIRY_STATUSES.has(status)) return NextResponse.json({ error: "Некорректные данные заявки" }, { status: 400 })
    if (managerNotes !== undefined && (typeof managerNotes !== "string" || managerNotes.length > 4_000)) return NextResponse.json({ error: "Комментарий менеджера не должен превышать 4000 символов" }, { status: 400 })

    const updated = await prisma.auctionInquiry.update({
      where: { id },
      data: { status, ...(managerNotes !== undefined ? { managerNotes: managerNotes.trim() || null } : {}) },
    })
    return NextResponse.json({ success: true, inquiry: updated })
  } catch (error: any) {
    if (error?.code === "P2025") return NextResponse.json({ error: "Заявка не найдена" }, { status: 404 })
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
