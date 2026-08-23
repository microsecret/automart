import crypto from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { processSignupNudges } from "@/lib/telegram-signup-nudge"

export const dynamic = "force-dynamic"

function hasValidSecret(request: NextRequest, secret: string) {
  const received = request.headers.get("x-telegram-bot-api-secret-token") || ""
  const expectedBuffer = Buffer.from(secret)
  const receivedBuffer = Buffer.from(received)
  return expectedBuffer.length === receivedBuffer.length && crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
}

export async function POST(request: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!secret) return NextResponse.json({ error: "Telegram is not configured" }, { status: 503 })
  if (!hasValidSecret(request, secret)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    return NextResponse.json(await processSignupNudges())
  } catch (error) {
    console.error("Signup nudges failed:", error)
    return NextResponse.json({ error: "Nudges failed" }, { status: 500 })
  }
}
