import { NextRequest, NextResponse } from "next/server"
import { saveAuctionImportItems, type AuctionImportItem } from "@/lib/auction-import"
import { scrapeEncarPublicListing } from "@/lib/encar-public-scraper"
import { assessImportAge, excludeListingsOutsideImportAgePolicy, resolveMaximumImportAgeYears } from "@/lib/import-age-policy"

export const dynamic = "force-dynamic"

const PARSER_TOKEN = process.env.PARSER_TOKEN
const MAX_URLS_PER_REQUEST = 10

export async function POST(request: NextRequest) {
  try {
    if (!PARSER_TOKEN) {
      console.error("PARSER_TOKEN is not configured")
      return NextResponse.json({ error: "Auction import is not configured" }, { status: 503 })
    }
    if (request.headers.get("authorization") !== `Bearer ${PARSER_TOKEN}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json().catch(() => null) as { urls?: unknown; maxAgeYears?: unknown } | null
    if (!Array.isArray(body?.urls) || body.urls.length === 0 || body.urls.length > MAX_URLS_PER_REQUEST) {
      return NextResponse.json({ error: `Передайте от 1 до ${MAX_URLS_PER_REQUEST} публичных ссылок Encar` }, { status: 400 })
    }

    const urls = [...new Set(body.urls.filter((url): url is string => typeof url === "string").map((url) => url.trim()).filter(Boolean))]
    if (!urls.length) return NextResponse.json({ error: "Передайте публичные ссылки Encar" }, { status: 400 })
    const maxAgeYears = resolveMaximumImportAgeYears(body.maxAgeYears)
    const excludedByPolicy = await excludeListingsOutsideImportAgePolicy("ENCAR", maxAgeYears)

    const items: AuctionImportItem[] = []
    const failed: Array<{ url: string; error: string }> = []
    const skippedByAge: Array<{ url: string; year: number; manufacturedMonth: string | null }> = []
    for (const url of urls) {
      try {
        const item = await scrapeEncarPublicListing(url)
        if (assessImportAge(item, maxAgeYears).eligible) items.push(item)
        else skippedByAge.push({ url, year: item.year, manufacturedMonth: item.manufacturedMonth || null })
      } catch (error) {
        failed.push({ url, error: error instanceof Error ? error.message : "Не удалось разобрать карточку Encar" })
      }
    }
    if (!items.length) return NextResponse.json({ success: true, requested: urls.length, imported: 0, maxAgeYears, skippedByAge, excludedByPolicy, failed })

    const result = await saveAuctionImportItems(items)
    return NextResponse.json({ success: true, requested: urls.length, imported: items.length, maxAgeYears, skippedByAge, excludedByPolicy, failed, ...result })
  } catch (error) {
    console.error("Encar parser error:", error)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
