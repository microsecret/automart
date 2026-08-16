import { NextRequest, NextResponse } from "next/server"
import { consumeTelegramOtp } from "@/lib/telegram"
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 })
    const { phone, code } = body as Record<string, unknown>
    if (typeof phone !== "string" || typeof code !== "string") {
      return NextResponse.json({ error: "Телефон и код обязательны" }, { status: 400 })
    }
    const phoneKey = String(phone || "").replace(/[^\d+]/g, "") || "unknown"
    const ipLimit = rateLimit(`auth:telegram-otp-verify:ip:${getClientIp(request)}`, { windowMs: 15 * 60_000, maxRequests: 15 })
    const phoneLimit = rateLimit(`auth:telegram-otp-verify:phone:${phoneKey}`, { windowMs: 15 * 60_000, maxRequests: 5 })
    if (!ipLimit.success || !phoneLimit.success) {
      const limit = !ipLimit.success ? ipLimit : phoneLimit
      return NextResponse.json({ error: "Слишком много попыток. Запросите новый код позже." }, { status: 429, headers: rateLimitHeaders(limit) })
    }
    const user = await consumeTelegramOtp(phone, code)
    if (!user || !user.telegramVerifiedAt) return NextResponse.json({ error: "Код неверный или устарел" }, { status: 401 })
    return NextResponse.json({
      ok: true,
      sessionProvider: "phone-otp",
      user: { id: user.id, email: user.email, name: user.name, image: user.image, role: user.role },
    })
  } catch (error) {
    console.error("Telegram OTP verification error:", error)
    return NextResponse.json({ error: "Не удалось проверить код" }, { status: 500 })
  }
}
