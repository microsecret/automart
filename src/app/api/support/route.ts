import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

/**
 * GET /api/support — получить тикеты поддержки
 * POST /api/support — создать тикет или сообщение
 */

export async function GET(request: NextRequest) {
  try {
    const sp = new URL(request.url).searchParams
    const ticketId = sp.get("ticketId")

    if (ticketId) {
      // Получаем сообщения тикета — используем messages с conversationId = support-{ticketId}
      const messages = await prisma.message.findMany({
        where: { conversationId: `support-${ticketId}` },
        orderBy: { createdAt: "asc" },
        take: 100,
      })
      return NextResponse.json({ messages })
    }

    // Список уникальных тикетов
    const all = await prisma.message.findMany({
      where: { conversationId: { startsWith: "support-" } },
      select: { conversationId: true, content: true, createdAt: true, senderId: true },
      orderBy: { createdAt: "desc" },
      distinct: ["conversationId"],
      take: 50,
    })

    const tickets = all.map((m) => ({
      id: m.conversationId.replace("support-", ""),
      lastMessage: m.content,
      lastAt: m.createdAt,
    }))

    return NextResponse.json({ tickets })
  } catch (error) {
    console.error("Support GET error:", error)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { message, ticketId } = await request.json()
    if (!message?.trim()) {
      return NextResponse.json({ error: "Сообщение пусто" }, { status: 400 })
    }

    // Генерируем ticketId если нет
    const tId = ticketId || `support-${Date.now().toString(36)}`
    const conversationId = `support-${tId}`

    // Сохраняем сообщение
    const msg = await prisma.message.create({
      data: {
        content: message.trim(),
        conversationId,
        senderId: "support-anonymous",
        receiverId: "support-team",
      },
    })

    return NextResponse.json({ ticketId: tId, message: msg }, { status: 201 })
  } catch (error) {
    console.error("Support POST error:", error)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
