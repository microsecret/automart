import { prisma } from "@/lib/prisma"

const CONFIRMED_MISSING_CHECKS = 2

export async function confirmAuctionListingsMissing(source: string, sourceIds: readonly string[]) {
  const uniqueIds = [...new Set(sourceIds.map((id) => id.trim()).filter(Boolean))].slice(0, 5_000)
  if (!uniqueIds.length) return { checked: 0, expired: 0 }
  const listings = await prisma.auctionListing.findMany({
    where: { source, sourceId: { in: uniqueIds }, status: "ACTIVE" },
    select: { id: true, sourceMissingChecks: true },
  })
  let expired = 0
  for (const listing of listings) {
    const sourceMissingChecks = listing.sourceMissingChecks + 1
    const shouldExpire = sourceMissingChecks >= CONFIRMED_MISSING_CHECKS
    await prisma.auctionListing.update({
      where: { id: listing.id },
      data: { lastChecked: new Date(), sourceMissingChecks, status: shouldExpire ? "EXPIRED" : "ACTIVE" },
    })
    if (shouldExpire) expired += 1
  }
  return { checked: listings.length, expired }
}

export async function confirmMissingFromCompleteSnapshot(source: string, presentSourceIds: readonly string[]) {
  const present = new Set(presentSourceIds)
  const activeIds = await prisma.auctionListing.findMany({
    where: { source, status: "ACTIVE" },
    select: { sourceId: true },
  })
  return confirmAuctionListingsMissing(source, activeIds.flatMap((item) => present.has(item.sourceId) ? [] : [item.sourceId]))
}
