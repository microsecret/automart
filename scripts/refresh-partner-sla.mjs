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

const SLA_RESPONSE_TARGET_MINUTES = 60
const SLA_NEUTRAL_RATING = 50

function median(values) {
  if (!values.length) return null
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? Math.round((sorted[middle - 1] + sorted[middle]) / 2) : sorted[middle]
}

// Правило намеренно повторяет `src/lib/partner-sla.ts`: скрипт запускается без
// сборки, поэтому импортировать TS-модуль нельзя. Расхождение поймает тест
// partner-sla, если формулу поменять только в одном месте.
function calculateRating({ responseMinutes, acceptedOffers, missedOffers, closedDeals }) {
  const answered = acceptedOffers + missedOffers
  if (!answered && responseMinutes === null && !closedDeals) return SLA_NEUTRAL_RATING
  const responsiveness = answered > 0 ? acceptedOffers / answered : 0.5
  const speed = responseMinutes === null
    ? 0.5
    : Math.max(0, Math.min(1, SLA_RESPONSE_TARGET_MINUTES / Math.max(SLA_RESPONSE_TARGET_MINUTES, responseMinutes)))
  const delivery = Math.min(1, closedDeals / 10)
  return Math.max(0, Math.min(100, Math.round(responsiveness * 55 + speed * 30 + delivery * 15)))
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
    const rating = calculateRating({ responseMinutes, acceptedOffers, missedOffers, closedDeals })

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

  console.log(`[partner-sla] refreshed ${updated} organizations`)
}

main()
  .catch((error) => {
    console.error("[partner-sla] failed:", error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
