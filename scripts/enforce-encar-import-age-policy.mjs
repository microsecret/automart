import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const DEFAULT_MAX_AGE_YEARS = 5

function configuredMaximumAge() {
  const parsed = Number(process.env.ENCAR_MAX_IMPORT_AGE_YEARS)
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= DEFAULT_MAX_AGE_YEARS ? parsed : DEFAULT_MAX_AGE_YEARS
}

function remainsWithinAgePolicy(listing, maxAgeYears, now) {
  const cutoff = new Date(now.getFullYear() - maxAgeYears, now.getMonth(), now.getDate())
  const match = listing.manufacturedMonth?.match(/^(\d{4})-(0[1-9]|1[0-2])$/)
  const year = match ? Number(match[1]) : listing.year
  const latestPossibleRelease = match ? new Date(year, Number(match[2]), 0) : new Date(year, 11, 31)
  return latestPossibleRelease >= cutoff
}

async function main() {
  const maxAgeYears = configuredMaximumAge()
  const listings = await prisma.auctionListing.findMany({
    where: { source: "ENCAR", status: "ACTIVE" },
    select: { id: true, year: true, manufacturedMonth: true },
  })
  const ids = listings
    .filter((listing) => !remainsWithinAgePolicy(listing, maxAgeYears, new Date()))
    .map((listing) => listing.id)
  const result = ids.length
    ? await prisma.auctionListing.updateMany({ where: { id: { in: ids }, status: "ACTIVE" }, data: { status: "POLICY_EXCLUDED" } })
    : { count: 0 }
  console.log(JSON.stringify({ source: "ENCAR", maxAgeYears, activeScanned: listings.length, policyExcluded: result.count }))
}

main()
  .catch((error) => {
    console.error("Failed to enforce Encar import-age policy", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
