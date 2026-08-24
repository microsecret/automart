import { NextRequest, NextResponse } from "next/server"
import { saveAuctionImportItems, type AuctionImportItem } from "@/lib/auction-import"
import { assessImportAge, excludeListingsOutsideImportAgePolicy, resolveMaximumImportAgeYears } from "@/lib/import-age-policy"
import {
  discoverPublicAuctionCandidates,
  fetchPublicAuctionListing,
  isPublicAuctionSource,
  isEmptyCatalogPageError,
  isPublicListingUnavailableError,
  publicSourceCatalogUrl,
  publicSourceMaximumPage,
} from "@/lib/public-auction-collectors"
import { prisma } from "@/lib/prisma"
import { closeStaleAuctionSyncRuns } from "@/lib/auction-sync-run"
import { recentDiscoveryCutoff } from "@/lib/auction-crawl-policy"
import {
  AUCTION_SOURCE_CONSECUTIVE_FAILURE_LIMIT,
  auctionSourceStageBudgetExceeded,
  auctionSourceStageStatus,
  remainingAuctionSourceItems,
} from "@/lib/auction-sync-budget"

export const dynamic = "force-dynamic"

const MAX_LISTINGS_PER_SYNC = 6
const MAX_CANDIDATES_PER_SYNC = 24

export async function POST(request: NextRequest, { params }: { params: Promise<{ source: string }> }) {
  let syncRunId: string | null = null
  // Номер страницы нужен и в ответе об ошибке, поэтому живёт вне try.
  let page = 1
  const rawSource = (await params).source.toUpperCase()
  if (!isPublicAuctionSource(rawSource)) return NextResponse.json({ error: "Unknown public source" }, { status: 404 })
  const source = rawSource

  try {
    const stageStartedAt = Date.now()
    const parserToken = process.env.PARSER_TOKEN
    if (!parserToken) return NextResponse.json({ error: "Auction import is not configured" }, { status: 503 })
    if (request.headers.get("authorization") !== `Bearer ${parserToken}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json().catch(() => null) as { limit?: unknown; page?: unknown; maxAgeYears?: unknown } | null
    const requestedLimit = Number(body?.limit)
    const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), MAX_LISTINGS_PER_SYNC) : MAX_LISTINGS_PER_SYNC
    const maxAgeYears = resolveMaximumImportAgeYears(body?.maxAgeYears)

    await closeStaleAuctionSyncRuns(source)
    const maximumPage = publicSourceMaximumPage(source)
    const previousRuns = await prisma.auctionSyncRun.count({ where: { source, syncKind: "DISCOVERY", status: { not: "RUNNING" } } })
    const requestedPage = Number(body?.page)
    page = Number.isInteger(requestedPage) ? Math.min(Math.max(requestedPage, 1), maximumPage) : previousRuns % maximumPage + 1
    const catalogUrl = publicSourceCatalogUrl(source, page)
    const syncRun = await prisma.auctionSyncRun.create({
      data: { source, syncKind: "DISCOVERY", requestedLimit: limit, catalogUrl }, select: { id: true },
    })
    syncRunId = syncRun.id

    const excludedByPolicy = await excludeListingsOutsideImportAgePolicy(source, maxAgeYears)
    const catalog = await discoverPublicAuctionCandidates(source, page, Math.min(MAX_CANDIDATES_PER_SYNC, Math.max(limit * 2, limit)))
    const recentlyChecked = await prisma.auctionListing.findMany({
      where: {
        source,
        status: "ACTIVE",
        sourceId: { in: catalog.candidates.map((candidate) => candidate.sourceId) },
        lastChecked: { gte: recentDiscoveryCutoff(source) },
      },
      select: { sourceId: true },
    })
    const recentlyCheckedIds = new Set(recentlyChecked.map((listing) => listing.sourceId))
    const items: AuctionImportItem[] = []
    const failed: Array<{ id: string; error: string }> = []
    let unavailable = 0
    let skippedByPolicy = 0
    let skippedKnown = 0
    let checked = 0
    let deferred = 0
    let consecutiveFailures = 0

    for (const [candidateIndex, candidate] of catalog.candidates.entries()) {
      if (items.length >= limit) break
      if (recentlyCheckedIds.has(candidate.sourceId)) {
        skippedKnown += 1
        continue
      }
      if (auctionSourceStageBudgetExceeded(stageStartedAt)) {
        deferred = remainingAuctionSourceItems(catalog.candidates.length, candidateIndex)
        break
      }
      checked += 1
      try {
        const item = await fetchPublicAuctionListing(source, candidate)
        if (assessImportAge(item, maxAgeYears).eligible) items.push(item)
        else skippedByPolicy += 1
        consecutiveFailures = 0
      } catch (error) {
        if (isPublicListingUnavailableError(error)) {
          unavailable += 1
          consecutiveFailures = 0
        } else {
          failed.push({ id: candidate.sourceId, error: error instanceof Error ? error.message : `Не удалось разобрать карточку ${source}` })
          consecutiveFailures += 1
          if (consecutiveFailures >= AUCTION_SOURCE_CONSECUTIVE_FAILURE_LIMIT) {
            deferred = remainingAuctionSourceItems(catalog.candidates.length, candidateIndex + 1)
            break
          }
        }
      }
    }

    const result = items.length ? await saveAuctionImportItems(items) : { created: 0, updated: 0, translated: 0, qualityHold: 0, qualityRestored: 0 }
    const status = auctionSourceStageStatus(checked, failed.length, deferred)
    await prisma.auctionSyncRun.update({
      where: { id: syncRun.id },
      data: {
        status, discovered: catalog.candidates.length, imported: items.length, created: result.created,
        updated: result.updated, failed: failed.length, skippedByPolicy, excludedByPolicy, completedAt: new Date(),
        error: failed.length && !items.length ? `${source}: в выдаче нет пригодных карточек` : null,
      },
    })
    return NextResponse.json({ success: true, source, status, page, catalogTotal: catalog.total, discovered: catalog.candidates.length, checked, deferred, imported: items.length, unavailable, skippedKnown, skippedByPolicy, excludedByPolicy, failed, ...result })
  } catch (error) {
    // Пустая страница каталога — не поломка источника: площадка вернула
    // заглушку или страница вышла за границу выдачи. Такой прогон
    // завершается успешно с нулём находок, иначе метрика надёжности
    // показывала бы отказ там, где его нет.
    if (isEmptyCatalogPageError(error)) {
      if (syncRunId) {
        await prisma.auctionSyncRun.update({
          where: { id: syncRunId },
          data: { status: "SUCCEEDED", discovered: 0, imported: 0, completedAt: new Date() },
        }).catch(() => undefined)
      }
      return NextResponse.json({
        success: true,
        source,
        status: "SUCCEEDED",
        page,
        discovered: 0,
        imported: 0,
        note: error instanceof Error ? error.message : "Страница каталога пуста",
      })
    }

    console.error(`${source} public sync error:`, error)
    if (syncRunId) {
      await prisma.auctionSyncRun.update({
        where: { id: syncRunId },
        data: { status: "FAILED", error: error instanceof Error ? error.message.slice(0, 500) : "Неизвестная ошибка", completedAt: new Date() },
      }).catch(() => undefined)
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status: 500 })
  }
}
