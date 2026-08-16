import { NextRequest, NextResponse } from "next/server"
import { saveAuctionImportItems, type AuctionImportItem } from "@/lib/auction-import"
import { assessImportAge, excludeListingsOutsideImportAgePolicy, resolveMaximumImportAgeYears } from "@/lib/import-age-policy"
import { discoverMobileDeListingIds, fetchMobileDeListing, isMobileDeListingUnavailableError, mobileDeApiConfigured } from "@/lib/mobile-de-api"
import { prisma } from "@/lib/prisma"
import { closeStaleAuctionSyncRuns } from "@/lib/auction-sync-run"

export const dynamic = "force-dynamic"

const MAX_LISTINGS_PER_SYNC = 10
const MAX_CANDIDATES_PER_SYNC = 30

function minimumRegistration(maxAgeYears: number) {
  const cutoff = new Date()
  cutoff.setFullYear(cutoff.getFullYear() - maxAgeYears)
  return `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, "0")}`
}

export async function POST(request: NextRequest) {
  let syncRunId: string | null = null
  try {
    const parserToken = process.env.PARSER_TOKEN
    if (!parserToken || !mobileDeApiConfigured()) return NextResponse.json({ error: "Mobile.de import is not configured" }, { status: 503 })
    if (request.headers.get("authorization") !== `Bearer ${parserToken}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json().catch(() => null) as { limit?: unknown; page?: unknown; maxAgeYears?: unknown } | null
    const requestedLimit = Number(body?.limit)
    const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), MAX_LISTINGS_PER_SYNC) : MAX_LISTINGS_PER_SYNC
    const maxAgeYears = resolveMaximumImportAgeYears(body?.maxAgeYears)
    await closeStaleAuctionSyncRuns("MOBILE_DE")
    const previousRuns = await prisma.auctionSyncRun.count({ where: { source: "MOBILE_DE", syncKind: "DISCOVERY", status: { not: "RUNNING" } } })
    const requestedPage = Number(body?.page)
    const page = Number.isInteger(requestedPage) ? Math.min(Math.max(requestedPage, 1), 20) : previousRuns % 20 + 1
    const syncRun = await prisma.auctionSyncRun.create({
      data: { source: "MOBILE_DE", syncKind: "DISCOVERY", requestedLimit: limit, catalogUrl: `https://suchen.mobile.de/fahrzeuge/search.html?pageNumber=${page - 1}` },
      select: { id: true },
    })
    syncRunId = syncRun.id
    const excludedByPolicy = await excludeListingsOutsideImportAgePolicy("MOBILE_DE", maxAgeYears)
    let catalog = await discoverMobileDeListingIds({ page, pageSize: Math.min(MAX_CANDIDATES_PER_SYNC, Math.max(limit * 2, limit)), minimumFirstRegistration: minimumRegistration(maxAgeYears) })
    if (!catalog.ids.length && page > catalog.totalPages) catalog = await discoverMobileDeListingIds({ page: 1, pageSize: Math.min(MAX_CANDIDATES_PER_SYNC, Math.max(limit * 2, limit)), minimumFirstRegistration: minimumRegistration(maxAgeYears) })
    const items: AuctionImportItem[] = []
    const failed: Array<{ id: string; error: string }> = []
    let unavailable = 0
    let skippedByPolicy = 0
    for (const id of catalog.ids) {
      if (items.length >= limit) break
      try {
        const item = await fetchMobileDeListing(id)
        if (assessImportAge(item, maxAgeYears).eligible) items.push(item)
        else skippedByPolicy += 1
      } catch (error) {
        if (isMobileDeListingUnavailableError(error)) unavailable += 1
        else failed.push({ id, error: error instanceof Error ? error.message : "Не удалось разобрать карточку mobile.de" })
      }
    }

    const result = items.length ? await saveAuctionImportItems(items) : { created: 0, updated: 0, translated: 0 }
    const status = failed.length ? (items.length ? "PARTIAL" : "FAILED") : "SUCCEEDED"
    await prisma.auctionSyncRun.update({ where: { id: syncRun.id }, data: {
      status, discovered: catalog.ids.length, imported: items.length, created: result.created, updated: result.updated,
      failed: failed.length, skippedByPolicy, excludedByPolicy, completedAt: new Date(),
      error: failed.length && !items.length ? "В выдаче нет пригодных карточек mobile.de" : null,
    } })
    return NextResponse.json({ success: true, status, catalogTotal: catalog.total, catalogPage: catalog.page, catalogPages: catalog.totalPages, discovered: catalog.ids.length, imported: items.length, unavailable, skippedByPolicy, excludedByPolicy, failed, ...result })
  } catch (error) {
    console.error("Mobile.de sync error:", error)
    if (syncRunId) await prisma.auctionSyncRun.update({ where: { id: syncRunId }, data: { status: "FAILED", error: error instanceof Error ? error.message.slice(0, 500) : "Неизвестная ошибка", completedAt: new Date() } }).catch(() => undefined)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status: 500 })
  }
}
