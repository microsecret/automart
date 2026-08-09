import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isEmailDeliveryConfigured, sendPasswordResetEmail } from "@/lib/emailVerification"
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

const emailPattern = /^\S+@\S+\.\S+$/

/** Sends a neutral reset response to avoid revealing whether an email exists. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const email = String(body.email || "").trim().toLowerCase()

    const ipLimit = rateLimit(`auth:password-reset:ip:${getClientIp(request)}`, { windowMs: 15 * 60_000, maxRequests: 10 })
    const emailLimit = rateLimit(`auth:password-reset:email:${email || "unknown"}`, { windowMs: 60 * 60_000, maxRequests: 5 })
    if (!ipLimit.success || !emailLimit.success) {
      const limit = !ipLimit.success ? ipLimit : emailLimit
      return NextResponse.json(
        { error: "Слишком много попыток. Попробуйте позже." },
        { status: 429, headers: rateLimitHeaders(limit) },
      )
    }

    if (!emailPattern.test(email)) {
      return NextResponse.json({ error: "Укажите корректный email" }, { status: 400 })
    }
    if (!isEmailDeliveryConfigured()) {
      return NextResponse.json({ error: "Восстановление по email временно недоступно. Попробуйте позже." }, { status: 503 })
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { email: true, name: true, hashedPassword: true },
    })
    if (user?.hashedPassword) await sendPasswordResetEmail(user.email, user.name)

    return NextResponse.json({ ok: true, message: "Если аккаунт с таким email существует, инструкция отправлена." })
  } catch (error) {
    console.error("Forgot password request error:", error)
    return NextResponse.json({ error: "Не удалось отправить инструкцию. Попробуйте позже." }, { status: 500 })
  }
}
