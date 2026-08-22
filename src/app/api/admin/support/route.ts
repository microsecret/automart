import { getServerSession } from "next-auth"
import { NextRequest, NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { can } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { planPriorityPage, priorityRank } from "@/lib/support-priority-order"
import { isSupportPriority, isSupportStatus } from "@/lib/support-workspace"

export const dynamic = "force-dynamic"

async function requireSupportManager() {
  const session = await getServerSession(authOptions)
  return session && can(session.user?.role, "support:manage") ? session : null
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireSupportManager()
    if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const statusParam = request.nextUrl.searchParams.get("status")
    const priorityParam = request.nextUrl.searchParams.get("priority")
    const query = request.nextUrl.searchParams.get("q")?.trim().slice(0, 100) || ""
    // Number("1e400") даёт Infinity, а Number("1e9") — целое вне диапазона:
    // и то и другое уходит в skip и роняет запрос. Верхняя граница держит
    // смещение в пределах, где выборка вообще имеет смысл.
    const rawPage = Number.parseInt(request.nextUrl.searchParams.get("page") || "1", 10)
    const page = Number.isInteger(rawPage) && rawPage > 0 ? Math.min(rawPage, 10_000) : 1
    const pageSize = 40

    const where = {
      ...(isSupportStatus(statusParam) ? { status: statusParam } : {}),
      ...(isSupportPriority(priorityParam) ? { priority: priorityParam } : {}),
      ...(query
        ? {
            OR: [
              { subject: { contains: query } },
              { guestName: { contains: query } },
              { guestEmail: { contains: query } },
              { guestPhone: { contains: query } },
              { user: { is: { name: { contains: query } } } },
              { user: { is: { email: { contains: query } } } },
            ],
          }
        : {}),
    }

    const ticketInclude = {
      user: { select: { id: true, name: true, email: true, phone: true, telegramUsername: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
      messages: { orderBy: { createdAt: "desc" as const }, take: 1 },
      _count: { select: { messages: true } },
    }

    /* Сколько обращений каждой важности подходит под текущие фильтры.

       Это нужно до самой выборки: важность хранится строкой, и база не умеет
       упорядочить её по смыслу (сортировка по убыванию давала
       URGENT → NORMAL → LOW → HIGH — важное ниже низкоприоритетного).
       Зная размеры групп, страницу можно собрать из них по порядку. */
    const [total, groupedByStatus, groupedByPriority, unreadCandidates, filteredByPriority] = await Promise.all([
      prisma.supportTicket.count({ where }),
      prisma.supportTicket.groupBy({ by: ["status"], _count: true }),
      prisma.supportTicket.groupBy({ by: ["priority"], _count: true }),
      prisma.supportTicket.findMany({
        where: { status: { not: "CLOSED" } },
        select: { lastMessageAt: true, lastReadByStaffAt: true },
      }),
      prisma.supportTicket.groupBy({ by: ["priority"], where, _count: true }),
    ])

    const countsByPriority = Object.fromEntries(
      filteredByPriority.map((item) => [item.priority, item._count]),
    ) as Record<string, number>

    // По запросу на группу важности — но только на непустые, попавшие в страницу.
    // Обычно это одна-две группы, а не четыре.
    const plan = planPriorityPage(countsByPriority, (page - 1) * pageSize, pageSize)
    const groups = await Promise.all(
      plan.map((step) =>
        prisma.supportTicket.findMany({
          where: { ...where, priority: step.priority },
          orderBy: { lastMessageAt: "desc" },
          skip: step.skip,
          take: step.take,
          include: ticketInclude,
        }),
      ),
    )

    // Группы уже пришли в нужном порядке, но сортировка страхует от того,
    // что параллельные запросы вернутся вперемешку.
    const tickets = groups
      .flat()
      .sort(
        (a, b) =>
          priorityRank(a.priority) - priorityRank(b.priority) ||
          b.lastMessageAt.getTime() - a.lastMessageAt.getTime(),
      )

    return NextResponse.json({
      tickets: tickets.map((ticket) => ({
        id: ticket.id,
        subject: ticket.subject,
        status: ticket.status,
        mode: ticket.mode,
        priority: ticket.priority,
        guest: {
          name: ticket.guestName,
          email: ticket.guestEmail,
          phone: ticket.guestPhone,
        },
        user: ticket.user,
        assignedTo: ticket.assignedTo,
        lastMessage: ticket.messages[0]
          ? {
              authorType: ticket.messages[0].authorType,
              content: ticket.messages[0].content,
              createdAt: ticket.messages[0].createdAt,
            }
          : null,
        messagesCount: ticket._count.messages,
        lastMessageAt: ticket.lastMessageAt,
        lastReadByStaffAt: ticket.lastReadByStaffAt,
        createdAt: ticket.createdAt,
      })),
      pagination: { page, pageSize, total, pages: Math.ceil(total / pageSize) },
      counters: {
        unread: unreadCandidates.filter(
          (ticket) => !ticket.lastReadByStaffAt || ticket.lastMessageAt > ticket.lastReadByStaffAt,
        ).length,
        byStatus: Object.fromEntries(groupedByStatus.map((item) => [item.status, item._count])),
        byPriority: Object.fromEntries(groupedByPriority.map((item) => [item.priority, item._count])),
      },
    })
  } catch (error) {
    console.error("Admin support list error:", error)
    return NextResponse.json({ error: "Не удалось загрузить обращения" }, { status: 500 })
  }
}
