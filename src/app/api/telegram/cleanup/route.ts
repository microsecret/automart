import crypto from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { processDueTelegramMessageCleanup } from "@/lib/telegram-message-cleanup"

export const dynamic = "force-dynamic"

function hasValidWorkerSecret(request: NextRequest, secret: string) {
  const received = request.headers.get("x-telegram-bot-api-secret-token") || ""
  const expectedBuffer = Buffer.from(secret)
  const receivedBuffer = Buffer.from(received)
  return expectedBuffer.length === receivedBuffer.length && crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
}

export async function POST(request: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!secret) return NextResponse.json({ error: "Telegram cleanup is not configured" }, { status: 503 })
  if (!hasValidWorkerSecret(request, secret)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    return NextResponse.json({ ok: true, ...(await processDueTelegramMessageCleanup()) })
  } catch (error) {
    console.error("Telegram cleanup worker failed:", error)
    return NextResponse.json({ error: "Cleanup worker failed" }, { status: 500 })
  }
}
