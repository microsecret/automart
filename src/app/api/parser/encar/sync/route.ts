import { NextRequest, NextResponse } from "next/server"
import { saveAuctionImportItems, type AuctionImportItem } from "@/lib/auction-import"
import { discoverEncarPublicListingUrls, scrapeEncarPublicListing } from "@/lib/encar-public-scraper"

export const dynamic = "force-dynamic"

const PARSER_TOKEN = process.env.PARSER_TOKEN
const MAX_LISTINGS_PER_SYNC = 10

export async function POST(request: NextRequest) {
  try {
    if (!PARSER_TOKEN) {
      console.error("PARSER_TOKEN is not configured")
      return NextResponse.json({ error: "Auction import is not configured" }, { status: 503 })
    }
    if (request.headers.get("authorization") !== `Bearer ${PARSER_TOKEN}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json().catch(() => null) as { catalogUrl?: unknown; limit?: unknown } | null
    const requestedLimit = Number(body?.limit)
    const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), MAX_LISTINGS_PER_SYNC) : MAX_LISTINGS_PER_SYNC
    const urls = await discoverEncarPublicListingUrls(body?.catalogUrl, limit)
    const items: AuctionImportItem[] = []
    const failed: Array<{ url: string; error: string }> = []

    for (const url of urls) {
      try {
        items.push(await scrapeEncarPublicListing(url))
      } catch (error) {
        failed.push({ url, error: error instanceof Error ? error.message : "Не удалось разобрать карточку Encar" })
      }
    }
    if (!items.length) return NextResponse.json({ error: "В выдаче Encar не найдено пригодных для импорта карточек", failed }, { status: 422 })

    const result = await saveAuctionImportItems(items)
    return NextResponse.json({ success: true, discovered: urls.length, imported: items.length, failed, ...result })
  } catch (error) {
    console.error("Encar sync error:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status: 500 })
  }
}
