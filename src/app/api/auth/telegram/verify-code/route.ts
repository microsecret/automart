import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function POST() {
  return NextResponse.json({
    error: "Вход по Telegram-коду отключён. Используйте почту или телефон и пароль.",
  }, { status: 410 })
}
