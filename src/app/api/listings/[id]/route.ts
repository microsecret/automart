import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getOwnerTransition, isListingModerator, LISTING_STATUS } from "@/lib/listing-lifecycle"
import { parseListingEditInput, parseStoredImages } from "@/lib/listing-edit"
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit"
import { isAdmin } from "@/lib/permissions"
import { readStoredVehicleSubtype, validateVehiclePublication } from "@/lib/vehicle-publication-readiness"

export const dynamic = "force-dynamic"

const editableListingInclude = {
  vehicle: true,
  part: true,
} as const

/** GET /api/listings/[id] — owner/moderator workspace with full editable data. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const listing = await prisma.listing.findUnique({ where: { id }, include: editableListingInclude })
    if (!listing || listing.deletedAt) return NextResponse.json({ error: "Не найдено" }, { status: 404 })

    const canEdit = listing.userId === session.user.id || isListingModerator(session.user.role)
    if (!canEdit) return NextResponse.json({ error: "Нет прав" }, { status: 403 })

    return NextResponse.json({ listing })
  } catch (error) {
    console.error("GET listing error:", error)
    return NextResponse.json({ error: "Не удалось загрузить объявление" }, { status: 500 })
  }
}

/**
 * POST /api/listings/[id] — раскрыть контакт продавца авторизованному покупателю.
 *
 * Номер не включается в публичный JSON карточки: это защищает его от массового
 * сбора. Ограничение запросов дополнительно не даёт использовать действие как
 * каталог номеров, а владелец видит свой контакт без ограничений по статусу.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Войдите, чтобы увидеть телефон продавца" }, { status: 401 })

    const userLimit = rateLimit(`listing:contact:user:${session.user.id}`, { windowMs: 60 * 60_000, maxRequests: 20 })
    const ipLimit = rateLimit(`listing:contact:ip:${getClientIp(request)}`, { windowMs: 60 * 60_000, maxRequests: 60 })
    if (!userLimit.success || !ipLimit.success) {
      const limit = !userLimit.success ? userLimit : ipLimit
      return NextResponse.json(
        { error: "Слишком много запросов контактов. Повторите попытку позже." },
        { status: 429, headers: rateLimitHeaders(limit) },
      )
    }

    const listing = await prisma.listing.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        status: true,
        deletedAt: true,
        user: { select: { phone: true } },
      },
    })
    if (!listing || listing.deletedAt || listing.status !== LISTING_STATUS.ACTIVE) {
      return NextResponse.json({ error: "Объявление недоступно" }, { status: 404 })
    }
    if (!listing.user.phone) {
      return NextResponse.json({ error: "Продавец пока не добавил номер для связи" }, { status: 409 })
    }

    return NextResponse.json({ phone: listing.user.phone })
  } catch (error) {
    console.error("POST listing contact error:", error)
    return NextResponse.json({ error: "Не удалось получить номер. Повторите попытку позже." }, { status: 500 })
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
      select: { id: true, userId: true, status: true, deletedAt: true, vehicle: true, part: { select: { images: true } } },
    })
    if (!listing || listing.deletedAt) return NextResponse.json({ error: "Не найдено" }, { status: 404 })
    if (listing.userId !== session.user.id) return NextResponse.json({ error: "Нет прав" }, { status: 403 })

    const nextStatus = getOwnerTransition(listing.status as typeof LISTING_STATUS[keyof typeof LISTING_STATUS], action)
    if (!nextStatus) return NextResponse.json({ error: "Этот переход статуса недоступен" }, { status: 409 })

    if (action === "SUBMIT_FOR_MODERATION" && listing.vehicle) {
      const publicationError = validateVehiclePublication({
        ...listing.vehicle,
        subtype: readStoredVehicleSubtype(listing.vehicle.vehicleType, listing.vehicle.typeDetails),
      })
      if (publicationError) return NextResponse.json({ error: publicationError }, { status: 400 })
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
    // Администратор правит чужие карточки при модерации. Смена статуса и
    // удаление ему сюда не открываются — для них есть админ-панель.
    if (listing.userId !== session.user.id && !isAdmin(session.user.role)) {
      return NextResponse.json({ error: "Нет прав" }, { status: 403 })
    }
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

    /* Характеристики машины правятся отдельно от общих полей.

       У запчасти нет ни пробега, ни коробки, поэтому набор применяется
       только к транспорту. `undefined` означает «не трогать», `null` —
       «убрать значение»: владелец мог ошибиться при подаче. */
    const SPEC_KEYS = [
      "mileage", "operatingHours", "flightHours", "fuelType", "transmission", "engineVolume", "power",
      "vin", "serialNumber", "registrationNumber", "bodyType", "driveType", "color", "condition",
      "steeringWheel", "ownersCount", "documentsStatus", "damageInfo", "sellerType", "availability",
      "customsCleared", "generation",
    ] as const
    const specPatch: Record<string, unknown> = {}
    if (listing.vehicle) {
      for (const key of SPEC_KEYS) {
        const next = patch[key]
        if (next === undefined) continue
        const current = (listing.vehicle as Record<string, unknown>)[key]
        if (next !== current) specPatch[key] = next
      }
    }
    const changedFields = (Object.keys(after) as Array<keyof typeof after>).filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
    const changedSpecs = Object.keys(specPatch)
    if (changedFields.length === 0 && changedSpecs.length === 0) {
      return NextResponse.json({ error: "Нет изменений для сохранения" }, { status: 400 })
    }

    const requiresRemoderation = listing.status === LISTING_STATUS.ACTIVE
    const nextStatus = requiresRemoderation ? LISTING_STATUS.PENDING_MODERATION : listing.status
    const now = new Date()

    if (listing.vehicle && (listing.status === LISTING_STATUS.ACTIVE || listing.status === LISTING_STATUS.PENDING_MODERATION)) {
      const nextVehicle = { ...listing.vehicle, ...specPatch }
      const publicationError = validateVehiclePublication({
        ...nextVehicle,
        price: after.price,
        location: after.location,
        description: after.description,
        images: after.images,
        subtype: readStoredVehicleSubtype(nextVehicle.vehicleType, nextVehicle.typeDetails),
      })
      if (publicationError) return NextResponse.json({ error: publicationError }, { status: 400 })
    }

    const updated = await prisma.$transaction(async (tx) => {
      const subjectUpdate = {
        price: after.price,
        location: after.location,
        description: after.description,
        images: JSON.stringify(after.images),
      }
      if (listing.vehicle) await tx.vehicle.update({ where: { id: listing.vehicle.id }, data: { ...subjectUpdate, ...specPatch } })
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
      /* Изменение цены записывается отдельно.

         Покупатель принимает решение не только по самой цене, но и по её
         движению: «снижена на 50 000 три дня назад» говорит о готовности
         торговаться. Правка описания или фотографий историю не засоряет —
         событие создаётся, только если цена действительно изменилась. */
      if (changedFields.includes("price") && before.price !== after.price) {
        await tx.listingPriceEvent.create({
          data: { listingId: id, oldPrice: before.price, newPrice: after.price },
        })
      }

      await tx.listingRevision.create({
        data: {
          listingId: id,
          actorId: session.user.id,
          changedFields: JSON.stringify([...changedFields, ...changedSpecs]),
          before: JSON.stringify({
            ...before,
            ...Object.fromEntries(changedSpecs.map((key) => [key, (listing.vehicle as Record<string, unknown> | null)?.[key] ?? null])),
          }),
          after: JSON.stringify({ ...after, ...specPatch }),
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
