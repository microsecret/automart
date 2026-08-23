#!/usr/bin/env node

/**
 * Fills an empty drive type only when the source-confirmed model name contains
 * an unambiguous drivetrain badge. Existing source values are never replaced;
 * ambiguous `2WD` labels are deliberately left for source-specific parsers.
 *
 * Usage on the application server:
 *   node scripts/backfill-auction-explicit-drive-types.mjs --dry-run
 *   node scripts/backfill-auction-explicit-drive-types.mjs --apply
 */
import { PrismaClient } from "@prisma/client"
import { deriveAuctionDriveTypeFromText } from "../src/lib/auction-drive-badge.mjs"

const prisma = new PrismaClient()
const shouldApply = process.argv.includes("--apply")
const BATCH_SIZE = 250

try {
  const listings = await prisma.auctionListing.findMany({
    where: {
      status: "ACTIVE",
      adminHiddenAt: null,
      driveType: null,
    },
    select: { id: true, source: true, sourceId: true, model: true },
  })

  const updates = listings.flatMap((listing) => {
    const driveType = deriveAuctionDriveTypeFromText(listing.model)
    return driveType ? [{ ...listing, driveType }] : []
  })

  if (shouldApply) {
    for (let offset = 0; offset < updates.length; offset += BATCH_SIZE) {
      const batch = updates.slice(offset, offset + BATCH_SIZE)
      await prisma.$transaction(batch.map((update) => prisma.auctionListing.updateMany({
        where: { id: update.id, driveType: null },
        data: { driveType: update.driveType },
      })))
    }
  }

  const bySource = Object.fromEntries([...new Set(updates.map((update) => update.source))]
    .sort()
    .map((source) => [source, updates.filter((update) => update.source === source).length]))

  console.log(JSON.stringify({
    mode: shouldApply ? "apply" : "dry-run",
    scanned: listings.length,
    updates: updates.length,
    bySource,
    records: updates.slice(0, 30).map(({ source, sourceId, model, driveType }) => ({ source, sourceId, model, driveType })),
    recordsTruncated: updates.length > 30,
  }, null, 2))
} finally {
  await prisma.$disconnect()
}
