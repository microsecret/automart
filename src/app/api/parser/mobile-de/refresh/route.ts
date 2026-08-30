import { NextRequest, NextResponse } from "next/server"
import { saveAuctionImportItems } from "@/lib/auction-import"
import { fetchMobileDeListing, isMobileDeListingUnavailableError, mobileDeApiConfigured } from "@/lib/mobile-de-api"
import { prisma } from "@/lib/prisma"
import { closeStaleAuctionSyncRuns } from "@/lib/auction-sync-run"

export const dynamic = "force-dynamic"

const MAX_LISTINGS_PER_REFRESH = 30

export async function POST(request: NextRequest) {
  let syncRunId: string | null = null
  try {
    const parserToken = process.env.PARSER_TOKEN
    if (!parserToken || !mobileDeApiConfigured()) return NextResponse.json({ error: "Mobile.de import is not configured" }, { status: 503 })
    if (request.headers.get("authorization") !== `Bearer ${parserToken}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const body = await request.json().catch(() => null) as { limit?: unknown } | null
    const requestedLimit = Number(body?.limit)
    const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), MAX_LISTINGS_PER_REFRESH) : MAX_LISTINGS_PER_REFRESH
    await closeStaleAuctionSyncRuns("MOBILE_DE")
    const syncRun = await prisma.auctionSyncRun.create({ data: { source: "MOBILE_DE", syncKind: "REFRESH", requestedLimit: limit }, select: { id: true } })
    syncRunId = syncRun.id
    const listings = await prisma.auctionListing.findMany({ where: { source: "MOBILE_DE", status: "ACTIVE" }, orderBy: [{ lastChecked: "asc" }, { id: "asc" }], take: limit, select: { id: true, sourceId: true, sourceMissingChecks: true } })

    let updated = 0
    let translated = 0
    let unavailable = 0
    let expired = 0
    const failed: Array<{ id: string; error: string }> = []

    /* Прогон укладывается в отведённое время, а не идёт сколько выйдет.

       Карточки проверяются по очереди, у каждого запроса свой таймаут
       в двадцать секунд. При тридцати карточках это до десяти минут,
       если внешний источник отвечает медленно, — а cron за это время
       успевает запустить следующий прогон поверх текущего.

       Три минуты покрывают нормальный прогон с большим запасом.
       Непроверенные карточки не теряются: следующий раз выборка идёт
       по самой давней проверке, и они окажутся первыми. */
    const RUN_DEADLINE_MS = 3 * 60_000
    const startedAt = Date.now()
    let skippedByDeadline = 0

    for (const listing of listings) {
      if (Date.now() - startedAt > RUN_DEADLINE_MS) {
        skippedByDeadline += 1
        continue
      }
      try {
        const result = await saveAuctionImportItems([await fetchMobileDeListing(listing.sourceId)])
        updated += result.updated
        translated += result.translated
      } catch (error) {
        if (isMobileDeListingUnavailableError(error)) {
          unavailable += 1
          const sourceMissingChecks = listing.sourceMissingChecks + 1
          const shouldExpire = sourceMissingChecks >= 2
          await prisma.auctionListing.update({ where: { id: listing.id }, data: { lastChecked: new Date(), sourceMissingChecks, status: shouldExpire ? "EXPIRED" : "ACTIVE" } })
          if (shouldExpire) expired += 1
          continue
        }
        await prisma.auctionListing.update({ where: { id: listing.id }, data: { lastChecked: new Date() } })
        failed.push({ id: listing.id, error: error instanceof Error ? error.message : "Не удалось проверить карточку mobile.de" })
      }
    }
    const status = failed.length ? (listings.length === failed.length ? "FAILED" : "PARTIAL") : "SUCCEEDED"
    await prisma.auctionSyncRun.update({ where: { id: syncRun.id }, data: { status, discovered: listings.length, imported: updated, updated, failed: failed.length, expired, completedAt: new Date() } })
    return NextResponse.json({ success: true, status, checked: listings.length - skippedByDeadline, skippedByDeadline, refreshed: updated, unavailable, expired, failed, updated, translated })
  } catch (error) {
    console.error("Mobile.de refresh error:", error)
    if (syncRunId) await prisma.auctionSyncRun.update({ where: { id: syncRunId }, data: { status: "FAILED", error: error instanceof Error ? error.message.slice(0, 500) : "Неизвестная ошибка", completedAt: new Date() } }).catch(() => undefined)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status: 500 })
  }
}
