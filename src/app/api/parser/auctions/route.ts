import { NextRequest, NextResponse } from "next/server"
import { saveAuctionImportItems, type AuctionImportItem } from "@/lib/auction-import"
import { normalizeAuctionImportItem } from "@/lib/auction-import-validation"

export const dynamic = "force-dynamic"

const PARSER_TOKEN = process.env.PARSER_TOKEN

export async function POST(request: NextRequest) {
  try {
    if (!PARSER_TOKEN) {
      console.error("PARSER_TOKEN is not configured")
      return NextResponse.json({ error: "Auction import is not configured" }, { status: 503 })
    }
    if (request.headers.get("authorization") !== `Bearer ${PARSER_TOKEN}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { items, dryRun = false } = await request.json() as { items: unknown[]; dryRun?: boolean }
    if (!Array.isArray(items) || items.length === 0 || items.length > 500) return NextResponse.json({ error: "Передайте от 1 до 500 лотов" }, { status: 400 })
    if (typeof dryRun !== "boolean") return NextResponse.json({ error: "dryRun должен быть логическим значением" }, { status: 400 })
    let normalizedItems: AuctionImportItem[]
    try {
      normalizedItems = items.map(normalizeAuctionImportItem)
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Некорректный лот" }, { status: 400 })
    }

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        validated: normalizedItems.length,
        sources: [...new Set(normalizedItems.map((item) => item.source))],
        imagesValidated: normalizedItems.reduce((total, item) => total + (item.images?.length || (item.imageUrl ? 1 : 0)), 0),
      })
    }

    const result = await saveAuctionImportItems(normalizedItems)
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error("Parser error:", error)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
