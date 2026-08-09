import { NextRequest, NextResponse } from "next/server"
import { isEmailDeliveryConfigured, sendEmailVerification } from "@/lib/emailVerification"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const { email: emailInput } = await request.json()
    const email = String(emailInput || "").trim().toLowerCase()
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
