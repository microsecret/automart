import crypto from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { cleanupExpiredChatPromotions, notifyExpiringChatPromotions, runChatPromotionDelivery } from "@/lib/chat-promotion-delivery"

export const dynamic = "force-dynamic"

/**
 * Публикация оплаченных объявлений в сети чатов.
 *
 * Вызывается по расписанию с тем же ключом, что и остальные задачи бота:
 * маршрут открыт в интернет, а публикация в сотню тысяч подписчиков —
 * не то действие, которое можно запустить со стороны.
 */
function hasValidSecret(request: NextRequest, secret: string) {
  const received = request.headers.get("x-telegram-bot-api-secret-token") || ""
  const expectedBuffer = Buffer.from(secret)
  const receivedBuffer = Buffer.from(received)
  return expectedBuffer.length === receivedBuffer.length && crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
}

export async function POST(request: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!secret) return NextResponse.json({ error: "Telegram не настроен" }, { status: 503 })
  if (!hasValidSecret(request, secret)) return NextResponse.json({ error: "Требуется ключ" }, { status: 401 })

  try {
    /* Сначала уборка, потом публикация: место закрепа в группе одно, и
       снятый закреп истёкшего размещения освобождает его для нового. */
    const cleaned = await cleanupExpiredChatPromotions()
    const delivered = await runChatPromotionDelivery()
    /* Предупреждение о скором окончании — после публикации: сначала
       делаем оплаченную работу, потом напоминаем о продлении. */
    const warned = await notifyExpiringChatPromotions()

    return NextResponse.json({ success: true, ...delivered, removed: cleaned.removed, notified: warned.notified })
  } catch (error) {
    console.error("Публикация продвижения в чатах:", error)
    return NextResponse.json({ error: "Не удалось выполнить публикацию" }, { status: 500 })
  }
}
