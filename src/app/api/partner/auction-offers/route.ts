import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { inspectContactSharing } from "@/lib/contact-sharing-policy"
import { makeDeliveryCode } from "@/lib/delivery"
import { prisma } from "@/lib/prisma"
import { refreshPartnerSlaMetrics } from "@/lib/partner-sla-refresh"

export const dynamic = "force-dynamic"

const CLAIM_CONFLICT = "AUCTION_OFFER_CLAIM_CONFLICT"
const PLATFORM_FEE = Number(process.env.AUCTION_PLATFORM_FEE_RUB) || 50_000
const BUYER_DEPOSIT = Number(process.env.AUCTION_BUYER_DEPOSIT_RUB) || 100_000

async function verifiedOrganization(ownerId: string) {
  return prisma.deliveryOrganization.findFirst({
    where: { ownerId, verificationStatus: "VERIFIED" },
    select: { id: true, legalName: true },
  })
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const organization = await verifiedOrganization(session.user.id)
    if (!organization) return NextResponse.json({ offers: [], organization: null })

    const offers = await prisma.auctionInquiryOffer.findMany({
      where: {
        organizationId: organization.id,
        status: "OFFERED",
        expiresAt: { gt: new Date() },
        inquiry: { assignedPartnerId: null },
      },
      orderBy: [{ matchScore: "desc" }, { createdAt: "asc" }],
      take: 30,
      select: {
        id: true,
        matchReason: true,
        expiresAt: true,
        createdAt: true,
        inquiry: {
          select: {
            id: true,
            name: true,
            city: true,
            comment: true,
            auctionListing: {
              select: {
                id: true,
                make: true,
                model: true,
                year: true,
                country: true,
                source: true,
                lotNumber: true,
                finalPrice: true,
                imageUrl: true,
              },
            },
          },
        },
      },
    })

    return NextResponse.json({
      organization,
      offers: offers.map((offer) => ({
        ...offer,
        inquiry: {
          ...offer.inquiry,
          comment: offer.inquiry.comment && inspectContactSharing(offer.inquiry.comment).allowed
            ? offer.inquiry.comment
            : null,
        },
      })),
    })
  } catch (error) {
    console.error("Partner auction offers error:", error)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const organization = await verifiedOrganization(session.user.id)
    if (!organization) return NextResponse.json({ error: "Доступ есть только у проверенного партнёра" }, { status: 403 })

    const body = await request.json().catch(() => null) as { offerId?: unknown } | null
    const offerId = typeof body?.offerId === "string" ? body.offerId.trim() : ""
    if (!offerId) return NextResponse.json({ error: "Выберите заявку" }, { status: 400 })

    const offer = await prisma.auctionInquiryOffer.findFirst({
      where: { id: offerId, organizationId: organization.id, partnerId: session.user.id },
      include: {
        inquiry: {
          include: {
            auctionListing: {
              select: { id: true, make: true, model: true, year: true, country: true, location: true, lotNumber: true },
            },
          },
        },
      },
    })
    if (!offer) return NextResponse.json({ error: "Заявка не найдена" }, { status: 404 })
    if (offer.status !== "OFFERED" || offer.expiresAt <= new Date() || offer.inquiry.assignedPartnerId) {
      return NextResponse.json({ error: "Заявка уже принята другим партнёром или срок предложения истёк" }, { status: 409 })
    }
    if (!offer.inquiry.requesterId) return NextResponse.json({ error: "Заявка не привязана к аккаунту покупателя" }, { status: 409 })

    const requesterId = offer.inquiry.requesterId
    const now = new Date()
    const order = await prisma.$transaction(async (tx) => {
      const accepted = await tx.auctionInquiryOffer.updateMany({
        where: { id: offer.id, status: "OFFERED", expiresAt: { gt: now } },
        data: { status: "ACCEPTED", respondedAt: now },
      })
      if (!accepted.count) throw new Error(CLAIM_CONFLICT)

      const title = [
        offer.inquiry.auctionListing.make,
        offer.inquiry.auctionListing.model,
        offer.inquiry.auctionListing.year,
      ].join(" ")
      const safeDescription = offer.inquiry.comment && inspectContactSharing(offer.inquiry.comment).allowed
        ? offer.inquiry.comment
        : null
      const createdOrder = await tx.deliveryOrder.create({
        data: {
          code: makeDeliveryCode(),
          kind: "VEHICLE",
          sourceType: "AUCTION",
          title,
          description: safeDescription,
          auctionListingId: offer.inquiry.auctionListing.id,
          lotNumber: offer.inquiry.auctionListing.lotNumber,
          originCountry: offer.inquiry.auctionListing.country,
          originCity: offer.inquiry.auctionListing.location,
          destinationCity: offer.inquiry.city || "Город уточняется",
          buyerId: requesterId,
          partnerId: session.user.id,
          buyerDepositAmount: BUYER_DEPOSIT,
          buyerDepositStatus: "NOT_REQUESTED",
          monetizationModel: "DEAL_FEE",
          platformFeeAmount: PLATFORM_FEE,
          platformFeeStatus: "NOT_REQUESTED",
          nextAction: "Партнёр изучает лот и уточняет условия в защищённом чате",
          events: {
            create: {
              status: "REQUEST_CREATED",
              title: "Проверенный партнёр принял заявку",
              description: [
                "Ответственный партнёр:",
                organization.legalName + ".",
                "Контакты сторон скрыты; условия согласуются внутри LeWheel.",
              ].join(" "),
              responsibleRole: "PARTNER",
              source: "PARTNER",
              authorId: session.user.id,
            },
          },
          messages: {
            create: {
              senderId: session.user.id,
              content: "Партнёр принял заявку. Обсуждайте автомобиль, маршрут и документы здесь — обмен внешними контактами блокируется.",
              isSystem: true,
            },
          },
        },
        select: { id: true, code: true },
      })

      const claimed = await tx.auctionInquiry.updateMany({
        where: { id: offer.inquiryId, assignedPartnerId: null, deliveryOrderId: null },
        data: {
          status: "IN_PROGRESS",
          assignedPartnerId: session.user.id,
          assignedAt: now,
          deliveryOrderId: createdOrder.id,
          monetizationModel: "DEAL_FEE",
          platformFeeAmount: PLATFORM_FEE,
          buyerDepositAmount: BUYER_DEPOSIT,
          startedAt: now,
        },
      })
      if (!claimed.count) throw new Error(CLAIM_CONFLICT)

      // Заявку забрал другой партнёр. Остальные предложения снимаются как
      // «перехвачено»: партнёр не отвечал и не отказывался, поэтому такой
      // оффер не должен ухудшать его показатель отзывчивости.
      await tx.auctionInquiryOffer.updateMany({
        where: { inquiryId: offer.inquiryId, id: { not: offer.id }, status: "OFFERED" },
        data: { status: "SUPERSEDED", respondedAt: now },
      })
      await tx.notification.createMany({
        data: [
          {
            userId: requesterId,
            title: "Проверенный партнёр принял заявку",
            content: "Сделка открыта в кабинете. Продолжите общение в защищённом чате LeWheel.",
            type: "SUCCESS",
            relatedId: createdOrder.id,
            relatedType: "DELIVERY_ORDER",
          },
          {
            userId: session.user.id,
            title: "Заявка принята в работу",
            content: title + " · " + (offer.inquiry.city || "город уточняется"),
            type: "SUCCESS",
            relatedId: createdOrder.id,
            relatedType: "DELIVERY_ORDER",
          },
        ],
      })
      return createdOrder
    })

    // Показатели обновляются после сделки, а не в транзакции: их расхождение
    // на несколько секунд безопаснее, чем удлинение критичной операции.
    await refreshPartnerSlaMetrics(offer.organizationId).catch((error) => {
      console.error("Partner SLA refresh failed", error instanceof Error ? error.message : error)
    })

    return NextResponse.json({ success: true, order })
  } catch (error) {
    if (error instanceof Error && error.message === CLAIM_CONFLICT) {
      return NextResponse.json({ error: "Заявку уже принял другой партнёр. Обновите список." }, { status: 409 })
    }
    console.error("Partner auction offer claim error:", error)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
