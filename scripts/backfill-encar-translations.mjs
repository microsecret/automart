#!/usr/bin/env node

/**
 * Repairs only three verified Encar descriptions that a historical importer
 * marked as translated while retaining the Korean source text. The original
 * remains immutable; this deliberately does not import TypeScript runtime
 * code or make an unbounded model request from a maintenance script.
 *
 * Usage on the application server:
 *   NODE_PATH=./node_modules node scripts/backfill-encar-translations.mjs --dry-run
 *   NODE_PATH=./node_modules node scripts/backfill-encar-translations.mjs --apply
 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const shouldApply = process.argv.includes("--apply")
const VERIFIED_DESCRIPTION_TRANSLATIONS = new Map([
  ["신차 출고 후 1인이 운행 차량 입니다~", "С момента выдачи нового автомобиля эксплуатировался одним владельцем."],
  ["#도색도없음@렌트이력없음@신차1억900@SDS@20인치휠@하이테크^^", "Без окрасов; без истории аренды; цена нового авто по данным источника — 109 млн ₩; пакет SDS, 20-дюймовые колёса и Hi‑Tech."],
  ["/엔카진단//정비완료//할부대차OK/신차와 동일 / 전국최저가 !!", "Диагностика Encar; обслуживание выполнено; возможны кредит и трейд-ин; состояние как у нового авто; заявлена минимальная цена по стране."],
])

try {
  const listings = await prisma.auctionListing.findMany({
    where: { source: "ENCAR", status: "ACTIVE" },
    select: { id: true, sourceId: true, descriptionOrig: true, descriptionRu: true, specsOrig: true, specsRu: true },
  })
  const updates = listings.flatMap((listing) => {
    const descriptionRu = listing.descriptionOrig ? VERIFIED_DESCRIPTION_TRANSLATIONS.get(listing.descriptionOrig) : null
    return descriptionRu && descriptionRu !== listing.descriptionRu
      ? [{ id: listing.id, sourceId: listing.sourceId, descriptionRu }]
      : []
  })

  if (shouldApply && updates.length) {
    await prisma.$transaction(updates.map((update) => prisma.auctionListing.update({
      where: { id: update.id },
      data: {
        descriptionRu: update.descriptionRu,
        isTranslated: true,
        translatedAt: new Date(),
      },
    })))
  }

  console.log(JSON.stringify({
    mode: shouldApply ? "apply" : "dry-run",
    scanned: listings.length,
    updates: updates.map(({ sourceId }) => ({ sourceId, descriptionRepaired: true })),
  }, null, 2))
} finally {
  await prisma.$disconnect()
}
