#!/usr/bin/env node

/**
 * Deterministically fills only Encar values that were already published by
 * the source but were skipped by an older exact-match normalizer.
 *
 * Usage on the application server:
 *   NODE_PATH=./node_modules node scripts/backfill-encar-derived-specs.mjs --dry-run
 *   NODE_PATH=./node_modules node scripts/backfill-encar-derived-specs.mjs --apply
 *
 * This script never infers horsepower, vehicle type from a model name, or a
 * source field that is absent. It also removes a non-engine displacement
 * value from fully electric cars: Encar publishes this service field, but it
 * is not an engine volume and must not be shown as litres. Ambiguous cargo
 * and sport classifications are deliberately left untouched for a confirmed
 * source mapping.
 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const shouldApply = process.argv.includes("--apply")

function sourceSpecParts(value) {
  return typeof value === "string"
    ? value.split("·").map((part) => part.trim()).filter(Boolean)
    : []
}

function deriveFuelType(specsOrig) {
  const rawFuel = sourceSpecParts(specsOrig)[1]
  if (!rawFuel) return null
  if (["가솔린+전기", "가솔린 + 전기", "전기+가솔린"].includes(rawFuel)) return "HYBRID"
  if (rawFuel === "LPG(일반인 구입)" || rawFuel === "LPG (일반인 구입)") return "GAS"
  return null
}

function deriveBodyType(specsOrig) {
  const rawBody = sourceSpecParts(specsOrig)[0]
  return rawBody === "RV" || rawBody === "승합차" ? "MINIVAN" : null
}

try {
  const listings = await prisma.auctionListing.findMany({
    where: {
      source: "ENCAR",
      status: "ACTIVE",
      OR: [{ fuelType: null }, { bodyType: null }, { fuelType: "ELECTRIC", engineVolume: { not: null } }],
    },
    select: { id: true, sourceId: true, specsOrig: true, fuelType: true, bodyType: true, engineVolume: true },
  })

  const updates = listings.flatMap((listing) => {
    const fuelType = listing.fuelType || deriveFuelType(listing.specsOrig)
    const bodyType = listing.bodyType || deriveBodyType(listing.specsOrig)
    const engineVolume = fuelType === "ELECTRIC" ? null : listing.engineVolume
    if (fuelType === listing.fuelType && bodyType === listing.bodyType && engineVolume === listing.engineVolume) return []
    return [{
      id: listing.id,
      sourceId: listing.sourceId,
      fuelType,
      bodyType,
      engineVolume,
      fuelFilled: listing.fuelType === null && fuelType !== null,
      bodyFilled: listing.bodyType === null && bodyType !== null,
      electricVolumeCleared: listing.engineVolume !== null && engineVolume === null,
    }]
  })

  if (shouldApply && updates.length) {
    await prisma.$transaction(updates.map((update) => prisma.auctionListing.update({
      where: { id: update.id },
      data: { fuelType: update.fuelType, bodyType: update.bodyType, engineVolume: update.engineVolume },
    })))
  }

  console.log(JSON.stringify({
    mode: shouldApply ? "apply" : "dry-run",
    scanned: listings.length,
    updates: updates.length,
    fuelFilled: updates.filter((update) => update.fuelFilled).length,
    bodyFilled: updates.filter((update) => update.bodyFilled).length,
    electricVolumeCleared: updates.filter((update) => update.electricVolumeCleared).length,
    records: updates.map(({ sourceId, fuelType, bodyType, engineVolume }) => ({ sourceId, fuelType, bodyType, engineVolume })),
  }, null, 2))
} finally {
  await prisma.$disconnect()
}
