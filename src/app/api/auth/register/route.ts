import { NextResponse } from "next/server"
import { getTelegramBotUsername } from "@/lib/telegram"

export const dynamic = "force-dynamic"

export async function POST() {
  const botUsername = getTelegramBotUsername()
  return NextResponse.json({
    error: "Регистрация доступна только через Telegram-бота",
    registrationUrl: botUsername ? `https://t.me/${botUsername}?start=register` : null,
  }, { status: 410 })
}
