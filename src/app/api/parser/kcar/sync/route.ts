import { NextRequest, NextResponse } from "next/server"
import { saveAuctionImportItems, type AuctionImportItem } from "@/lib/auction-import"
import { assessImportAge, excludeListingsOutsideImportAgePolicy, resolveMaximumImportAgeYears } from "@/lib/import-age-policy"
import { discoverKCarListingIds, fetchKCarListing, isKCarListingUnavailableError } from "@/lib/kcar-public-collector"
import { prisma } from "@/lib/prisma"
import { closeStaleAuctionSyncRuns } from "@/lib/auction-sync-run"
import { recentDiscoveryCutoff } from "@/lib/auction-crawl-policy"

export const dynamic = "force-dynamic"

const MAX_LISTINGS_PER_SYNC = 12
const MAX_CANDIDATES_PER_SYNC = 30

export async function POST(request: NextRequest) {
  let syncRunId: string | null = null
  try {
    const parserToken = process.env.PARSER_TOKEN
    if (!parserToken) return NextResponse.json({ error: "Auction import is not configured" }, { status: 503 })
    if (request.headers.get("authorization") !== `Bearer ${parserToken}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json().catch(() => null) as { limit?: unknown; page?: unknown; maxAgeYears?: unknown } | null
    const requestedLimit = Number(body?.limit)
    const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), MAX_LISTINGS_PER_SYNC) : MAX_LISTINGS_PER_SYNC
    const maxAgeYears = resolveMaximumImportAgeYears(body?.maxAgeYears)

    await closeStaleAuctionSyncRuns("KCAR")
    const previousDiscoveryRuns = await prisma.auctionSyncRun.count({ where: { source: "KCAR", syncKind: "DISCOVERY", status: { not: "RUNNING" } } })
    const requestedPage = Number(body?.page)
    const page = Number.isInteger(requestedPage) ? Math.min(Math.max(requestedPage, 1), 1_000) : previousDiscoveryRuns % 1_000 + 1
    const syncRun = await prisma.auctionSyncRun.create({
      data: { source: "KCAR", syncKind: "DISCOVERY", requestedLimit: limit, catalogUrl: `https://www.kcar.com/bc/search?page=${page}` },
      select: { id: true },
    })
    syncRunId = syncRun.id
    const excludedByPolicy = await excludeListingsOutsideImportAgePolicy("KCAR", maxAgeYears)
    let catalog = await discoverKCarListingIds(page, Math.min(MAX_CANDIDATES_PER_SYNC, Math.max(limit * 2, limit)))
    if (!catalog.ids.length && page > catalog.totalPages) catalog = await discoverKCarListingIds(1, Math.min(MAX_CANDIDATES_PER_SYNC, Math.max(limit * 2, limit)))
    const recentlyChecked = await prisma.auctionListing.findMany({
      where: { source: "KCAR", status: "ACTIVE", sourceId: { in: catalog.ids }, lastChecked: { gte: recentDiscoveryCutoff("KCAR") } },
      select: { sourceId: true },
    })
    const recentlyCheckedIds = new Set(recentlyChecked.map((listing) => listing.sourceId))
    const items: AuctionImportItem[] = []
    const failed: Array<{ id: string; error: string }> = []
    let unavailable = 0
    let skippedByPolicy = 0
    let skippedKnown = 0

    for (const id of catalog.ids) {
      if (items.length >= limit) break
      if (recentlyCheckedIds.has(id)) {
        skippedKnown += 1
        continue
      }
      try {
        const item = await fetchKCarListing(id)
        if (assessImportAge(item, maxAgeYears).eligible) items.push(item)
        else skippedByPolicy += 1
      } catch (error) {
        if (isKCarListingUnavailableError(error)) unavailable += 1
        else failed.push({ id, error: error instanceof Error ? error.message : "Не удалось разобрать карточку K Car" })
      }
    }

    const result = items.length ? await saveAuctionImportItems(items) : { created: 0, updated: 0, translated: 0 }
    const status = failed.length ? (items.length ? "PARTIAL" : "FAILED") : "SUCCEEDED"
    await prisma.auctionSyncRun.update({
      where: { id: syncRun.id },
      data: {
        status,
        discovered: catalog.ids.length,
        imported: items.length,
        created: result.created,
        updated: result.updated,
        failed: failed.length,
        skippedByPolicy,
        excludedByPolicy,
        completedAt: new Date(),
        error: failed.length && !items.length ? "В выдаче нет пригодных карточек K Car" : null,
      },
    })

    return NextResponse.json({ success: true, status, catalogTotal: catalog.total, catalogPage: catalog.page, catalogPages: catalog.totalPages, discovered: catalog.ids.length, imported: items.length, unavailable, skippedKnown, skippedByPolicy, excludedByPolicy, failed, ...result })
  } catch (error) {
    console.error("K Car sync error:", error)
    if (syncRunId) {
      await prisma.auctionSyncRun.update({
        where: { id: syncRunId },
        data: { status: "FAILED", error: error instanceof Error ? error.message.slice(0, 500) : "Неизвестная ошибка", completedAt: new Date() },
      }).catch(() => undefined)
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status: 500 })
  }
}
