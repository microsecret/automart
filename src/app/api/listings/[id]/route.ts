import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getOwnerTransition, isListingModerator, LISTING_STATUS } from "@/lib/listing-lifecycle"
import { parseListingEditInput, parseStoredImages } from "@/lib/listing-edit"

export const dynamic = "force-dynamic"

const editableListingInclude = {
  vehicle: true,
  part: true,
} as const

/** GET /api/listings/[id] — public active card or the owner/moderator workspace. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    const listing = await prisma.listing.findUnique({ where: { id }, include: editableListingInclude })
    if (!listing || listing.deletedAt) return NextResponse.json({ error: "Не найдено" }, { status: 404 })

    const canPreview = listing.status === LISTING_STATUS.ACTIVE || listing.userId === session?.user?.id || isListingModerator(session?.user?.role)
    if (!canPreview) return NextResponse.json({ error: "Не найдено" }, { status: 404 })

    return NextResponse.json({ listing })
  } catch (error) {
    console.error("GET listing error:", error)
    return NextResponse.json({ error: "Не удалось загрузить объявление" }, { status: 500 })
  }
}

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
      select: { id: true, userId: true, status: true, deletedAt: true, vehicle: { select: { images: true } }, part: { select: { images: true } } },
    })
    if (!listing || listing.deletedAt) return NextResponse.json({ error: "Не найдено" }, { status: 404 })
    if (listing.userId !== session.user.id) return NextResponse.json({ error: "Нет прав" }, { status: 403 })

    const nextStatus = getOwnerTransition(listing.status as typeof LISTING_STATUS[keyof typeof LISTING_STATUS], action)
    if (!nextStatus) return NextResponse.json({ error: "Этот переход статуса недоступен" }, { status: 409 })

    if (action === "SUBMIT_FOR_MODERATION" && listing.vehicle && parseStoredImages(listing.vehicle.images).length === 0) {
      return NextResponse.json({ error: "Добавьте хотя бы одну фотографию транспорта перед отправкой на модерацию" }, { status: 400 })
    }

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

/** PUT /api/listings/[id] — owner-only edit with revision and remoderation. */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const parsed = parseListingEditInput(await request.json().catch(() => null))
    if (!parsed.value) return NextResponse.json({ error: parsed.error || "Некорректные данные" }, { status: 400 })
    const patch = parsed.value
    const listing = await prisma.listing.findUnique({ where: { id }, include: editableListingInclude })
    if (!listing || listing.deletedAt) return NextResponse.json({ error: "Не найдено" }, { status: 404 })
    if (listing.userId !== session.user.id) return NextResponse.json({ error: "Нет прав" }, { status: 403 })
    if (!listing.vehicle && !listing.part) return NextResponse.json({ error: "Нарушена целостность объявления" }, { status: 409 })

    const subject = listing.vehicle || listing.part!
    const before = {
      title: listing.title,
      description: listing.description,
      price: listing.price,
      location: subject.location,
      images: parseStoredImages(subject.images),
    }
    const after = {
      title: patch.title ?? before.title,
      description: patch.description === undefined ? before.description : patch.description,
      price: patch.price ?? before.price,
      location: patch.location ?? before.location,
      images: patch.images ?? before.images,
    }
    const changedFields = (Object.keys(after) as Array<keyof typeof after>).filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
    if (changedFields.length === 0) return NextResponse.json({ error: "Нет изменений для сохранения" }, { status: 400 })

    const requiresRemoderation = listing.status === LISTING_STATUS.ACTIVE
    const nextStatus = requiresRemoderation ? LISTING_STATUS.PENDING_MODERATION : listing.status
    const now = new Date()

    const updated = await prisma.$transaction(async (tx) => {
      const subjectUpdate = {
        price: after.price,
        location: after.location,
        description: after.description,
        images: JSON.stringify(after.images),
      }
      if (listing.vehicle) await tx.vehicle.update({ where: { id: listing.vehicle.id }, data: subjectUpdate })
      else await tx.part.update({ where: { id: listing.part!.id }, data: subjectUpdate })

      const nextListing = await tx.listing.update({
        where: { id },
        data: {
          title: after.title,
          description: after.description,
          price: after.price,
          status: nextStatus,
          statusReason: requiresRemoderation ? "Изменено владельцем: требуется повторная модерация" : listing.statusReason,
          lastStatusChangedAt: requiresRemoderation ? now : listing.lastStatusChangedAt,
        },
        include: editableListingInclude,
      })
      await tx.listingRevision.create({
        data: {
          listingId: id,
          actorId: session.user.id,
          changedFields: JSON.stringify(changedFields),
          before: JSON.stringify(before),
          after: JSON.stringify(after),
          reason: patch.reason || null,
        },
      })
      if (requiresRemoderation) {
        await tx.listingStatusEvent.create({
          data: {
            listingId: id,
            fromStatus: listing.status,
            toStatus: nextStatus,
            actorId: session.user.id,
            reason: "Изменено владельцем: требуется повторная модерация",
          },
        })
      }
      return nextListing
    })

    return NextResponse.json({ listing: updated, requiresRemoderation })
  } catch (error) {
    console.error("PUT listing error:", error)
    return NextResponse.json({ error: "Не удалось сохранить изменения" }, { status: 500 })
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
