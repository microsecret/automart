import { NextRequest, NextResponse } from "next/server"
import { requireAdminSession } from "@/lib/admin-route-guard"
import { prisma } from "@/lib/prisma"
import { makeDeliveryCode } from "@/lib/delivery"
import { inspectContactSharing } from "@/lib/contact-sharing-policy"
import { adminAuditValueLabel, recordAdminAudit } from "@/lib/admin-audit"

export const dynamic = "force-dynamic"

const INQUIRY_STATUSES = new Set(["NEW", "CONTACTED", "IN_PROGRESS", "CLOSED", "SOLD"])

/* Порядок разбора заявок.

   Раньше список шёл от новых к старым, и заявка, пролежавшая неделю,
   уезжала в конец — туда, куда не доходят. Заявка на импорт это живой
   человек с деньгами: чем дольше он ждёт, тем вероятнее уйдёт к другому.

   Сначала те, к кому никто не притронулся, потом взятые в работу, в конце
   завершённые. Внутри каждой группы — самые старые сверху. */
const STATUS_ORDER: Record<string, number> = {
  NEW: 0,
  CONTACTED: 1,
  IN_PROGRESS: 2,
  SOLD: 3,
  CLOSED: 4,
}
const ACTIVE_MONETIZATION_MODEL = "DEAL_FEE"
const ASSIGNMENT_CONFLICT = "AUCTION_INQUIRY_ASSIGNMENT_CONFLICT"

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function readMoney(value: unknown, minimum: number, maximum: number) {
  const amount = Number(value)
  return Number.isSafeInteger(amount) && amount >= minimum && amount <= maximum ? amount : null
}

export async function GET(request: NextRequest) {
  try {
    const guard = await requireAdminSession()
    if (guard.denied) return guard.denied
    const status = request.nextUrl.searchParams.get("status")
    if (status && !INQUIRY_STATUSES.has(status)) return NextResponse.json({ error: "Некорректный статус заявки" }, { status: 400 })

    const [inquiries, verifiedOrganizations] = await Promise.all([
      prisma.auctionInquiry.findMany({
        where: status ? { status } : undefined,
        include: {
          auctionListing: { select: { id: true, make: true, model: true, year: true, finalPrice: true, source: true, country: true, location: true, lotNumber: true, imageUrl: true } },
          requester: { select: { id: true, name: true } },
          assignedPartner: { select: { id: true, name: true } },
          assignedBy: { select: { id: true, name: true } },
          offers: { select: { id: true, status: true, expiresAt: true, organization: { select: { legalName: true } } } },
          deliveryOrder: {
            select: {
              id: true,
              code: true,
              status: true,
              platformFeeStatus: true,
              buyerDepositStatus: true,
              _count: { select: { moderationEvents: true } },
            },
          },
        },
        // Внутри выборки сортируем по возрасту, а порядок по статусу
        // задаётся ниже: алфавитный поставил бы CLOSED раньше NEW.
        orderBy: { createdAt: "asc" },
        take: 100,
      }),
      prisma.deliveryOrganization.findMany({
        where: { verificationStatus: "VERIFIED" },
        orderBy: { legalName: "asc" },
        select: {
          id: true,
          legalName: true,
          serviceRegions: true,
          owner: { select: { id: true, name: true, _count: { select: { assignedAuctionInquiries: true } } } },
        },
      }),
    ])
    const partners = verifiedOrganizations.map((organization) => ({
      organizationId: organization.id,
      organizationName: organization.legalName,
      serviceRegions: organization.serviceRegions,
      userId: organization.owner.id,
      userName: organization.owner.name,
      assignedInquiries: organization.owner._count.assignedAuctionInquiries,
    }))
    /* Необработанные — наверх, внутри группы старые первыми.

       Prisma сортирует по статусу алфавитно, а нам нужен порядок по смыслу:
       CLOSED не должен оказаться раньше NEW. Выборка ограничена сотней
       записей, поэтому упорядочить их в памяти дешевле, чем усложнять
       запрос. */
    const ordered = [...inquiries].sort((left, right) => {
      const byStatus = (STATUS_ORDER[left.status] ?? 99) - (STATUS_ORDER[right.status] ?? 99)
      if (byStatus !== 0) return byStatus
      return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
    })

    return NextResponse.json({ inquiries: ordered, partners })
  } catch { return NextResponse.json({ error: "Failed" }, { status: 500 }) }
}

export async function PATCH(request: NextRequest) {
  try {
    const guard = await requireAdminSession()
    if (guard.denied) return guard.denied
    const session = guard.session
    const body = await request.json().catch(() => null)
    if (!isPlainObject(body)) return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 })
    const action = typeof body.action === "string" ? body.action : "UPDATE"

    if (action === "ASSIGN") {
      const id = typeof body.id === "string" ? body.id.trim() : ""
      const partnerId = typeof body.partnerId === "string" ? body.partnerId.trim() : ""
      const platformFeeAmount = readMoney(body.platformFeeAmount, 1_000, 1_000_000)
      const buyerDepositAmount = readMoney(body.buyerDepositAmount, 10_000, 5_000_000)
      if (!id || !partnerId || platformFeeAmount === null || buyerDepositAmount === null) {
        return NextResponse.json({ error: "Выберите партнёра и проверьте суммы задатка и комиссии" }, { status: 400 })
      }

      const [inquiry, organization] = await Promise.all([
        prisma.auctionInquiry.findUnique({
          where: { id },
          include: { auctionListing: { select: { id: true, make: true, model: true, year: true, country: true, location: true, lotNumber: true } } },
        }),
        prisma.deliveryOrganization.findFirst({
          where: { ownerId: partnerId, verificationStatus: "VERIFIED" },
          select: { id: true, legalName: true },
        }),
      ])
      if (!inquiry) return NextResponse.json({ error: "Заявка не найдена" }, { status: 404 })
      if (!inquiry.requesterId) {
        return NextResponse.json({ error: "Старая заявка не привязана к аккаунту. Сначала попросите покупателя войти и повторить заявку." }, { status: 409 })
      }
      const requesterId = inquiry.requesterId
      if (!organization) return NextResponse.json({ error: "Можно назначить только проверенного партнёра" }, { status: 409 })

      const now = new Date()
      const result = await prisma.$transaction(async (tx) => {
        let deliveryOrderId = inquiry.deliveryOrderId
        let createdNewOrder = false
        if (deliveryOrderId) {
          await tx.deliveryOrder.update({
            where: { id: deliveryOrderId },
            data: {
              partnerId,
              managerId: session.user.id,
              monetizationModel: ACTIVE_MONETIZATION_MODEL,
              platformFeeAmount,
              buyerDepositAmount,
              nextAction: "Партнёр изучает лот и уточняет условия в защищённом чате",
              events: {
                create: {
                  status: "REQUEST_CREATED",
                  title: "Назначен проверенный партнёр",
                  description: `Ответственный партнёр: ${organization.legalName}. Контакты сторон скрыты; общение ведётся внутри сделки.`,
                  responsibleRole: "PLATFORM",
                  source: "MANUAL",
                  authorId: session.user.id,
                },
              },
              messages: {
                create: {
                  senderId: session.user.id,
                  content: "Площадка назначила проверенного партнёра. Обсуждайте лот, маршрут и документы здесь — внешние контакты в этом чате блокируются.",
                  isSystem: true,
                },
              },
            },
          })
        } else {
          const title = `${inquiry.auctionListing.make} ${inquiry.auctionListing.model} ${inquiry.auctionListing.year}`
          const safeDescription = inquiry.comment && inspectContactSharing(inquiry.comment).allowed
            ? inquiry.comment
            : null
          const order = await tx.deliveryOrder.create({
            data: {
              code: makeDeliveryCode(),
              kind: "VEHICLE",
              sourceType: "AUCTION",
              title,
              description: safeDescription,
              auctionListingId: inquiry.auctionListing.id,
              lotNumber: inquiry.auctionListing.lotNumber,
              originCountry: inquiry.auctionListing.country,
              originCity: inquiry.auctionListing.location,
              destinationCity: inquiry.city || "Город уточняется",
              buyerId: requesterId,
              partnerId,
              managerId: session.user.id,
              buyerDepositAmount,
              buyerDepositStatus: "NOT_REQUESTED",
              monetizationModel: ACTIVE_MONETIZATION_MODEL,
              platformFeeAmount,
              platformFeeStatus: "NOT_REQUESTED",
              nextAction: "Партнёр изучает лот и уточняет условия в защищённом чате",
              events: {
                create: {
                  status: "REQUEST_CREATED",
                  title: "Заявка передана проверенному партнёру",
                  description: `Ответственный партнёр: ${organization.legalName}. До выставления счёта стороны согласуют условия в чате.`,
                  responsibleRole: "PLATFORM",
                  source: "MANUAL",
                  authorId: session.user.id,
                },
              },
              messages: {
                create: {
                  senderId: session.user.id,
                  content: "Сделка открыта. Партнёр видит только имя и город покупателя; телефон и почта ему не передаются. Внешние контакты в сообщениях блокируются.",
                  isSystem: true,
                },
              },
            },
            select: { id: true },
          })
          deliveryOrderId = order.id
          createdNewOrder = true
        }

        const inquiryData = {
            status: "IN_PROGRESS",
            assignedPartnerId: partnerId,
            assignedById: session.user.id,
            assignedAt: now,
            deliveryOrderId,
            monetizationModel: ACTIVE_MONETIZATION_MODEL,
            platformFeeAmount,
            buyerDepositAmount,
            startedAt: inquiry.startedAt || now,
        }
        let updated: { id: string; status: string; deliveryOrderId: string | null }
        if (createdNewOrder) {
          const claimed = await tx.auctionInquiry.updateMany({
            where: { id: inquiry.id, deliveryOrderId: null },
            data: inquiryData,
          })
          if (claimed.count === 0) throw new Error(ASSIGNMENT_CONFLICT)
          updated = { id: inquiry.id, status: "IN_PROGRESS", deliveryOrderId }
        } else {
          updated = await tx.auctionInquiry.update({
            where: { id: inquiry.id },
            data: inquiryData,
            select: { id: true, status: true, deliveryOrderId: true },
          })
        }

        await tx.auctionInquiryOffer.updateMany({
          where: { inquiryId: inquiry.id, status: "OFFERED" },
          data: { status: "EXPIRED", respondedAt: now },
        })

        await tx.notification.createMany({
          data: [
            {
              userId: requesterId,
              title: "По заявке назначен партнёр",
              content: `Сделка по ${inquiry.auctionListing.make} ${inquiry.auctionListing.model} открыта в кабинете. Продолжите общение в защищённом чате.`,
              type: "INFO",
              relatedId: deliveryOrderId,
              relatedType: "DELIVERY_ORDER",
            },
            {
              userId: partnerId,
              title: "Новая заявка на выкуп",
              content: `${inquiry.auctionListing.make} ${inquiry.auctionListing.model} ${inquiry.auctionListing.year} · ${inquiry.city || "город уточняется"}`,
              type: "INFO",
              relatedId: deliveryOrderId,
              relatedType: "DELIVERY_ORDER",
            },
          ],
        })

        return updated
      })
      await recordAdminAudit({
        actorId: session.user.id,
        actorEmail: session.user.email,
        action: "AUCTION_INQUIRY_ASSIGN",
        entityType: "AuctionInquiry",
        entityId: inquiry.id,
        summary: `Заявка на ${inquiry.auctionListing.make} ${inquiry.auctionListing.model} ${inquiry.auctionListing.year} назначена партнёру «${organization.legalName}»`,
        metadata: {
          partnerId,
          deliveryOrderId: result.deliveryOrderId,
          monetizationModel: ACTIVE_MONETIZATION_MODEL,
          platformFeeAmount,
          buyerDepositAmount,
        },
      })
      return NextResponse.json({ success: true, inquiry: result })
    }

    const { id, status, managerNotes } = body as Record<string, unknown>
    if (typeof id !== "string" || typeof status !== "string" || !INQUIRY_STATUSES.has(status)) {
      return NextResponse.json({ error: "Некорректные данные заявки" }, { status: 400 })
    }
    if (managerNotes !== undefined && (typeof managerNotes !== "string" || managerNotes.length > 4_000)) return NextResponse.json({ error: "Комментарий менеджера не должен превышать 4000 символов" }, { status: 400 })

    const existing = await prisma.auctionInquiry.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        auctionListing: { select: { make: true, model: true, year: true } },
      },
    })
    if (!existing) return NextResponse.json({ error: "Заявка не найдена" }, { status: 404 })

    const updated = await prisma.auctionInquiry.update({
      where: { id },
      data: {
        status,
        closedAt: status === "CLOSED" || status === "SOLD" ? new Date() : null,
        ...(managerNotes !== undefined ? { managerNotes: managerNotes.trim() || null } : {}),
      },
    })
    await recordAdminAudit({
      actorId: session.user.id,
      actorEmail: session.user.email,
      action: "AUCTION_INQUIRY_UPDATE",
      entityType: "AuctionInquiry",
      entityId: id,
      summary: `Заявка на ${existing.auctionListing.make} ${existing.auctionListing.model} ${existing.auctionListing.year}: «${adminAuditValueLabel(existing.status)}» → «${adminAuditValueLabel(status)}»`,
      metadata: { previousStatus: existing.status, nextStatus: status, managerNotesUpdated: managerNotes !== undefined },
    })
    return NextResponse.json({ success: true, inquiry: updated })
  } catch (error) {
    if (error instanceof Error && error.message === ASSIGNMENT_CONFLICT) {
      return NextResponse.json({ error: "Заявка уже назначена другим действием. Обновите страницу." }, { status: 409 })
    }
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
      return NextResponse.json({ error: "Заявка не найдена" }, { status: 404 })
    }
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
