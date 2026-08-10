import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { isEmailDeliveryConfigured, sendEmailVerification } from "@/lib/emailVerification"
import { normalizePhone } from "@/lib/telegram"
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const { name, email: emailInput, phone: phoneInput, password } = await request.json()
    const normalizedName = typeof name === "string" ? name.trim() : ""
    const email = String(emailInput || "").trim().toLowerCase()
    const phone = normalizePhone(phoneInput)

    const ipLimit = rateLimit(`auth:register:ip:${getClientIp(request)}`, { windowMs: 15 * 60_000, maxRequests: 5 })
    const emailLimit = rateLimit(`auth:register:email:${email || "unknown"}`, { windowMs: 60 * 60_000, maxRequests: 3 })
    if (!ipLimit.success || !emailLimit.success) {
      const limit = !ipLimit.success ? ipLimit : emailLimit
      return NextResponse.json({ error: "Слишком много попыток регистрации. Повторите позже." }, { status: 429, headers: rateLimitHeaders(limit) })
    }

    if (!normalizedName || !email || !phone || !password) {
      return NextResponse.json({ error: "Имя, email, телефон и пароль обязательны" }, { status: 400 })
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ error: "Некорректный email" }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "Пароль минимум 6 символов" }, { status: 400 })
    }
    if (!isEmailDeliveryConfigured()) {
      return NextResponse.json({ error: "Подтверждение email ещё не настроено. Попробуйте позже." }, { status: 503 })
    }

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

    try {
      await sendEmailVerification(user.email, user.name)
    } catch (emailError) {
      console.error("Registration email error:", emailError)
      return NextResponse.json({
        user,
        requiresEmailVerification: true,
        emailDeliveryPending: true,
      }, { status: 201 })
    }

    return NextResponse.json({ user, requiresEmailVerification: true }, { status: 201 })
  } catch (error) {
    console.error("Registration error:", error)
    return NextResponse.json({ error: "Ошибка регистрации" }, { status: 500 })
  }
}
