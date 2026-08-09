import { NextRequest, NextResponse } from "next/server"
import { linkTelegramIdentity, TelegramIdentityConflictError, verifyTelegramInitData } from "@/lib/telegram"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const { initData } = await request.json()
    const botToken = process.env.TELEGRAM_BOT_TOKEN
    if (!initData) return NextResponse.json({ error: "Missing initData" }, { status: 400 })
    if (!botToken) return NextResponse.json({ error: "Telegram auth is not configured" }, { status: 503 })

    const telegramUser = verifyTelegramInitData(initData, botToken)
    if (!telegramUser) return NextResponse.json({ error: "Telegram session is invalid or expired" }, { status: 401 })

    const user = await linkTelegramIdentity({
      telegramId: telegramUser.id,
      username: telegramUser.username,
      name: [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(" "),
      image: telegramUser.photo_url,
    })

    return NextResponse.json({
      success: true,
      sessionProvider: "telegram",
      user: { id: user.id, email: user.email, name: user.name, image: user.image, role: user.role },
    })
  } catch (error) {
    if (error instanceof TelegramIdentityConflictError) {
      return NextResponse.json({ error: "Этот Telegram и номер телефона уже привязаны к разным аккаунтам" }, { status: 409 })
    }
    console.error("Telegram auth error:", error)
    return NextResponse.json({ error: "Ошибка авторизации через Telegram" }, { status: 500 })
  }
}
