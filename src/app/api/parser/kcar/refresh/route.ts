import { NextRequest, NextResponse } from "next/server"
import { saveAuctionImportItems } from "@/lib/auction-import"
import { fetchKCarListing, isKCarListingUnavailableError } from "@/lib/kcar-public-collector"
import { prisma } from "@/lib/prisma"
import { closeStaleAuctionSyncRuns } from "@/lib/auction-sync-run"

export const dynamic = "force-dynamic"

const MAX_LISTINGS_PER_REFRESH = 40

export async function POST(request: NextRequest) {
  let syncRunId: string | null = null
  try {
    const parserToken = process.env.PARSER_TOKEN
    if (!parserToken) return NextResponse.json({ error: "Auction import is not configured" }, { status: 503 })
    if (request.headers.get("authorization") !== `Bearer ${parserToken}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json().catch(() => null) as { limit?: unknown } | null
    const requestedLimit = Number(body?.limit)
    const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), MAX_LISTINGS_PER_REFRESH) : MAX_LISTINGS_PER_REFRESH
    await closeStaleAuctionSyncRuns("KCAR")
    const syncRun = await prisma.auctionSyncRun.create({ data: { source: "KCAR", syncKind: "REFRESH", requestedLimit: limit }, select: { id: true } })
    syncRunId = syncRun.id

    const listings = await prisma.auctionListing.findMany({
      where: { source: "KCAR", status: "ACTIVE" },
      orderBy: [{ lastChecked: "asc" }, { id: "asc" }],
      take: limit,
      select: { id: true, sourceId: true, sourceMissingChecks: true },
    })

    let updated = 0
    let translated = 0
    let unavailable = 0
    let expired = 0
    const failed: Array<{ id: string; error: string }> = []
    for (const listing of listings) {
      try {
        const result = await saveAuctionImportItems([await fetchKCarListing(listing.sourceId)])
        updated += result.updated
        translated += result.translated
      } catch (error) {
        if (isKCarListingUnavailableError(error)) {
          unavailable += 1
          const sourceMissingChecks = listing.sourceMissingChecks + 1
          const shouldExpire = sourceMissingChecks >= 2
          await prisma.auctionListing.update({
            where: { id: listing.id },
            data: { lastChecked: new Date(), sourceMissingChecks, status: shouldExpire ? "EXPIRED" : "ACTIVE" },
          })
          if (shouldExpire) expired += 1
          continue
        }
        await prisma.auctionListing.update({ where: { id: listing.id }, data: { lastChecked: new Date() } })
        failed.push({ id: listing.id, error: error instanceof Error ? error.message : "Не удалось проверить карточку K Car" })
      }
    }

    const status = failed.length ? (listings.length === failed.length ? "FAILED" : "PARTIAL") : "SUCCEEDED"
    await prisma.auctionSyncRun.update({
      where: { id: syncRun.id },
      data: { status, discovered: listings.length, imported: updated, updated, failed: failed.length, expired, completedAt: new Date() },
    })
    return NextResponse.json({ success: true, status, checked: listings.length, refreshed: updated, unavailable, expired, failed, updated, translated })
  } catch (error) {
    console.error("K Car refresh error:", error)
    if (syncRunId) {
      await prisma.auctionSyncRun.update({
        where: { id: syncRunId },
        data: { status: "FAILED", error: error instanceof Error ? error.message.slice(0, 500) : "Неизвестная ошибка", completedAt: new Date() },
      }).catch(() => undefined)
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status: 500 })
  }
}
