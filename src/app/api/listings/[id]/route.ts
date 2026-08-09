import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getOwnerTransition, LISTING_STATUS } from "@/lib/listing-lifecycle"

export const dynamic = "force-dynamic"

/** PATCH /api/listings/[id] — сменить статус владельцем */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json().catch(() => null)
    const action = body?.action
    const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 500) : null
    const listing = await prisma.listing.findUnique({
      where: { id },
      select: { id: true, userId: true, status: true, deletedAt: true },
    })
    if (!listing || listing.deletedAt) return NextResponse.json({ error: "Не найдено" }, { status: 404 })
    if (listing.userId !== session.user.id) return NextResponse.json({ error: "Нет прав" }, { status: 403 })

    const nextStatus = getOwnerTransition(listing.status as typeof LISTING_STATUS[keyof typeof LISTING_STATUS], action)
    if (!nextStatus) return NextResponse.json({ error: "Этот переход статуса недоступен" }, { status: 409 })

    const now = new Date()
    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.listing.update({
        where: { id },
        data: {
          status: nextStatus,
          statusReason: reason,
          lastStatusChangedAt: now,
          publishedAt: nextStatus === LISTING_STATUS.ACTIVE ? now : undefined,
          archivedAt: nextStatus === LISTING_STATUS.ARCHIVED ? now : undefined,
        },
        select: { id: true, status: true, statusReason: true, publishedAt: true, archivedAt: true },
      })
      await tx.listingStatusEvent.create({
        data: { listingId: id, fromStatus: listing.status, toStatus: nextStatus, reason, actorId: session.user.id },
      })
      return next
    })

    return NextResponse.json({ listing: updated })
  } catch (error) {
    console.error("PATCH listing error:", error)
    return NextResponse.json({ error: "Не удалось изменить статус" }, { status: 500 })
  }
}

/** DELETE /api/listings/[id] — мягко удалить объявление владельцем */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const listing = await prisma.listing.findUnique({
      where: { id },
      select: { id: true, userId: true, status: true, deletedAt: true },
    })
    if (!listing || listing.deletedAt) return NextResponse.json({ error: "Не найдено" }, { status: 404 })
    if (listing.userId !== session.user.id) return NextResponse.json({ error: "Нет прав" }, { status: 403 })

    const now = new Date()
    await prisma.$transaction([
      prisma.listing.update({
        where: { id },
        data: {
          status: LISTING_STATUS.ARCHIVED,
          statusReason: "Удалено владельцем",
          archivedAt: now,
          deletedAt: now,
          lastStatusChangedAt: now,
        },
      }),
      prisma.listingStatusEvent.create({
        data: {
          listingId: id,
          fromStatus: listing.status,
          toStatus: LISTING_STATUS.ARCHIVED,
          reason: "Удалено владельцем",
          actorId: session.user.id,
        },
      }),
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE listing error:", error)
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 })
  }
}
