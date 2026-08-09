import { NextRequest, NextResponse } from "next/server"
import { isEmailDeliveryConfigured, sendEmailVerification } from "@/lib/emailVerification"
import { prisma } from "@/lib/prisma"
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const { email: emailInput } = await request.json()
    const email = String(emailInput || "").trim().toLowerCase()
    const ipLimit = rateLimit(`auth:email-resend:ip:${getClientIp(request)}`, { windowMs: 60 * 60_000, maxRequests: 5 })
    const emailLimit = rateLimit(`auth:email-resend:email:${email || "unknown"}`, { windowMs: 60 * 60_000, maxRequests: 3 })
    if (!ipLimit.success || !emailLimit.success) {
      const limit = !ipLimit.success ? ipLimit : emailLimit
      return NextResponse.json({ error: "Слишком много запросов. Повторите позже." }, { status: 429, headers: rateLimitHeaders(limit) })
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ error: "Введите корректный email" }, { status: 400 })
    }
    if (!isEmailDeliveryConfigured()) {
      return NextResponse.json({ error: "Подтверждение email временно не настроено" }, { status: 503 })
    }

    const user = await prisma.user.findUnique({ where: { email }, select: { name: true, emailVerified: true } })
    if (user && !user.emailVerified) await sendEmailVerification(email, user.name)
    return NextResponse.json({ ok: true, message: "Если аккаунт ожидает подтверждения, письмо отправлено повторно." })
  } catch (error) {
    console.error("Email verification resend error:", error)
    return NextResponse.json({ error: "Не удалось отправить письмо. Попробуйте позже." }, { status: 503 })
  }
}
