import type { Prisma } from "@prisma/client"
import { resolveMaximumImportAgeYears } from "@/lib/import-age-policy"

export const UNIDENTIFIABLE_AUCTION_MAKES = ["Others", "Other", "Unknown", "Etc", "기타"]

export function buildPublicAuctionPolicy(now = new Date()) {
  const maxImportAgeYears = resolveMaximumImportAgeYears(undefined)
  const minimumImportYear = now.getFullYear() - maxImportAgeYears
  const earliestBoundaryMonth = `${minimumImportYear}-${String(now.getMonth() + 1).padStart(2, "0")}`
  const publicFreshnessBoundary = new Date(now.getTime() - 36 * 60 * 60 * 1_000)

  const where: Prisma.AuctionListingWhereInput = {
    status: "ACTIVE",
    OR: [{ auctionDate: null }, { auctionDate: { gte: now } }],
    year: { gte: minimumImportYear },
    AND: [
      { make: { notIn: UNIDENTIFIABLE_AUCTION_MAKES } },
      {
        OR: [
          { source: { not: "ENCAR" } },
          { source: "ENCAR", sourceLastSeenAt: { gte: publicFreshnessBoundary } },
        ],
      },
      {
        OR: [
          { year: { gt: minimumImportYear } },
          { year: minimumImportYear, manufacturedMonth: null },
          { year: minimumImportYear, manufacturedMonth: { gte: earliestBoundaryMonth } },
        ],
      },
    ],
  }

  return { where, maxImportAgeYears, minimumImportYear }
}
