import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canModeratorTransition, isListingStatus, LISTING_STATUS } from "@/lib/listing-lifecycle"
import { can } from "@/lib/permissions"

export const dynamic = "force-dynamic"

/** GET /api/admin/listings — все объявления для модерации */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !can(session.user?.role, "listing:moderate")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const listings = await prisma.listing.findMany({
      include: {
        vehicle: { select: { id: true, make: true, model: true, year: true, price: true, images: true, location: true } },
        part: { select: { id: true, name: true, price: true } },
        user: { select: { id: true, name: true, email: true } },
        statusEvents: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    })

    return NextResponse.json({ listings })
  } catch (error) {
    console.error("Admin listings error:", error)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}

/** PATCH /api/admin/listings — решение модератора с неизменяемым аудитом */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !can(session.user?.role, "listing:moderate")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json().catch(() => null)
    const id = typeof body?.id === "string" ? body.id : ""
    const status = body?.status
    const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 500) : null
    if (!id || !isListingStatus(status)) return NextResponse.json({ error: "Некорректные параметры" }, { status: 400 })
    if (status === LISTING_STATUS.REJECTED && !reason) return NextResponse.json({ error: "Укажите причину отклонения" }, { status: 400 })

    const listing = await prisma.listing.findUnique({ where: { id }, select: { id: true, status: true, deletedAt: true } })
    if (!listing || listing.deletedAt) return NextResponse.json({ error: "Не найдено" }, { status: 404 })
    if (!canModeratorTransition(listing.status as typeof LISTING_STATUS[keyof typeof LISTING_STATUS], status)) {
      return NextResponse.json({ error: "Этот переход статуса недоступен" }, { status: 409 })
    }

    const now = new Date()
    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.listing.update({
        where: { id },
        data: {
          status,
          statusReason: reason,
          lastStatusChangedAt: now,
          publishedAt: status === LISTING_STATUS.ACTIVE ? now : undefined,
          archivedAt: status === LISTING_STATUS.ARCHIVED ? now : undefined,
        },
        select: { id: true, status: true, statusReason: true, publishedAt: true, archivedAt: true },
      })
      await tx.listingStatusEvent.create({
        data: { listingId: id, fromStatus: listing.status, toStatus: status, reason, actorId: session.user.id },
      })
      return next
    })

    return NextResponse.json({ listing: updated })
  } catch (error) {
    console.error("Admin listing moderation error:", error)
    return NextResponse.json({ error: "Не удалось обновить объявление" }, { status: 500 })
  }
}

/** DELETE /api/admin/listings — мягко удалить объявление (модератор) */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !can(session.user?.role, "listing:remove:any")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 })

    const listing = await prisma.listing.findUnique({ where: { id }, select: { id: true, status: true, deletedAt: true } })
    if (!listing || listing.deletedAt) return NextResponse.json({ error: "Не найдено" }, { status: 404 })

    const now = new Date()
    await prisma.$transaction([
      prisma.listing.update({
        where: { id },
        data: {
          status: LISTING_STATUS.ARCHIVED,
          statusReason: "Снято модератором",
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
          reason: "Снято модератором",
          actorId: session.user.id,
        },
      }),
    ])
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Admin listing removal error:", error)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
