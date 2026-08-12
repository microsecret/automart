import { NextRequest, NextResponse } from "next/server"
import { saveAuctionImportItems, type AuctionImportItem } from "@/lib/auction-import"
import { discoverEncarPublicListingUrls, scrapeEncarPublicListing } from "@/lib/encar-public-scraper"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

const PARSER_TOKEN = process.env.PARSER_TOKEN
const MAX_LISTINGS_PER_SYNC = 10
const CANDIDATES_PER_LISTING = 10
const MAX_CANDIDATES_PER_SYNC = 100

export async function POST(request: NextRequest) {
  let syncRunId: string | null = null
  try {
    if (!PARSER_TOKEN) {
      console.error("PARSER_TOKEN is not configured")
      return NextResponse.json({ error: "Auction import is not configured" }, { status: 503 })
    }
    if (request.headers.get("authorization") !== `Bearer ${PARSER_TOKEN}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json().catch(() => null) as { catalogUrl?: unknown; limit?: unknown } | null
    const requestedLimit = Number(body?.limit)
    const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), MAX_LISTINGS_PER_SYNC) : MAX_LISTINGS_PER_SYNC
    const catalogUrl = typeof body?.catalogUrl === "string" && body.catalogUrl.length <= 2_000 ? body.catalogUrl : null
    const syncRun = await prisma.auctionSyncRun.create({
      data: { source: "ENCAR", syncKind: "DISCOVERY", requestedLimit: limit, catalogUrl },
      select: { id: true },
    })
    syncRunId = syncRun.id
    // The public catalogue occasionally contains links that now resolve to a
    // different vehicle. Gather a bounded set of candidates, then only save
    // records whose ID is confirmed by the detail page itself.
    const urls = await discoverEncarPublicListingUrls(
      body?.catalogUrl,
      Math.min(limit * CANDIDATES_PER_LISTING, MAX_CANDIDATES_PER_SYNC),
    )
    const items: AuctionImportItem[] = []
    const failed: Array<{ url: string; error: string }> = []

    for (const url of urls) {
      if (items.length >= limit) break
      try {
        items.push(await scrapeEncarPublicListing(url))
      } catch (error) {
        failed.push({ url, error: error instanceof Error ? error.message : "Не удалось разобрать карточку Encar" })
      }
    }
    if (!items.length) {
      await prisma.auctionSyncRun.update({
        where: { id: syncRun.id },
        data: { status: "FAILED", discovered: urls.length, failed: failed.length, error: "В выдаче нет пригодных карточек", completedAt: new Date() },
      })
      return NextResponse.json({ error: "В выдаче Encar не найдено пригодных для импорта карточек", failed }, { status: 422 })
    }

    const result = await saveAuctionImportItems(items)
    const status = failed.length ? "PARTIAL" : "SUCCEEDED"
    await prisma.auctionSyncRun.update({
      where: { id: syncRun.id },
      data: {
        status, discovered: urls.length, imported: items.length, created: result.created,
        updated: result.updated, failed: failed.length, completedAt: new Date(),
      },
    })
    return NextResponse.json({ success: true, status, discovered: urls.length, imported: items.length, failed, ...result })
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
