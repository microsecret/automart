import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { resetPasswordByToken } from "@/lib/emailVerification"
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const token = typeof body.token === "string" ? body.token.trim() : ""
    const password = typeof body.password === "string" ? body.password : ""

    const ipLimit = rateLimit(`auth:password-reset-confirm:ip:${getClientIp(request)}`, { windowMs: 15 * 60_000, maxRequests: 15 })
    if (!ipLimit.success) {
      return NextResponse.json(
        { error: "Слишком много попыток. Попробуйте позже." },
        { status: 429, headers: rateLimitHeaders(ipLimit) },
      )
    }
    if (token.length < 32 || token.length > 200) {
      return NextResponse.json({ error: "Ссылка недействительна или устарела." }, { status: 400 })
    }
    if (password.length < 8 || password.length > 128) {
      return NextResponse.json({ error: "Пароль должен содержать от 8 до 128 символов." }, { status: 400 })
    }

    const user = await resetPasswordByToken(token, await bcrypt.hash(password, 12))
    if (!user) return NextResponse.json({ error: "Ссылка недействительна или устарела." }, { status: 400 })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Password reset error:", error)
    return NextResponse.json({ error: "Не удалось обновить пароль. Попробуйте позже." }, { status: 500 })
  }
}
