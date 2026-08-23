#!/usr/bin/env node

// Показатели качества партнёров пересчитываются фоново: распределение заявки
// читает готовое значение и не обходит историю офферов на каждом запросе.
// Пропущенные предложения выявляются только по истечении срока, поэтому
// регулярный прогон нужен даже без действий партнёров.
//
// Запуск: node scripts/refresh-partner-sla.mjs

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { PrismaClient } from "@prisma/client"
import { calculatePartnerRating, scoreAuctionPartner } from "../src/lib/partner-scoring.js"

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const envPath = path.join(projectRoot, ".env")
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (!match || process.env[match[1]]) continue
    process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "")
  }
}

const prisma = new PrismaClient()

const OFFER_LIMIT = 3
const OFFER_TTL_MS = 24 * 60 * 60 * 1000

function median(values) {
  if (!values.length) return null
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? Math.round((sorted[middle - 1] + sorted[middle]) / 2) : sorted[middle]
}

async function main() {
  const organizations = await prisma.deliveryOrganization.findMany({ select: { id: true, ownerId: true, legalName: true } })
  const now = new Date()
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

    const owned = offers.filter((offer) => offer.status !== "SUPERSEDED")
    const responseMinutes = median(
      owned.filter((offer) => offer.respondedAt)
        .map((offer) => Math.max(0, Math.round((offer.respondedAt.getTime() - offer.createdAt.getTime()) / 60_000))),
    )
    const acceptedOffers = owned.filter((offer) => offer.status === "ACCEPTED").length
    const missedOffers = owned.filter((offer) => offer.status !== "ACCEPTED" && offer.status !== "DECLINED" && !offer.respondedAt && offer.expiresAt <= now).length
    const rating = calculatePartnerRating({ responseMinutes, acceptedOffers, missedOffers, closedDeals })

    await prisma.deliveryOrganization.update({
      where: { id: organization.id },
      data: {
        slaResponseMinutes: responseMinutes,
        slaAcceptedOffers: acceptedOffers,
        slaMissedOffers: missedOffers,
        slaClosedDeals: closedDeals,
        slaRating: rating,
        slaUpdatedAt: now,
      },
    })
    updated += 1
  }

  // Освобождаем просроченные предложения и передаём неразобранные заявки
  // следующей группе партнёров. Повторно одному партнёру заявку не предлагаем:
  // уникальность пары inquiry/partner остаётся дополнительной защитой БД.
  const expired = await prisma.auctionInquiryOffer.updateMany({
    where: { status: "OFFERED", expiresAt: { lte: now } },
    data: { status: "EXPIRED" },
  })
  const pending = await prisma.auctionInquiry.findMany({
    where: {
      assignedPartnerId: null,
      deliveryOrderId: null,
      status: { in: ["NEW", "CONTACTED"] },
      offers: {
        some: { status: "EXPIRED" },
        none: { status: "OFFERED", expiresAt: { gt: now } },
      },
    },
    select: {
      id: true,
      city: true,
      auctionListing: { select: { make: true, model: true, year: true, country: true } },
      offers: { select: { partnerId: true } },
    },
    take: 100,
  })
  let rerouted = 0
  for (const inquiry of pending) {
    const attempted = new Set(inquiry.offers.map((offer) => offer.partnerId))
    const candidates = await prisma.deliveryOrganization.findMany({
      where: { verificationStatus: "VERIFIED", ownerId: { notIn: [...attempted] } },
      select: {
        id: true, legalName: true, ownerId: true, serviceRegions: true,
        slaRating: true, slaResponseMinutes: true,
        owner: { select: { _count: { select: {
          assignedAuctionInquiries: { where: { status: { in: ["CONTACTED", "IN_PROGRESS"] } } },
          auctionInquiryOffers: { where: { status: "OFFERED", expiresAt: { gt: now } } },
        } } } },
      },
    })
    const ranked = candidates.map((candidate) => ({
      ...candidate,
      ...scoreAuctionPartner({
        destinationCity: inquiry.city,
        sourceCountry: inquiry.auctionListing.country,
        serviceRegions: candidate.serviceRegions,
        activeAssignments: candidate.owner._count.assignedAuctionInquiries,
        openOffers: candidate.owner._count.auctionInquiryOffers,
        slaRating: candidate.slaRating,
        slaResponseMinutes: candidate.slaResponseMinutes,
      }),
    })).sort((left, right) => right.score - left.score || left.legalName.localeCompare(right.legalName, "ru")).slice(0, OFFER_LIMIT)
    if (!ranked.length) continue
    const expiresAt = new Date(now.getTime() + OFFER_TTL_MS)
    await prisma.$transaction([
      prisma.auctionInquiryOffer.createMany({
        data: ranked.map((partner) => ({
          inquiryId: inquiry.id, partnerId: partner.ownerId, organizationId: partner.id,
          matchScore: partner.score, matchReason: partner.reason, expiresAt,
        })),
      }),
      prisma.notification.createMany({
        data: ranked.map((partner) => ({
          userId: partner.ownerId,
          title: "Заявка переназначена вам",
          content: `${inquiry.auctionListing.make} ${inquiry.auctionListing.model} ${inquiry.auctionListing.year} · ${inquiry.city || "город уточняется"}`,
          type: "INFO", relatedId: inquiry.id, relatedType: "AUCTION_INQUIRY_OFFER",
        })),
      }),
    ])
    rerouted += 1
  }

  console.log(`[partner-sla] refreshed ${updated} organizations; expired ${expired.count} offers; rerouted ${rerouted} inquiries`)
}

main()
  .catch((error) => {
    console.error("[partner-sla] failed:", error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
