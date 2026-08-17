import { prisma } from "@/lib/prisma"
import { buildPartnerSlaMetrics } from "@/lib/partner-sla"

/**
 * Пересчитывает показатели качества партнёров из фактических офферов и заявок.
 *
 * Вызывается фоново, а не на каждом распределении: история растёт, и считать
 * её при каждой новой заявке значило бы замедлять ответ покупателю.
 */
export async function refreshPartnerSlaMetrics(organizationId?: string) {
  const organizations = await prisma.deliveryOrganization.findMany({
    where: organizationId ? { id: organizationId } : {},
    select: { id: true, ownerId: true },
  })

  let updated = 0
  for (const organization of organizations) {
    const [offers, closedDeals] = await Promise.all([
      prisma.auctionInquiryOffer.findMany({
        where: { organizationId: organization.id },
        select: { status: true, createdAt: true, respondedAt: true, expiresAt: true },
      }),
      prisma.auctionInquiry.count({
        where: { assignedPartnerId: organization.ownerId, status: { in: ["CLOSED", "SOLD"] } },
      }),
    ])

    const metrics = buildPartnerSlaMetrics(offers, closedDeals)
    await prisma.deliveryOrganization.update({
      where: { id: organization.id },
      data: {
        slaResponseMinutes: metrics.responseMinutes,
        slaAcceptedOffers: metrics.acceptedOffers,
        slaMissedOffers: metrics.missedOffers,
        slaClosedDeals: metrics.closedDeals,
        slaRating: metrics.rating,
        slaUpdatedAt: new Date(),
      },
    })
    updated += 1
  }

  return { updated }
}
