import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const REQUIRED_TRIGGERS = [
  "Listing_require_exactly_one_subject_insert",
  "Listing_require_exactly_one_subject_update",
  "Vehicle_delete_linked_listing",
  "Part_delete_linked_listing",
]
const REQUIRED_INDEXES = [
  "Listing_live_vehicle_subject_key",
  "Listing_live_part_subject_key",
]

async function main() {
  const [orphanedListings, ambiguousListings, vehicleCount, partCount, listingCount, userCount, auctionCount, newsCount, triggers, indexes, duplicateLiveSubjects] = await Promise.all([
    prisma.listing.findMany({
      where: { vehicleId: null, partId: null },
      select: { id: true, title: true, status: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.listing.findMany({
      where: { vehicleId: { not: null }, partId: { not: null } },
      select: { id: true, title: true, status: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.vehicle.count(),
    prisma.part.count(),
    prisma.listing.count(),
    prisma.user.count(),
    prisma.auctionListing.count(),
    prisma.news.count(),
    prisma.$queryRawUnsafe("SELECT name FROM sqlite_master WHERE type = 'trigger'"),
    prisma.$queryRawUnsafe("SELECT name FROM sqlite_master WHERE type = 'index'"),
    prisma.$queryRawUnsafe(`
      SELECT 'vehicle' AS kind, vehicleId AS subjectId, COUNT(*) AS total
      FROM "Listing"
      WHERE "vehicleId" IS NOT NULL AND "deletedAt" IS NULL AND "status" <> 'ARCHIVED'
      GROUP BY "vehicleId"
      HAVING COUNT(*) > 1
      UNION ALL
      SELECT 'part' AS kind, partId AS subjectId, COUNT(*) AS total
      FROM "Listing"
      WHERE "partId" IS NOT NULL AND "deletedAt" IS NULL AND "status" <> 'ARCHIVED'
      GROUP BY "partId"
      HAVING COUNT(*) > 1
    `),
  ])

  const installedTriggers = triggers.map((trigger) => trigger.name).filter((name) => typeof name === "string")
  const missingTriggers = REQUIRED_TRIGGERS.filter((name) => !installedTriggers.includes(name))
  const installedIndexes = indexes.map((index) => index.name).filter((name) => typeof name === "string")
  const missingIndexes = REQUIRED_INDEXES.filter((name) => !installedIndexes.includes(name))

  const report = {
    checkedAt: new Date().toISOString(),
    totals: {
      users: userCount,
      listings: listingCount,
      vehicles: vehicleCount,
      parts: partCount,
      auctionLots: auctionCount,
      news: newsCount,
    },
    integrity: {
      orphanedListings: orphanedListings.length,
      ambiguousListings: ambiguousListings.length,
      duplicateLiveSubjects: duplicateLiveSubjects.length,
      valid: orphanedListings.length === 0 && ambiguousListings.length === 0 && duplicateLiveSubjects.length === 0 && missingTriggers.length === 0 && missingIndexes.length === 0,
    },
    databaseTriggers: {
      installed: REQUIRED_TRIGGERS.filter((name) => installedTriggers.includes(name)),
      missing: missingTriggers,
    },
    databaseIndexes: {
      installed: REQUIRED_INDEXES.filter((name) => installedIndexes.includes(name)),
      missing: missingIndexes,
    },
    samples: {
      orphanedListings,
      ambiguousListings,
      duplicateLiveSubjects,
    },
  }

  console.log(JSON.stringify(report, null, 2))
}

main()
  .catch((error) => {
    console.error("Failed to audit listing integrity", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
