import { execFile } from "node:child_process"
import path from "node:path"
import { promisify } from "node:util"
import { NextRequest, NextResponse } from "next/server"
import { requireAdminSession } from "@/lib/admin-route-guard"
import { prisma } from "@/lib/prisma"
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit"
import { recordAdminAudit } from "@/lib/admin-audit"
import { parseAuctionHighlightListingId } from "@/lib/auction-telegram-highlight.mjs"

export const dynamic = "force-dynamic"

const execFileAsync = promisify(execFile)
const SCRIPT_PATH = path.join(process.cwd(), "scripts", "publish-auction-highlights.mjs")
const SCRIPT_TIMEOUT_MS = 90_000

type ScriptPreview = {
  id: string
  photo: string | null
  caption: string
  priceSignal: { label: string; ratio: number | null; saving: number | null }
  readiness: { ready: boolean; filled: number; total: number; required: number; percent: number; missing: string[] }
}

function captionPlainText(value: string) {
  return value
    .replace(/<a\s+[^>]*>(.*?)<\/a>/gi, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
}

async function runHighlightScript(args: string[]) {
  const result = await execFileAsync(process.execPath, [SCRIPT_PATH, ...args], {
    cwd: process.cwd(),
    env: process.env,
    encoding: "utf8",
    timeout: SCRIPT_TIMEOUT_MS,
    maxBuffer: 512 * 1024,
    windowsHide: true,
  })
  return String(result.stdout).trim()
}

async function buildPreview(listingId: string) {
  const output = await runHighlightScript(["--dry-run", "--listing", listingId, "--limit", "1"])
  let rows: ScriptPreview[] = []
  try {
    const parsed = JSON.parse(output)
    if (Array.isArray(parsed)) rows = parsed
  } catch {
    return null
  }
  const preview = rows[0]
  if (!preview || preview.id !== listingId || !preview.readiness?.ready) return null

  const registeredChats = await prisma.telegramChat.findMany({
    where: { active: true, marketingEnabled: true },
    select: { id: true },
  })
  const configuredChatIds = (process.env.TELEGRAM_AUCTION_CHAT_IDS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
  const activeChatIds = [...new Set([...registeredChats.map((chat) => chat.id), ...configuredChatIds])]
  const alreadyPosted = activeChatIds.length > 0
    ? await prisma.auctionTelegramPost.count({
      where: { auctionListingId: listingId, chatId: { in: activeChatIds } },
    })
    : 0
  return {
    ...preview,
    captionPlainText: captionPlainText(preview.caption),
    activeChats: activeChatIds.length,
    alreadyPosted,
  }
}

function listingIdFrom(value: unknown) {
  return parseAuctionHighlightListingId(value)
}

export async function GET(request: NextRequest) {
  const guard = await requireAdminSession()
  if (guard.denied) return guard.denied
  const session = guard.session

  const limit = rateLimit(`telegram-highlight-preview:${session?.user?.id || getClientIp(request)}`, {
    windowMs: 5 * 60_000,
    maxRequests: 30,
  })
  if (!limit.success) {
    return NextResponse.json({ error: "Слишком много проверок. Подождите несколько минут." }, {
      status: 429,
      headers: rateLimitHeaders(limit),
    })
  }

  const listingId = listingIdFrom(request.nextUrl.searchParams.get("listing"))
  if (!listingId) return NextResponse.json({ error: "Укажите корректную ссылку или UUID аукционного лота" }, { status: 400 })

  try {
    const preview = await buildPreview(listingId)
    if (!preview) {
      return NextResponse.json({
        error: "Лот не прошёл фильтр отличной цены, полноты данных, повреждений или уже скрыт",
      }, { status: 422 })
    }
    return NextResponse.json({ preview })
  } catch (error) {
    console.error("Telegram auction highlight preview failed", error instanceof Error ? error.message : error)
    return NextResponse.json({ error: "Не удалось подготовить предпросмотр лота" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireAdminSession()
  if (guard.denied) return guard.denied
  const session = guard.session

  const limit = rateLimit(`telegram-highlight-send:${session?.user?.id || getClientIp(request)}`, {
    windowMs: 15 * 60_000,
    maxRequests: 3,
  })
  if (!limit.success) {
    return NextResponse.json({ error: "Лимит публикаций исчерпан. Подождите 15 минут." }, {
      status: 429,
      headers: rateLimitHeaders(limit),
    })
  }

  const body = await request.json().catch(() => null)
  const listingId = listingIdFrom(body?.listing)
  if (!listingId) return NextResponse.json({ error: "Укажите корректный аукционный лот" }, { status: 400 })
  if (body?.confirm !== true) {
    return NextResponse.json({ error: "Сначала откройте предпросмотр и подтвердите публикацию" }, { status: 400 })
  }

  try {
    const preview = await buildPreview(listingId)
    if (!preview) return NextResponse.json({ error: "Лот больше не соответствует правилам публикации" }, { status: 409 })
    if (preview.activeChats === 0) {
      return NextResponse.json({ error: "Нет активных чатов, где разрешены публикации" }, { status: 409 })
    }

    const before = await prisma.auctionTelegramPost.count({ where: { auctionListingId: listingId } })
    await runHighlightScript(["--listing", listingId, "--limit", "1"])
    const after = await prisma.auctionTelegramPost.count({ where: { auctionListingId: listingId } })
    const sent = Math.max(0, after - before)
    if (sent === 0) {
      return NextResponse.json({ error: "Новых публикаций нет: лот уже отправлен или бот не администратор чата" }, { status: 409 })
    }

    await recordAdminAudit({
      actorId: session?.user?.id || null,
      actorEmail: session?.user?.email,
      action: "TELEGRAM_AUCTION_HIGHLIGHT_SEND",
      entityType: "AuctionListing",
      entityId: listingId,
      summary: `Выгодный аукционный лот опубликован в ${sent} Telegram-чатах`,
      metadata: {
        sent,
        activeChats: preview.activeChats,
        alreadyPostedBefore: before,
        completeness: preview.readiness.filled,
        completenessTotal: preview.readiness.total,
        priceRatio: preview.priceSignal.ratio,
      },
    })
    return NextResponse.json({ success: true, sent, preview })
  } catch (error) {
    console.error("Telegram auction highlight send failed", error instanceof Error ? error.message : error)
    return NextResponse.json({ error: "Публикация лота не выполнена" }, { status: 500 })
  }
}
