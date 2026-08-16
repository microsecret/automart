import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { isEmailDeliveryConfigured, sendEmailVerification } from "@/lib/emailVerification"
import { normalizePhone } from "@/lib/telegram"
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Некорректные данные регистрации" }, { status: 400 })
    const { name, email: emailInput, phone: phoneInput, password } = body as Record<string, unknown>
    const normalizedName = typeof name === "string" ? name.trim() : ""
    const email = String(emailInput || "").trim().toLowerCase()
    const phone = normalizePhone(phoneInput)

    const ipLimit = rateLimit(`auth:register:ip:${getClientIp(request)}`, { windowMs: 15 * 60_000, maxRequests: 5 })
    const emailLimit = rateLimit(`auth:register:email:${email || "unknown"}`, { windowMs: 60 * 60_000, maxRequests: 3 })
    if (!ipLimit.success || !emailLimit.success) {
      const limit = !ipLimit.success ? ipLimit : emailLimit
      return NextResponse.json({ error: "Слишком много попыток регистрации. Повторите позже." }, { status: 429, headers: rateLimitHeaders(limit) })
    }

    if (!normalizedName || !email || !phone || typeof password !== "string") {
      return NextResponse.json({ error: "Имя, email, телефон и пароль обязательны" }, { status: 400 })
    }
    if (normalizedName.length < 2 || normalizedName.length > 80) {
      return NextResponse.json({ error: "Имя должно содержать от 2 до 80 символов" }, { status: 400 })
    }
    if (email.length > 254 || !/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ error: "Некорректный email" }, { status: 400 })
    }
    if (password.length < 8 || password.length > 128) {
      return NextResponse.json({ error: "Пароль должен содержать от 8 до 128 символов" }, { status: 400 })
    }
    // Email is an additional verification channel. The account can still be
    // created safely while mail delivery is temporarily unavailable: password
    // login stays closed until email confirmation, and Telegram contact
    // verification remains the secure way to enter the account.
    const emailDeliveryConfigured = isEmailDeliveryConfigured()

    const [existingEmail, existingPhone] = await Promise.all([
      prisma.user.findUnique({ where: { email } }),
      prisma.user.findUnique({ where: { phone } }),
    ])
    if (existingEmail) {
      return NextResponse.json({ error: "Пользователь с таким email уже существует" }, { status: 409 })
    }
    if (existingPhone) return NextResponse.json({ error: "Этот номер уже связан с аккаунтом. Войдите через Telegram." }, { status: 409 })

    const hashedPassword = await bcrypt.hash(password, 12)
    const user = await prisma.user.create({
      data: {
        name: normalizedName,
        email,
        phone,
        hashedPassword,
        role: "USER",
      },
      select: { id: true, email: true, name: true, phone: true },
    })

    let emailDeliveryPending = !emailDeliveryConfigured
    if (emailDeliveryConfigured) {
      try {
        await sendEmailVerification(user.email, user.name)
      } catch (emailError) {
        console.error("Registration email error:", emailError)
        emailDeliveryPending = true
      }
    }

    return NextResponse.json({ user, requiresEmailVerification: true, emailDeliveryPending }, { status: 201 })
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "Email или телефон уже связан с аккаунтом" }, { status: 409 })
    }
    console.error("Registration error:", error)
    return NextResponse.json({ error: "Ошибка регистрации" }, { status: 500 })
  }
}
