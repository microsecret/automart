#!/usr/bin/env node

/**
 * Repairs only source-confirmed Korean colour names that an earlier prefix
 * replacement partially translated. It intentionally derives the colour from
 * the raw Encar spec snapshot instead of model names or images.
 *
 * Usage on the application server:
 *   NODE_PATH=./node_modules node scripts/backfill-encar-colors.mjs --dry-run
 *   NODE_PATH=./node_modules node scripts/backfill-encar-colors.mjs --apply
 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const shouldApply = process.argv.includes("--apply")
const COLOR_BY_SOURCE_VALUE = new Map([
  ["명은색", "ярко-серебристый"],
  ["연금색", "светло-золотистый"],
  ["청옥색", "бирюзовый"],
  ["은하색", "серо-металлический"],
  ["하늘색", "голубой"],
  ["갈대색", "песочно-бежевый"],
  ["연두색", "салатовый"],
])

function sourceColor(value) {
  if (typeof value !== "string") return null
  const parts = value.split("·").map((part) => part.trim()).filter(Boolean)
  return parts.at(-1) || null
}

try {
  const listings = await prisma.auctionListing.findMany({
    where: { source: "ENCAR", status: "ACTIVE" },
    select: { id: true, sourceId: true, specsOrig: true, color: true },
  })
  const updates = listings.flatMap((listing) => {
    const originalColor = sourceColor(listing.specsOrig)
    const color = originalColor ? COLOR_BY_SOURCE_VALUE.get(originalColor) : null
    return color && color !== listing.color
      ? [{ id: listing.id, sourceId: listing.sourceId, originalColor, color }]
      : []
  })

  if (shouldApply && updates.length) {
    await prisma.$transaction(updates.map((update) => prisma.auctionListing.update({
      where: { id: update.id },
      data: { color: update.color },
    })))
  }

  console.log(JSON.stringify({
    mode: shouldApply ? "apply" : "dry-run",
    scanned: listings.length,
    updates: updates.length,
    records: updates.map(({ sourceId, originalColor, color }) => ({ sourceId, originalColor, color })),
  }, null, 2))
} finally {
  await prisma.$disconnect()
}
