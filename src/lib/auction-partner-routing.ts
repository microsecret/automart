import { prisma } from "@/lib/prisma"
import { scoreAuctionPartner } from "./partner-scoring.js"

export { readServiceRegions, scoreAuctionPartner } from "./partner-scoring.js"

const OFFER_LIMIT = 3
const OFFER_TTL_MS = 24 * 60 * 60 * 1000
export async function routeAuctionInquiryToPartners(inquiryId: string) {
  const inquiry = await prisma.auctionInquiry.findUnique({
    where: { id: inquiryId },
    select: {
      id: true,
      city: true,
      assignedPartnerId: true,
      auctionListing: { select: { make: true, model: true, year: true, country: true } },
      offers: { select: { partnerId: true } },
    },
  })
  if (!inquiry || inquiry.assignedPartnerId) return { offered: 0 }

  const attemptedPartnerIds = inquiry.offers.map((offer) => offer.partnerId)

  const organizations = await prisma.deliveryOrganization.findMany({
    where: {
      verificationStatus: "VERIFIED",
      ...(attemptedPartnerIds.length ? { ownerId: { notIn: attemptedPartnerIds } } : {}),
    },
    select: {
      id: true,
      legalName: true,
      ownerId: true,
      serviceRegions: true,
      slaRating: true,
      slaResponseMinutes: true,
      owner: {
        select: {
          _count: {
            select: {
              assignedAuctionInquiries: { where: { status: { in: ["CONTACTED", "IN_PROGRESS"] } } },
              auctionInquiryOffers: { where: { status: "OFFERED", expiresAt: { gt: new Date() } } },
            },
          },
        },
      },
    },
  })
  if (!organizations.length) return { offered: 0 }

  const ranked = organizations
    .map((organization) => ({
      ...organization,
      ...scoreAuctionPartner({
        destinationCity: inquiry.city,
        sourceCountry: inquiry.auctionListing.country,
        serviceRegions: organization.serviceRegions,
        activeAssignments: organization.owner._count.assignedAuctionInquiries,
        openOffers: organization.owner._count.auctionInquiryOffers,
        slaRating: organization.slaRating,
        slaResponseMinutes: organization.slaResponseMinutes,
      }),
    }))
    .sort((first, second) => second.score - first.score || first.legalName.localeCompare(second.legalName, "ru"))
    .slice(0, OFFER_LIMIT)

  const expiresAt = new Date(Date.now() + OFFER_TTL_MS)
  await prisma.$transaction([
    prisma.auctionInquiryOffer.createMany({
      data: ranked.map((partner) => ({
        inquiryId: inquiry.id,
        partnerId: partner.ownerId,
        organizationId: partner.id,
        matchScore: partner.score,
        matchReason: partner.reason,
        expiresAt,
      })),
    }),
    prisma.notification.createMany({
      data: ranked.map((partner) => ({
        userId: partner.ownerId,
        title: "Новая заявка рядом",
        content: [
          inquiry.auctionListing.make,
          inquiry.auctionListing.model,
          inquiry.auctionListing.year,
          "·",
          inquiry.city || "город уточняется",
        ].join(" "),
        type: "INFO",
        relatedId: inquiry.id,
        relatedType: "AUCTION_INQUIRY_OFFER",
      })),
    }),
  ])

  return { offered: ranked.length }
}
