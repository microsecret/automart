import { NextRequest, NextResponse } from "next/server"
import { configuredPartnerAuctionFeeds, pullPartnerAuctionFeed } from "@/lib/partner-auction-feeds"
import { prisma } from "@/lib/prisma"
import { closeStaleAuctionSyncRuns } from "@/lib/auction-sync-run"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const parserToken = process.env.PARSER_TOKEN
  if (!parserToken) return NextResponse.json({ error: "Auction import is not configured" }, { status: 503 })
  if (request.headers.get("authorization") !== `Bearer ${parserToken}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let configs
  try {
    configs = configuredPartnerAuctionFeeds()
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Некорректная конфигурация feeds" }, { status: 503 })
  }
  const body = await request.json().catch(() => null) as { sources?: unknown } | null
  const requested = Array.isArray(body?.sources)
    ? new Set(body.sources.flatMap((value) => typeof value === "string" ? [value.trim().toUpperCase()] : []))
    : null
  const selected = requested ? configs.filter((config) => requested.has(config.source)) : configs
  if (!selected.length) return NextResponse.json({ success: true, configured: configs.length, processed: 0, results: [] })

  const results: Array<Record<string, unknown>> = []
  for (const config of selected) {
    await closeStaleAuctionSyncRuns(config.source)
    const run = await prisma.auctionSyncRun.create({
      data: { source: config.source, syncKind: "PARTNER_FEED", requestedLimit: 500 },
      select: { id: true },
    })
    try {
      const result = await pullPartnerAuctionFeed(config)
      await prisma.auctionSyncRun.update({
        where: { id: run.id },
        data: {
          status: "SUCCEEDED", discovered: result.imported, imported: result.imported,
          created: result.created, updated: result.updated, expired: result.expired, completedAt: new Date(),
        },
      })
      results.push({ source: config.source, success: true, ...result })
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 500) : "Неизвестная ошибка"
      await prisma.auctionSyncRun.update({ where: { id: run.id }, data: { status: "FAILED", failed: 1, error: message, completedAt: new Date() } })
      results.push({ source: config.source, success: false, error: message })
    }
  }
  const failed = results.filter((result) => !result.success).length
  return NextResponse.json({ success: failed === 0, configured: configs.length, processed: results.length, failed, results }, { status: failed === results.length ? 502 : 200 })
}
