import { NextRequest, NextResponse } from "next/server"
import { saveAuctionImportItems, type AuctionImportItem } from "@/lib/auction-import"
import { discoverEncarPublicListingUrls, isEncarListingUnavailableError, scrapeEncarPublicListing } from "@/lib/encar-public-scraper"
import { assessImportAge, excludeListingsOutsideImportAgePolicy, resolveMaximumImportAgeYears } from "@/lib/import-age-policy"
import { prisma } from "@/lib/prisma"
import { closeStaleAuctionSyncRuns, summarizeItemFailures } from "@/lib/auction-sync-run"
import { recentDiscoveryCutoff } from "@/lib/auction-crawl-policy"
import { hasBearerToken } from "@/lib/bearer-token"
import {
  AUCTION_SOURCE_CONSECUTIVE_FAILURE_LIMIT,
  AUCTION_SOURCE_STAGE_BUDGET_MS,
  auctionSourceStageItemBudgetExceeded,
  auctionSourceStageStatus,
  remainingAuctionSourceItems,
} from "@/lib/auction-sync-budget"

export const dynamic = "force-dynamic"

const PARSER_TOKEN = process.env.PARSER_TOKEN
const MAX_LISTINGS_PER_SYNC = 10
const CANDIDATES_PER_LISTING = 10
const MAX_CANDIDATES_PER_SYNC = 100

export async function POST(request: NextRequest) {
  let syncRunId: string | null = null
  try {
    const stageStartedAt = Date.now()
    const deadlineAt = stageStartedAt + AUCTION_SOURCE_STAGE_BUDGET_MS
    if (!PARSER_TOKEN) {
      console.error("PARSER_TOKEN is not configured")
      return NextResponse.json({ error: "Auction import is not configured" }, { status: 503 })
    }
    if (!hasBearerToken(request, PARSER_TOKEN)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json().catch(() => null) as { catalogUrl?: unknown; limit?: unknown; maxAgeYears?: unknown } | null
    const requestedLimit = Number(body?.limit)
    const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), MAX_LISTINGS_PER_SYNC) : MAX_LISTINGS_PER_SYNC
    const maxAgeYears = resolveMaximumImportAgeYears(body?.maxAgeYears)
    const catalogUrl = typeof body?.catalogUrl === "string" && body.catalogUrl.length <= 2_000 ? body.catalogUrl : null
    await closeStaleAuctionSyncRuns("ENCAR")
    const syncRun = await prisma.auctionSyncRun.create({
      data: { source: "ENCAR", syncKind: "DISCOVERY", requestedLimit: limit, catalogUrl },
      select: { id: true },
    })
    syncRunId = syncRun.id
    const excludedByPolicy = await excludeListingsOutsideImportAgePolicy("ENCAR", maxAgeYears)
    // The public catalogue occasionally contains links that now resolve to a
    // different vehicle. Gather a bounded set of candidates, then only save
    // records whose ID is confirmed by the detail page itself.
    const urls = await discoverEncarPublicListingUrls(
      body?.catalogUrl,
      Math.min(limit * CANDIDATES_PER_LISTING, MAX_CANDIDATES_PER_SYNC),
    )
    const recentlyChecked = await prisma.auctionListing.findMany({
      where: { source: "ENCAR", status: "ACTIVE", sourceUrl: { in: urls }, lastChecked: { gte: recentDiscoveryCutoff("ENCAR") } },
      select: { sourceUrl: true },
    })
    const recentlyCheckedUrls = new Set(recentlyChecked.map((listing) => listing.sourceUrl))
    const items: AuctionImportItem[] = []
    const failed: Array<{ url: string; error: string }> = []
    const skippedByAge: Array<{ url: string; year: number; manufacturedMonth: string | null }> = []
    const pendingUrls = urls.filter((url) => !recentlyCheckedUrls.has(url))
    const skippedKnown = urls.length - pendingUrls.length
    let checked = 0
    let deferred = 0
    let unavailable = 0
    let consecutiveFailures = 0

    for (const [index, url] of pendingUrls.entries()) {
      if (items.length >= limit) break
      if (auctionSourceStageItemBudgetExceeded(stageStartedAt)) {
        deferred = remainingAuctionSourceItems(pendingUrls.length, index)
        break
      }
      checked++
      try {
        const item = await scrapeEncarPublicListing(url, deadlineAt)
        consecutiveFailures = 0
        if (assessImportAge(item, maxAgeYears).eligible) items.push(item)
        else skippedByAge.push({ url, year: item.year, manufacturedMonth: item.manufacturedMonth || null })
      } catch (error) {
        if (isEncarListingUnavailableError(error)) {
          unavailable++
          consecutiveFailures = 0
          continue
        }
        failed.push({ url, error: error instanceof Error ? error.message : "Не удалось разобрать карточку Encar" })
        consecutiveFailures++
        if (consecutiveFailures >= AUCTION_SOURCE_CONSECUTIVE_FAILURE_LIMIT) {
          deferred = remainingAuctionSourceItems(pendingUrls.length, index + 1)
          break
        }
      }
    }
    const result = items.length ? await saveAuctionImportItems(items, deadlineAt) : { created: 0, updated: 0, translated: 0, qualityHold: 0, qualityRestored: 0 }
    const status = auctionSourceStageStatus(checked, failed.length, deferred)
    await prisma.auctionSyncRun.update({
      where: { id: syncRun.id },
      data: {
        status, discovered: urls.length, imported: items.length, created: result.created,
        updated: result.updated, failed: failed.length, skippedByPolicy: skippedByAge.length, excludedByPolicy, completedAt: new Date(),
        error: summarizeItemFailures(failed, checked),
      },
    })
    return NextResponse.json({
      success: true, status, discovered: urls.length, checked, deferred, unavailable,
      imported: items.length, skippedKnown, maxAgeYears, skippedByAge, excludedByPolicy, failed, ...result,
    })
  } catch (error) {
    console.error("Encar sync error:", error)
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
