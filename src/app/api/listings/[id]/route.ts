import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

/** DELETE /api/listings/[id] — удалить объявление владельцем */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const listing = await prisma.listing.findUnique({
      where: { id },
      select: { id: true, userId: true, vehicleId: true, partId: true },
    })
    if (!listing) return NextResponse.json({ error: "Не найдено" }, { status: 404 })
    if (listing.userId !== session.user.id) return NextResponse.json({ error: "Нет прав" }, { status: 403 })

    await prisma.listing.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE listing error:", error)
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 })
  }
}
