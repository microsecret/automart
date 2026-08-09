import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

const STAFF_ROLES = new Set(["ADMIN", "MODERATOR"])

function isStaff(role?: string) {
  return Boolean(role && STAFF_ROLES.has(role))
}

async function getAuthenticatedUser() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return null
  return { id: session.user.id, role: session.user.role }
}

/**
 * GET /api/support
 * Пользователь видит только переписку своего обращения. Список всех тикетов
 * доступен только сотрудникам поддержки, чтобы ID обращения нельзя было
 * использовать для чтения чужих сообщений.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const ticketId = new URL(request.url).searchParams.get("ticketId")
    const requestedOwnerId = ticketId || user.id
    if (!isStaff(user.role) && requestedOwnerId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (!ticketId && isStaff(user.role)) {
      const all = await prisma.message.findMany({
        where: { conversationId: { startsWith: "support-" } },
        select: { conversationId: true, content: true, createdAt: true, senderId: true },
        orderBy: { createdAt: "desc" },
        distinct: ["conversationId"],
        take: 50,
      })
      return NextResponse.json({
        tickets: all.map((message) => ({
          id: message.conversationId.replace("support-", ""),
          lastMessage: message.content,
          lastAt: message.createdAt,
        })),
      })
    }

    const messages = await prisma.message.findMany({
      where: { conversationId: `support-${requestedOwnerId}` },
      orderBy: { createdAt: "asc" },
      take: 100,
    })
    return NextResponse.json({ ticketId: requestedOwnerId, messages })
  } catch (error) {
    console.error("Support GET error:", error)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}

/**
 * POST /api/support
 * Тикет привязан к аккаунту. Сотрудник может ответить в существующий тикет,
 * обычный пользователь — только в свой.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json().catch(() => ({})) as { message?: unknown; ticketId?: unknown }
    const message = typeof body.message === "string" ? body.message.trim() : ""
    const requestedOwnerId = typeof body.ticketId === "string" ? body.ticketId : user.id
    if (!message) return NextResponse.json({ error: "Сообщение пусто" }, { status: 400 })
    if (message.length > 4_000) return NextResponse.json({ error: "Сообщение слишком длинное" }, { status: 400 })
    if (!isStaff(user.role) && requestedOwnerId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const owner = await prisma.user.findUnique({ where: { id: requestedOwnerId }, select: { id: true } })
    if (!owner) return NextResponse.json({ error: "Тикет не найден" }, { status: 404 })

    const supportMessage = await prisma.message.create({
      data: {
        content: message,
        conversationId: `support-${owner.id}`,
        senderId: user.id,
        receiverId: owner.id,
      },
    })

    return NextResponse.json({ ticketId: owner.id, message: supportMessage }, { status: 201 })
  } catch (error) {
    console.error("Support POST error:", error)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
