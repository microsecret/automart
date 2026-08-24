import { NextRequest, NextResponse } from "next/server"
import { recordAdminAudit } from "@/lib/admin-audit"
import { LISTING_STATUS } from "@/lib/listing-lifecycle"
import { prisma } from "@/lib/prisma"
import { readStoredVehicleSubtype, validateVehiclePublication } from "@/lib/vehicle-publication-readiness"

export const dynamic = "force-dynamic"

const PARSER_TOKEN = process.env.PARSER_TOKEN
const ENFORCEMENT_REASON_PREFIX = "Автопроверка полноты: "

/**
 * Аудирует старые транспортные объявления по текущему контракту публикации.
 * Явный apply оставлен для управляемой ручной операции, а recovery возвращает
 * только карточки, которые ранее сняла именно эта автопроверка. Оба действия
 * защищены внутренним токеном и идемпотентны.
 */
export async function POST(request: NextRequest) {
  try {
    if (!PARSER_TOKEN) {
      console.error("PARSER_TOKEN is not configured")
      return NextResponse.json({ error: "Listing readiness enforcement is not configured" }, { status: 503 })
    }
    if (request.headers.get("authorization") !== `Bearer ${PARSER_TOKEN}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const apply = body?.apply === true
    const restoreAutoRejected = body?.restoreAutoRejected === true
    if (body?.apply != null && typeof body.apply !== "boolean") {
      return NextResponse.json({ error: "apply должен быть логическим значением" }, { status: 400 })
    }
    if (body?.restoreAutoRejected != null && typeof body.restoreAutoRejected !== "boolean") {
      return NextResponse.json({ error: "restoreAutoRejected должен быть логическим значением" }, { status: 400 })
    }
    if (apply && restoreAutoRejected) {
      return NextResponse.json({ error: "Нельзя одновременно снимать и восстанавливать объявления" }, { status: 400 })
    }

    let restored = 0
    let restoreSkipped = 0
    if (restoreAutoRejected) {
      const rejectedListings = await prisma.listing.findMany({
        where: {
          status: LISTING_STATUS.REJECTED,
          statusReason: { startsWith: ENFORCEMENT_REASON_PREFIX },
          deletedAt: null,
          vehicleId: { not: null },
        },
        select: {
          id: true,
          title: true,
          userId: true,
          createdAt: true,
          statusReason: true,
          statusEvents: {
            orderBy: { createdAt: "desc" },
            take: 20,
            select: { fromStatus: true, toStatus: true, reason: true, createdAt: true },
          },
        },
      })

      for (const listing of rejectedListings) {
        const automaticRejection = listing.statusEvents.find((event) =>
          event.toStatus === LISTING_STATUS.REJECTED
          && event.reason?.startsWith(ENFORCEMENT_REASON_PREFIX)
          && (event.fromStatus === LISTING_STATUS.ACTIVE || event.fromStatus === LISTING_STATUS.PENDING_MODERATION),
        )
        if (!automaticRejection) {
          restoreSkipped += 1
          continue
        }

        const previousStatus = automaticRejection.fromStatus === LISTING_STATUS.ACTIVE
          ? LISTING_STATUS.ACTIVE
          : LISTING_STATUS.PENDING_MODERATION
        const previousPublication = previousStatus === LISTING_STATUS.ACTIVE
          ? listing.statusEvents.find((event) => event.toStatus === LISTING_STATUS.ACTIVE && event.createdAt < automaticRejection.createdAt)?.createdAt || listing.createdAt
          : null
        const restoreReason = "Восстановлено после корректировки автоматической проверки полноты"
        const changed = await prisma.$transaction(async (tx) => {
          const update = await tx.listing.updateMany({
            where: {
              id: listing.id,
              status: LISTING_STATUS.REJECTED,
              statusReason: listing.statusReason,
              deletedAt: null,
            },
            data: {
              status: previousStatus,
              statusReason: null,
              publishedAt: previousPublication,
              lastStatusChangedAt: new Date(),
            },
          })
          if (update.count !== 1) return false

          await tx.listingStatusEvent.create({
            data: {
              listingId: listing.id,
              fromStatus: LISTING_STATUS.REJECTED,
              toStatus: previousStatus,
              reason: restoreReason,
              actorId: null,
            },
          })
          await tx.notification.create({
            data: {
              userId: listing.userId,
              type: "INFO",
              title: previousStatus === LISTING_STATUS.ACTIVE ? "Объявление снова опубликовано" : "Объявление возвращено на модерацию",
              content: "Автоматическое снятие отменено. Дополнить характеристики можно в личном кабинете без потери объявления.",
              relatedId: listing.id,
              relatedType: "LISTING",
            },
          })
          return true
        })

        if (!changed) {
          restoreSkipped += 1
          continue
        }

        restored += 1
        await recordAdminAudit({
          actorId: null,
          action: "LISTING_READINESS_RESTORE",
          entityType: "Listing",
          entityId: listing.id,
          summary: `Автопроверка: объявление «${listing.title}» восстановлено`,
          metadata: {
            previousStatus: LISTING_STATUS.REJECTED,
            nextStatus: previousStatus,
            reason: restoreReason,
          },
        })
      }
    }

    const candidates = await prisma.listing.findMany({
      where: {
        status: { in: [LISTING_STATUS.ACTIVE, LISTING_STATUS.PENDING_MODERATION] },
        deletedAt: null,
        vehicleId: { not: null },
      },
      select: { id: true, title: true, userId: true, status: true, vehicle: true },
      orderBy: { createdAt: "asc" },
    })

    const issues = candidates.flatMap((listing) => {
      if (!listing.vehicle) return []
      const publicationError = validateVehiclePublication({
        ...listing.vehicle,
        subtype: readStoredVehicleSubtype(listing.vehicle.vehicleType, listing.vehicle.typeDetails),
      })
      if (!publicationError) return []
      return [{
        listingId: listing.id,
        title: listing.title,
        userId: listing.userId,
        previousStatus: listing.status,
        reason: `${ENFORCEMENT_REASON_PREFIX}${publicationError}`.slice(0, 500),
      }]
    })

    let enforced = 0
    let skipped = 0
    if (apply) {
      for (const issue of issues) {
        const changed = await prisma.$transaction(async (tx) => {
          const update = await tx.listing.updateMany({
            where: {
              id: issue.listingId,
              status: issue.previousStatus,
              deletedAt: null,
            },
            data: {
              status: LISTING_STATUS.REJECTED,
              statusReason: issue.reason,
              publishedAt: null,
              lastStatusChangedAt: new Date(),
            },
          })
          if (update.count !== 1) return false

          await tx.listingStatusEvent.create({
            data: {
              listingId: issue.listingId,
              fromStatus: issue.previousStatus,
              toStatus: LISTING_STATUS.REJECTED,
              reason: issue.reason,
              actorId: null,
            },
          })
          await tx.notification.create({
            data: {
              userId: issue.userId,
              type: "WARNING",
              title: "Объявление нужно дополнить",
              content: issue.reason,
              relatedId: issue.listingId,
              relatedType: "LISTING",
            },
          })
          return true
        })

        if (!changed) {
          skipped += 1
          continue
        }

        enforced += 1
        await recordAdminAudit({
          actorId: null,
          action: "LISTING_READINESS_ENFORCE",
          entityType: "Listing",
          entityId: issue.listingId,
          summary: `Автопроверка: объявление «${issue.title}» отправлено на доработку`,
          metadata: {
            previousStatus: issue.previousStatus,
            nextStatus: LISTING_STATUS.REJECTED,
            reason: issue.reason,
          },
        })
      }
    }

    return NextResponse.json({
      success: true,
      dryRun: !apply,
      scanned: candidates.length,
      incomplete: issues.length,
      enforced,
      skipped,
      restored,
      restoreSkipped,
      issues: issues.map(({ userId: _userId, ...issue }) => issue),
    })
  } catch (error) {
    console.error("Listing readiness enforcement failed", error)
    return NextResponse.json({ error: "Не удалось проверить полноту старых объявлений" }, { status: 500 })
  }
}
