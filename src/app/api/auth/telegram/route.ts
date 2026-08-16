import { NextRequest, NextResponse } from "next/server"
import { getVerifiedTelegramUser, isInternalTelegramEmail, verifyTelegramInitData } from "@/lib/telegram"
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const limit = rateLimit(`auth:telegram:init:${getClientIp(request)}`, { windowMs: 60_000, maxRequests: 30 })
    if (!limit.success) {
      return NextResponse.json({ error: "Слишком много попыток. Повторите позже." }, { status: 429, headers: rateLimitHeaders(limit) })
    }
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 })
    }
    const { initData } = body as Record<string, unknown>
    const botToken = process.env.TELEGRAM_BOT_TOKEN
    if (typeof initData !== "string" || !initData || initData.length > 16_384) {
      return NextResponse.json({ error: "Missing or invalid initData" }, { status: 400 })
    }
    if (!botToken) return NextResponse.json({ error: "Telegram auth is not configured" }, { status: 503 })

    const telegramUser = verifyTelegramInitData(initData, botToken)
    if (!telegramUser) return NextResponse.json({ error: "Telegram session is invalid or expired" }, { status: 401 })

    const user = await getVerifiedTelegramUser(telegramUser.id)
    if (!user) {
      return NextResponse.json({ error: "Сначала откройте бота, нажмите «Старт» и отправьте свой контакт." }, { status: 403 })
    }

    return NextResponse.json({
      success: true,
      sessionProvider: "telegram",
      user: { id: user.id, email: isInternalTelegramEmail(user.email) ? null : user.email, name: user.name, image: user.image, role: user.role },
    })
  } catch (error) {
    console.error("Telegram auth error:", error)
    return NextResponse.json({ error: "Ошибка авторизации через Telegram" }, { status: 500 })
  }
}
