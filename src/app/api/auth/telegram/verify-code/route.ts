import { NextRequest, NextResponse } from "next/server"
import { consumeTelegramOtp } from "@/lib/telegram"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const { phone, code } = await request.json()
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
