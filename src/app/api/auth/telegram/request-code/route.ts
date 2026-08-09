import { NextRequest, NextResponse } from "next/server"
import { issueTelegramOtp, normalizePhone, telegramApi } from "@/lib/telegram"
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const { phone: phoneInput } = await request.json()
    const phone = normalizePhone(phoneInput)
    if (!phone) return NextResponse.json({ error: "Введите телефон в формате +7 900 000-00-00" }, { status: 400 })

    const ipLimit = rateLimit(`auth:telegram-otp-request:ip:${getClientIp(request)}`, { windowMs: 15 * 60_000, maxRequests: 10 })
    const phoneLimit = rateLimit(`auth:telegram-otp-request:phone:${phone}`, { windowMs: 15 * 60_000, maxRequests: 5 })
    if (!ipLimit.success || !phoneLimit.success) {
      const limit = !ipLimit.success ? ipLimit : phoneLimit
      return NextResponse.json({ error: "Слишком много запросов кода. Повторите позже." }, { status: 429, headers: rateLimitHeaders(limit) })
    }

    const result = await issueTelegramOtp(phone)
    if (result.status === "invalid") return NextResponse.json({ error: "Некорректный телефон" }, { status: 400 })
    if (result.status === "cooldown") return NextResponse.json({ ok: true, retryAfter: 60, message: "Код уже отправлен. Проверьте Telegram." })

    if (result.status === "issued" && result.user?.telegramId && result.code) {
      await telegramApi("sendMessage", {
        chat_id: result.user.telegramId,
        text: `Код входа в Авторынок: ${result.code}\nОн действует 10 минут. Никому его не сообщайте.`,
      })
    }

    return NextResponse.json({
      ok: true,
      retryAfter: 60,
      message: "Если номер уже подтверждён в Telegram, код отправлен в бот.",
    })
  } catch (error) {
    console.error("Telegram OTP request error:", error)
    return NextResponse.json({ error: "Не удалось отправить код. Попробуйте позже." }, { status: 503 })
  }
}
