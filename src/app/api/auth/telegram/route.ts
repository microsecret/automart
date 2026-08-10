import { NextRequest, NextResponse } from "next/server"
import { getVerifiedTelegramUser, verifyTelegramInitData } from "@/lib/telegram"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const { initData } = await request.json()
    const botToken = process.env.TELEGRAM_BOT_TOKEN
    if (!initData) return NextResponse.json({ error: "Missing initData" }, { status: 400 })
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
      user: { id: user.id, email: user.email, name: user.name, image: user.image, role: user.role },
    })
  } catch (error) {
    console.error("Telegram auth error:", error)
    return NextResponse.json({ error: "Ошибка авторизации через Telegram" }, { status: 500 })
  }
}
