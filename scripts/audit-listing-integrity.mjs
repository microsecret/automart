import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const REQUIRED_TRIGGERS = [
  "Listing_require_exactly_one_subject_insert",
  "Listing_require_exactly_one_subject_update",
  "Vehicle_delete_linked_listing",
  "Part_delete_linked_listing",
]

async function main() {
  const [orphanedListings, ambiguousListings, vehicleCount, partCount, listingCount, userCount, auctionCount, newsCount, triggers] = await Promise.all([
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
  ])

  const installedTriggers = triggers.map((trigger) => trigger.name).filter((name) => typeof name === "string")
  const missingTriggers = REQUIRED_TRIGGERS.filter((name) => !installedTriggers.includes(name))

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
      valid: orphanedListings.length === 0 && ambiguousListings.length === 0 && missingTriggers.length === 0,
    },
    databaseTriggers: {
      installed: REQUIRED_TRIGGERS.filter((name) => installedTriggers.includes(name)),
      missing: missingTriggers,
    },
    samples: {
      orphanedListings,
      ambiguousListings,
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
