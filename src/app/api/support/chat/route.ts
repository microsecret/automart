import { getServerSession } from "next-auth"
import { NextRequest, NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit"
import {
  buildSupportKnowledgeAnswer,
  normalizeSupportEmail,
  normalizeSupportName,
  normalizeSupportPhone,
  requestsHumanOperator,
  resolveVisitorSupportTicket,
  setSupportCookie,
  SUPPORT_QUICK_REPLIES,
} from "@/lib/support-workspace"

export const dynamic = "force-dynamic"

function parseMetadata(value: string | null) {
  if (!value) return null
  try {
    return JSON.parse(value) as Record<string, unknown>
  } catch {
    return null
  }
}

function serializeMessage(message: {
  id: string
  authorType: string
  content: string
  metadata: string | null
  createdAt: Date
}) {
  return {
    id: message.id,
    authorType: message.authorType,
    content: message.content,
    metadata: parseMetadata(message.metadata),
    createdAt: message.createdAt.toISOString(),
  }
}

async function buildVisitorPayload(ticketId: string) {
  const ticket = await prisma.supportTicket.findUniqueOrThrow({
    where: { id: ticketId },
    include: {
      messages: { orderBy: { createdAt: "asc" }, take: 200 },
      assignedTo: { select: { name: true } },
    },
  })

  return {
    ticket: {
      id: ticket.id,
      subject: ticket.subject,
      status: ticket.status,
      mode: ticket.mode,
      priority: ticket.priority,
      operatorName: ticket.assignedTo?.name || null,
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
    },
    messages: ticket.messages.map(serializeMessage),
    quickReplies: SUPPORT_QUICK_REPLIES,
  }
}

async function optionalSession() {
  return getServerSession(authOptions).catch(() => null)
}

export async function GET(request: NextRequest) {
  const limit = rateLimit(`support-chat-read:ip:${getClientIp(request)}`, {
    windowMs: 10 * 60_000,
    maxRequests: 120,
  })
  if (!limit.success) {
    return NextResponse.json(
      { error: "Слишком много запросов. Попробуйте через несколько минут." },
      { status: 429, headers: rateLimitHeaders(limit) },
    )
  }

  try {
    const session = await optionalSession()
    const userId = typeof session?.user?.id === "string" ? session.user.id : null
    const { ticket } = await resolveVisitorSupportTicket(request, { userId })

    if (!ticket) {
      return NextResponse.json(
        { ticket: null, messages: [], quickReplies: SUPPORT_QUICK_REPLIES },
        { headers: rateLimitHeaders(limit) },
      )
    }

    await prisma.supportTicket.update({
      where: { id: ticket.id },
      data: { lastReadByVisitorAt: new Date() },
    })
    return NextResponse.json(await buildVisitorPayload(ticket.id), { headers: rateLimitHeaders(limit) })
  } catch (error) {
    console.error("Support chat read error:", error)
    return NextResponse.json({ error: "Не удалось загрузить обращение" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const limit = rateLimit(`support-chat-write:ip:${getClientIp(request)}`, {
    windowMs: 10 * 60_000,
    maxRequests: 24,
  })
  if (!limit.success) {
    return NextResponse.json(
      { error: "Слишком много сообщений. Попробуйте через несколько минут." },
      { status: 429, headers: rateLimitHeaders(limit) },
    )
  }

  try {
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 })
    }

    const action = typeof body.action === "string" ? body.action.toUpperCase() : "MESSAGE"
    if (!new Set(["MESSAGE", "UPDATE_CONTACT", "REQUEST_OPERATOR", "CLOSE"]).has(action)) {
      return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 })
    }
    const guestName = action === "UPDATE_CONTACT" ? normalizeSupportName(body.name) : null
    const guestEmail = action === "UPDATE_CONTACT" ? normalizeSupportEmail(body.email) : null
    const guestPhone = action === "UPDATE_CONTACT" ? normalizeSupportPhone(body.phone) : null
    if (action === "UPDATE_CONTACT" && !guestName && !guestEmail && !guestPhone) {
      return NextResponse.json({ error: "Укажите имя, email или телефон" }, { status: 400 })
    }
    const message = action === "MESSAGE" && typeof body.message === "string" ? body.message.trim() : ""
    if (action === "MESSAGE" && !message) return NextResponse.json({ error: "Введите сообщение" }, { status: 400 })
    if (message.length > 2_000) {
      return NextResponse.json({ error: "Сообщение не должно превышать 2000 символов" }, { status: 400 })
    }

    const session = await optionalSession()
    const userId = typeof session?.user?.id === "string" ? session.user.id : null
    const { ticket, newGuestToken } = await resolveVisitorSupportTicket(request, {
      userId,
      createIfMissing: action !== "CLOSE",
    })
    if (!ticket) {
      return NextResponse.json(
        { error: action === "CLOSE" ? "Активное обращение не найдено" : "Не удалось создать обращение" },
        { status: action === "CLOSE" ? 404 : 500 },
      )
    }

    if (action === "UPDATE_CONTACT") {
      await prisma.supportTicket.update({
        where: { id: ticket.id },
        data: {
          ...(guestName ? { guestName } : {}),
          ...(guestEmail ? { guestEmail } : {}),
          ...(guestPhone ? { guestPhone } : {}),
        },
      })
    } else if (action === "REQUEST_OPERATOR") {
      await prisma.$transaction(async (tx) => {
        await tx.supportTicket.update({
          where: { id: ticket.id },
          data: {
            mode: "OPERATOR",
            status: "WAITING_OPERATOR",
            lastMessageAt: new Date(),
            closedAt: null,
          },
        })
        await tx.supportMessage.create({
          data: {
            ticketId: ticket.id,
            authorType: "SYSTEM",
            content: "Оператор приглашён в диалог. Обращение сохранено в очереди поддержки.",
          },
        })
      })
    } else if (action === "CLOSE") {
      await prisma.$transaction(async (tx) => {
        await tx.supportTicket.update({
          where: { id: ticket.id },
          data: { status: "CLOSED", closedAt: new Date() },
        })
        await tx.supportMessage.create({
          data: {
            ticketId: ticket.id,
            authorType: "SYSTEM",
            content: "Обращение закрыто пользователем.",
          },
        })
      })
    } else {
      const wantsOperator = requestsHumanOperator(message)
      const shouldUseAssistant = ticket.mode !== "OPERATOR" && !wantsOperator

      await prisma.$transaction(async (tx) => {
        await tx.supportTicket.update({
          where: { id: ticket.id },
          data: {
            status: wantsOperator || ticket.mode === "OPERATOR" ? "WAITING_OPERATOR" : "OPEN",
            mode: wantsOperator ? "OPERATOR" : ticket.mode,
            closedAt: null,
            lastMessageAt: new Date(),
            lastReadByVisitorAt: new Date(),
          },
        })
        await tx.supportMessage.create({
          data: {
            ticketId: ticket.id,
            authorType: userId ? "USER" : "GUEST",
            authorUserId: userId,
            content: message,
          },
        })
      })

      if (wantsOperator) {
        await prisma.supportMessage.create({
          data: {
            ticketId: ticket.id,
            authorType: "SYSTEM",
            content: "Передал вопрос оператору. Он увидит историю диалога и ответит здесь.",
          },
        })
      } else if (shouldUseAssistant) {
        const knowledge = await buildSupportKnowledgeAnswer(message)
        await prisma.$transaction([
          prisma.supportMessage.create({
            data: {
              ticketId: ticket.id,
              authorType: "AI",
              content: knowledge.answer,
              metadata: knowledge.article ? JSON.stringify({ article: knowledge.article }) : null,
            },
          }),
          prisma.supportTicket.update({
            where: { id: ticket.id },
            data: { lastMessageAt: new Date() },
          }),
        ])
      }
    }

    const response = NextResponse.json(await buildVisitorPayload(ticket.id), {
      headers: rateLimitHeaders(limit),
    })
    if (newGuestToken) setSupportCookie(response, newGuestToken)
    return response
  } catch (error) {
    console.error("Support chat write error:", error)
    return NextResponse.json({ error: "Не удалось сохранить обращение" }, { status: 500 })
  }
}
