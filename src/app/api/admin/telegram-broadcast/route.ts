import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth"
import { isAdmin } from "@/lib/permissions"
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit"
import { getTelegramContactStats } from "@/lib/telegram-contacts"
import { sendTelegramBroadcast, type BroadcastAudience } from "@/lib/telegram-broadcast"
import { recordAdminAudit } from "@/lib/admin-audit"

export const dynamic = "force-dynamic"

const AUDIENCES: BroadcastAudience[] = ["all", "unregistered", "registered"]

/** GET — сводка по контактам бота для админки. */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!isAdmin(session?.user?.role)) return NextResponse.json({ error: "Нет прав" }, { status: 403 })

  try {
    // История нужна вместе со сводкой: администратор должен видеть, что уже
    // отправлено, прежде чем писать следующее письмо.
    const [stats, history] = await Promise.all([
      getTelegramContactStats(),
      prisma.telegramBroadcast.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true, text: true, audience: true, total: true,
          delivered: true, blocked: true, failed: true,
          sentByName: true, createdAt: true,
        },
      }),
    ])
    return NextResponse.json({ stats, history })
  } catch (error) {
    console.error("Telegram contact stats failed:", error)
    return NextResponse.json({ error: "Не удалось загрузить статистику" }, { status: 500 })
  }
}

/** POST — разослать сообщение выбранной аудитории. */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!isAdmin(session?.user?.role)) return NextResponse.json({ error: "Нет прав" }, { status: 403 })

  // Рассылка уходит тысячам людей и её нельзя отозвать: ограничитель защищает
  // от случайной двойной отправки по повторному нажатию кнопки.
  const limit = rateLimit(`broadcast:${session?.user?.id || getClientIp(request)}`, {
    windowMs: 10 * 60_000,
    maxRequests: 3,
  })
  if (!limit.success) {
    return NextResponse.json(
      { error: "Слишком часто. Подождите несколько минут перед следующей рассылкой." },
      { status: 429, headers: rateLimitHeaders(limit) },
    )
  }

  try {
    const body = await request.json().catch(() => null)
    const text = typeof body?.text === "string" ? body.text.trim() : ""
    const audience = AUDIENCES.includes(body?.audience) ? body.audience as BroadcastAudience : "all"
    const limitCount = Number.isInteger(body?.limit) && body.limit > 0
      ? Math.min(Number(body.limit), 10_000)
      : undefined

    if (!text) return NextResponse.json({ error: "Введите текст сообщения" }, { status: 400 })
    if (text.length > 4_000) {
      return NextResponse.json({ error: "Telegram не принимает сообщения длиннее 4 000 символов" }, { status: 400 })
    }

    const result = await sendTelegramBroadcast({
      text,
      audience,
      limit: limitCount,
      sentBy: { id: session?.user?.id, name: session?.user?.name },
    })
    await recordAdminAudit({
      actorId: session?.user?.id || null,
      actorEmail: session?.user?.email,
      action: "TELEGRAM_BROADCAST_SEND",
      entityType: "TelegramBroadcast",
      summary: `Telegram-рассылка: доставлено ${result.delivered} из ${result.total}, ошибок ${result.failed}`,
      metadata: {
        audience: result.audience,
        requestedLimit: limitCount || null,
        total: result.total,
        delivered: result.delivered,
        blocked: result.blocked,
        failed: result.failed,
      },
    })
    return NextResponse.json(result)
  } catch (error) {
    console.error("Telegram broadcast failed:", error)
    return NextResponse.json({ error: "Рассылка не выполнена" }, { status: 500 })
  }
}
