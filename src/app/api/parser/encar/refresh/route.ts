import { NextRequest, NextResponse } from "next/server"
import { saveAuctionImportItems } from "@/lib/auction-import"
import { isEncarListingUnavailableError, scrapeEncarPublicListing } from "@/lib/encar-public-scraper"
import { prisma } from "@/lib/prisma"
import { closeStaleAuctionSyncRuns, summarizeItemFailures } from "@/lib/auction-sync-run"
import { refreshDueCutoff, refreshIntervalHours } from "@/lib/auction-crawl-policy"
import { hasBearerToken } from "@/lib/bearer-token"
import { auctionSourceStageItemBudgetExceeded, auctionSourceStageStatus, remainingAuctionSourceItems } from "@/lib/auction-sync-budget"

export const dynamic = "force-dynamic"

const PARSER_TOKEN = process.env.PARSER_TOKEN
// The collector processes one due source card at a time. The database cutoff
// prevents every 20-minute cron tick from reopening recently confirmed lots.
// 60 since 25.09.2026: at 40 the daily capacity (~2 880) fell just short of
// the ~2 970 checks the 36-hour display window needs, and ~830 Encar lots
// dropped out of the catalogue. The collector gives this stage its own
// 420-second timeout (scripts/run-encar-collector.sh).
const MAX_LISTINGS_PER_REFRESH = 60
const REFRESH_STAGE_BUDGET_MS = 360_000

export async function POST(request: NextRequest) {
  let syncRunId: string | null = null
  try {
    const stageStartedAt = Date.now()
    const deadlineAt = stageStartedAt + REFRESH_STAGE_BUDGET_MS
    if (!PARSER_TOKEN) {
      console.error("PARSER_TOKEN is not configured")
      return NextResponse.json({ error: "Auction import is not configured" }, { status: 503 })
    }
    if (!hasBearerToken(request, PARSER_TOKEN)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json().catch(() => null) as { limit?: unknown } | null
    const requestedLimit = Number(body?.limit)
    const limit = Number.isInteger(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), MAX_LISTINGS_PER_REFRESH)
      : MAX_LISTINGS_PER_REFRESH
    await closeStaleAuctionSyncRuns("ENCAR")
    const syncRun = await prisma.auctionSyncRun.create({
      data: { source: "ENCAR", syncKind: "REFRESH", requestedLimit: limit },
      select: { id: true },
    })
    syncRunId = syncRun.id

    const listings = await prisma.auctionListing.findMany({
      where: { source: "ENCAR", status: "ACTIVE", lastChecked: { lte: refreshDueCutoff("ENCAR") } },
      orderBy: [{ lastChecked: "asc" }, { id: "asc" }],
      take: limit,
      select: { id: true, sourceUrl: true, sourceMissingChecks: true },
    })

    let created = 0
    let updated = 0
    let translated = 0
    let unavailable = 0
    let expired = 0
    let checked = 0
    let deferred = 0
    const failed: Array<{ id: string; error: string }> = []

    for (const [index, listing] of listings.entries()) {
      if (auctionSourceStageItemBudgetExceeded(stageStartedAt, Date.now(), REFRESH_STAGE_BUDGET_MS)) {
        deferred = remainingAuctionSourceItems(listings.length, index)
        break
      }
      checked++
      try {
        const item = await scrapeEncarPublicListing(listing.sourceUrl, deadlineAt)
        const result = await saveAuctionImportItems([item], deadlineAt)
        created += result.created
        updated += result.updated
        translated += result.translated
      } catch (error) {
        if (isEncarListingUnavailableError(error)) {
          unavailable += 1
          const sourceMissingChecks = listing.sourceMissingChecks + 1
          const shouldExpire = sourceMissingChecks >= 2
          await prisma.auctionListing.update({
            where: { id: listing.id },
            data: {
              lastChecked: new Date(),
              sourceMissingChecks,
              status: shouldExpire ? "EXPIRED" : "ACTIVE",
            },
          })
          if (shouldExpire) expired += 1
          continue
        }
        // Do not let one transient source failure starve the remaining queue.
        // sourceLastSeenAt is intentionally untouched, so this never implies
        // that the vehicle is still available.
        await prisma.auctionListing.update({
          where: { id: listing.id },
          data: { lastChecked: new Date() },
        })
        failed.push({ id: listing.id, error: error instanceof Error ? error.message : "Не удалось проверить карточку" })
      }
    }

    const status = auctionSourceStageStatus(checked, failed.length, deferred)
    await prisma.auctionSyncRun.update({
      where: { id: syncRun.id },
      data: {
        status, discovered: listings.length, imported: created + updated, created, updated,
        failed: failed.length, expired, completedAt: new Date(), error: summarizeItemFailures(failed, checked),
      },
    })

    return NextResponse.json({
      success: true, status, checked, deferred, refreshed: created + updated,
      refreshIntervalHours: refreshIntervalHours("ENCAR"), unavailable, expired, failed, created, updated, translated,
    })
  } catch (error) {
    console.error("Encar refresh error:", error)
    if (syncRunId) {
      await prisma.auctionSyncRun.update({
        where: { id: syncRunId },
        data: {
          status: "FAILED", error: error instanceof Error ? error.message.slice(0, 500) : "Неизвестная ошибка",
          completedAt: new Date(),
        },
      }).catch(() => undefined)
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status: 500 })
  }
}
