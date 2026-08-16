import { getServerSession } from "next-auth"
import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { authOptions } from "@/lib/auth"
import { can } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { isSupportPriority } from "@/lib/support-workspace"

export const dynamic = "force-dynamic"

async function requireSupportManager() {
  const session = await getServerSession(authOptions)
  return session && can(session.user?.role, "support:manage") ? session : null
}

async function loadTicket(id: string) {
  return prisma.supportTicket.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true, telegramUsername: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        include: { authorUser: { select: { id: true, name: true, email: true } } },
      },
    },
  })
}

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSupportManager()
    if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const { id } = await context.params
    const ticket = await loadTicket(id)
    if (!ticket) return NextResponse.json({ error: "Обращение не найдено" }, { status: 404 })

    await prisma.supportTicket.update({
      where: { id },
      data: { lastReadByStaffAt: new Date() },
    })
    return NextResponse.json({ ticket })
  } catch (error) {
    console.error("Admin support detail error:", error)
    return NextResponse.json({ error: "Не удалось загрузить обращение" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSupportManager()
    if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const operatorId = typeof session.user?.id === "string" ? session.user.id : null
    if (!operatorId) return NextResponse.json({ error: "Не определён оператор" }, { status: 403 })

    const { id } = await context.params
    const existing = await prisma.supportTicket.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: "Обращение не найдено" }, { status: 404 })
    const body = await request.json().catch(() => null)
    const action = typeof body?.action === "string" ? body.action.toUpperCase() : ""
    let systemText = ""
    let data: Prisma.SupportTicketUncheckedUpdateInput = { lastReadByStaffAt: new Date() }

    if (action === "TAKE_OVER") {
      data = { ...data, assignedToId: operatorId, mode: "OPERATOR", status: "IN_PROGRESS", closedAt: null }
      systemText = "Оператор подключился к диалогу."
    } else if (action === "RELEASE_TO_AI") {
      data = { ...data, assignedToId: null, mode: "AI", status: "OPEN", closedAt: null }
      systemText = "Диалог возвращён автоматическому помощнику."
    } else if (action === "CLOSE") {
      data = { ...data, status: "CLOSED", closedAt: new Date() }
      systemText = "Оператор закрыл обращение."
    } else if (action === "REOPEN") {
      data = { ...data, status: "IN_PROGRESS", mode: "OPERATOR", assignedToId: operatorId, closedAt: null }
      systemText = "Оператор повторно открыл обращение."
    } else if (action === "SET_PRIORITY" && isSupportPriority(body?.priority)) {
      data = { ...data, priority: body.priority }
    } else if (action === "UPDATE_SUBJECT") {
      const subject = typeof body?.subject === "string" ? body.subject.trim().slice(0, 120) : ""
      if (!subject) return NextResponse.json({ error: "Введите тему обращения" }, { status: 400 })
      data = { ...data, subject }
    } else {
      return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 })
    }

    await prisma.$transaction(async (tx) => {
      await tx.supportTicket.update({ where: { id }, data })
      if (systemText) {
        await tx.supportMessage.create({
          data: { ticketId: id, authorType: "SYSTEM", authorUserId: operatorId, content: systemText },
        })
      }
    })
    return NextResponse.json({ ticket: await loadTicket(id) })
  } catch (error) {
    console.error("Admin support update error:", error)
    return NextResponse.json({ error: "Не удалось обновить обращение" }, { status: 500 })
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSupportManager()
    if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const operatorId = typeof session.user?.id === "string" ? session.user.id : null
    if (!operatorId) return NextResponse.json({ error: "Не определён оператор" }, { status: 403 })
    const { id } = await context.params
    const body = await request.json().catch(() => null)
    const content = typeof body?.message === "string" ? body.message.trim() : ""
    if (!content) return NextResponse.json({ error: "Введите ответ" }, { status: 400 })
    if (content.length > 4_000) return NextResponse.json({ error: "Ответ не должен превышать 4000 символов" }, { status: 400 })
    const exists = await prisma.supportTicket.findUnique({ where: { id }, select: { id: true } })
    if (!exists) return NextResponse.json({ error: "Обращение не найдено" }, { status: 404 })

    await prisma.$transaction([
      prisma.supportMessage.create({
        data: { ticketId: id, authorType: "OPERATOR", authorUserId: operatorId, content },
      }),
      prisma.supportTicket.update({
        where: { id },
        data: {
          assignedToId: operatorId,
          mode: "OPERATOR",
          status: "IN_PROGRESS",
          lastMessageAt: new Date(),
          lastReadByStaffAt: new Date(),
          closedAt: null,
        },
      }),
    ])
    return NextResponse.json({ ticket: await loadTicket(id) })
  } catch (error) {
    console.error("Admin support reply error:", error)
    return NextResponse.json({ error: "Не удалось отправить ответ" }, { status: 500 })
  }
}
