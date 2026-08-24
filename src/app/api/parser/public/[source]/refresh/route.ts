import { NextRequest, NextResponse } from "next/server"
import { saveAuctionImportItems } from "@/lib/auction-import"
import { fetchPublicAuctionListing, isPublicAuctionSource, isPublicListingUnavailableError } from "@/lib/public-auction-collectors"
import { prisma } from "@/lib/prisma"
import { closeStaleAuctionSyncRuns } from "@/lib/auction-sync-run"
import { refreshDueCutoff, refreshIntervalHours } from "@/lib/auction-crawl-policy"
import {
  AUCTION_SOURCE_CONSECUTIVE_FAILURE_LIMIT,
  auctionSourceStageBudgetExceeded,
  auctionSourceStageStatus,
  remainingAuctionSourceItems,
} from "@/lib/auction-sync-budget"

export const dynamic = "force-dynamic"

const MAX_LISTINGS_PER_REFRESH = 50

export async function POST(request: NextRequest, { params }: { params: Promise<{ source: string }> }) {
  let syncRunId: string | null = null
  const rawSource = (await params).source.toUpperCase()
  if (!isPublicAuctionSource(rawSource)) return NextResponse.json({ error: "Unknown public source" }, { status: 404 })
  const source = rawSource

  try {
    const stageStartedAt = Date.now()
    const parserToken = process.env.PARSER_TOKEN
    if (!parserToken) return NextResponse.json({ error: "Auction import is not configured" }, { status: 503 })
    if (request.headers.get("authorization") !== `Bearer ${parserToken}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const body = await request.json().catch(() => null) as { limit?: unknown } | null
    const requestedLimit = Number(body?.limit)
    const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), MAX_LISTINGS_PER_REFRESH) : MAX_LISTINGS_PER_REFRESH

    await closeStaleAuctionSyncRuns(source)
    const syncRun = await prisma.auctionSyncRun.create({ data: { source, syncKind: "REFRESH", requestedLimit: limit }, select: { id: true } })
    syncRunId = syncRun.id
    const listings = await prisma.auctionListing.findMany({
      where: { source, status: "ACTIVE", lastChecked: { lte: refreshDueCutoff(source) } }, orderBy: [{ lastChecked: "asc" }, { id: "asc" }], take: limit,
      select: { id: true, sourceId: true, sourceUrl: true, sourcePrice: true, year: true, manufacturedMonth: true, mileage: true, imageUrl: true, sourceMissingChecks: true },
    })

    let updated = 0
    let translated = 0
    let unavailable = 0
    let expired = 0
    let checked = 0
    let deferred = 0
    let consecutiveFailures = 0
    const failed: Array<{ id: string; error: string }> = []
    for (const [listingIndex, listing] of listings.entries()) {
      if (auctionSourceStageBudgetExceeded(stageStartedAt)) {
        deferred = remainingAuctionSourceItems(listings.length, listingIndex)
        break
      }
      checked += 1
      try {
        const item = await fetchPublicAuctionListing(source, listing)
        const result = await saveAuctionImportItems([item])
        updated += result.updated
        translated += result.translated
        consecutiveFailures = 0
      } catch (error) {
        if (isPublicListingUnavailableError(error)) {
          unavailable += 1
          consecutiveFailures = 0
          const sourceMissingChecks = listing.sourceMissingChecks + 1
          const shouldExpire = sourceMissingChecks >= 2
          await prisma.auctionListing.update({
            where: { id: listing.id }, data: { lastChecked: new Date(), sourceMissingChecks, status: shouldExpire ? "EXPIRED" : "ACTIVE" },
          })
          if (shouldExpire) expired += 1
          continue
        }
        await prisma.auctionListing.update({ where: { id: listing.id }, data: { lastChecked: new Date() } })
        failed.push({ id: listing.id, error: error instanceof Error ? error.message : `Не удалось проверить карточку ${source}` })
        consecutiveFailures += 1
        if (consecutiveFailures >= AUCTION_SOURCE_CONSECUTIVE_FAILURE_LIMIT) {
          deferred = remainingAuctionSourceItems(listings.length, listingIndex + 1)
          break
        }
      }
    }

    const status = auctionSourceStageStatus(checked, failed.length, deferred)
    await prisma.auctionSyncRun.update({
      where: { id: syncRun.id }, data: { status, discovered: checked, imported: updated, updated, failed: failed.length, expired, completedAt: new Date() },
    })
    return NextResponse.json({ success: true, source, status, refreshIntervalHours: refreshIntervalHours(source), checked, deferred, refreshed: updated, unavailable, expired, failed, updated, translated })
  } catch (error) {
    console.error(`${source} public refresh error:`, error)
    if (syncRunId) {
      await prisma.auctionSyncRun.update({
        where: { id: syncRunId },
        data: { status: "FAILED", error: error instanceof Error ? error.message.slice(0, 500) : "Неизвестная ошибка", completedAt: new Date() },
      }).catch(() => undefined)
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status: 500 })
  }
}
