import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requireAdminSession } from "@/lib/admin-route-guard"
import { recordAdminAudit } from "@/lib/admin-audit"

export const dynamic = "force-dynamic"

/**
 * Раздел «Данные» в админке: то, чего раньше не было видно вовсе.
 *
 * Переписки пользователей, отзывы, уведомления, контакты бота и заявки на
 * запчасти лежали в базе, а админка показывала по ним только счётчики —
 * разобрать жалобу на продавца или найти, кто оставил отзыв, было нельзя.
 *
 * Один маршрут с параметром kind: у всех пяти видов одинаковая механика —
 * последние записи страницами и поиск.
 */

const PAGE_SIZE = 30
const KINDS = ["conversations", "reviews", "notifications", "contacts", "part-requests"] as const
type Kind = (typeof KINDS)[number]

const userBrief = { select: { id: true, name: true, email: true, telegramUsername: true } } as const

/* Люди по имени, почте или телеграму — для поиска по переписке. В SQLite
   сравнение кириллицы чувствительно к регистру, поэтому ищем как ввели и с
   заглавной первой буквой. */
async function usersMatching(q: string) {
  const variants = [...new Set([q, q.charAt(0).toUpperCase() + q.slice(1)])]
  const rows = await prisma.user.findMany({
    where: { OR: variants.flatMap((value) => [{ name: { contains: value } }, { email: { contains: value } }, { telegramUsername: { contains: value } }]) },
    select: { id: true },
    take: 50,
  })
  return rows.map((row) => row.id)
}

async function listConversations(q: string, page: number) {
  let where: Prisma.MessageWhereInput = {}
  if (q) {
    const ids = await usersMatching(q)
    where = { OR: [{ senderId: { in: ids } }, { receiverId: { in: ids } }, { content: { contains: q } }] }
  }
  const groups = await prisma.message.groupBy({
    by: ["conversationId"],
    where,
    _count: { _all: true },
    _max: { createdAt: true },
    orderBy: { _max: { createdAt: "desc" } },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  })
  const items = await Promise.all(groups.map(async (group) => {
    const last = await prisma.message.findFirst({
      where: { conversationId: group.conversationId },
      orderBy: { createdAt: "desc" },
      select: {
        content: true, createdAt: true,
        sender: userBrief, receiver: userBrief,
        listing: { select: { id: true, title: true } },
      },
    })
    return {
      conversationId: group.conversationId,
      messages: group._count._all,
      lastAt: group._max.createdAt,
      lastText: last?.content.slice(0, 160) || "",
      participants: last ? [last.sender, last.receiver] : [],
      listing: last?.listing || null,
    }
  }))
  return items
}

async function listReviews(q: string, page: number) {
  return prisma.review.findMany({
    where: q ? { comment: { contains: q } } : undefined,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: { id: true, rating: true, comment: true, createdAt: true, user: userBrief, listing: { select: { id: true, title: true } } },
  })
}

async function listNotifications(q: string, page: number) {
  return prisma.notification.findMany({
    where: q ? { OR: [{ title: { contains: q } }, { content: { contains: q } }] } : undefined,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: { id: true, title: true, content: true, type: true, isRead: true, relatedType: true, createdAt: true, user: userBrief },
  })
}

async function listContacts(q: string, page: number) {
  const where: Prisma.TelegramContactWhereInput | undefined = q
    ? { OR: [{ username: { contains: q.replace(/^@/, "") } }, { firstName: { contains: q } }, { lastName: { contains: q } }, { telegramId: q }] }
    : undefined
  const contacts = await prisma.telegramContact.findMany({
    where,
    orderBy: { startedAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      telegramId: true, username: true, firstName: true, lastName: true,
      registered: true, blocked: true, weeklyOptOut: true,
      startedAt: true, lastSeenAt: true, lastWeeklyAt: true,
    },
  })
  // Есть ли у человека аккаунт на сайте — связь по telegramId.
  const accounts = await prisma.user.findMany({
    where: { telegramId: { in: contacts.map((contact) => contact.telegramId) } },
    select: { id: true, name: true, telegramId: true },
  })
  const byTelegram = new Map(accounts.map((account) => [account.telegramId, account]))
  return contacts.map((contact) => ({ ...contact, account: byTelegram.get(contact.telegramId) || null }))
}

async function listPartRequests(q: string, page: number) {
  return prisma.partRequest.findMany({
    where: q ? { OR: [{ partName: { contains: q } }, { oemNumber: { contains: q } }, { make: { contains: q } }, { city: { contains: q } }] } : undefined,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      id: true, partName: true, oemNumber: true, make: true, model: true, year: true,
      name: true, phone: true, city: true, status: true, createdAt: true,
      _count: { select: { offers: true } },
    },
  })
}

export async function GET(request: NextRequest) {
  const guard = await requireAdminSession()
  if (guard.denied) return guard.denied

  const params = request.nextUrl.searchParams
  const kind = params.get("kind") as Kind
  if (!KINDS.includes(kind)) return NextResponse.json({ error: "Неизвестный раздел" }, { status: 400 })
  const q = (params.get("q") || "").trim().slice(0, 80)
  const page = Math.max(1, Math.min(500, Number.parseInt(params.get("page") || "1", 10) || 1))

  try {
    const items = kind === "conversations" ? await listConversations(q, page)
      : kind === "reviews" ? await listReviews(q, page)
      : kind === "notifications" ? await listNotifications(q, page)
      : kind === "contacts" ? await listContacts(q, page)
      : await listPartRequests(q, page)
    return NextResponse.json({ items, page, pageSize: PAGE_SIZE })
  } catch (error) {
    console.error(`Admin records ${kind} failed:`, error)
    return NextResponse.json({ error: "Не удалось загрузить данные" }, { status: 500 })
  }
}

/** Удаление отзыва — оскорбительного или оставленного не по делу. */
export async function DELETE(request: NextRequest) {
  const guard = await requireAdminSession()
  if (guard.denied) return guard.denied
  const id = request.nextUrl.searchParams.get("reviewId")
  if (!id) return NextResponse.json({ error: "Не указан отзыв" }, { status: 400 })

  const review = await prisma.review.findUnique({ where: { id }, select: { id: true, rating: true, comment: true, userId: true, listingId: true } })
  if (!review) return NextResponse.json({ error: "Отзыв не найден" }, { status: 404 })
  await prisma.review.delete({ where: { id } })
  await recordAdminAudit({
    actorId: guard.session.user?.id || null,
    actorEmail: guard.session.user?.email || null,
    action: "REVIEW_DELETE",
    entityType: "Review",
    entityId: id,
    summary: `Удалён отзыв (${review.rating}★): ${review.comment || "без текста"}`,
    metadata: { userId: review.userId, listingId: review.listingId },
  })
  return NextResponse.json({ deleted: true })
}
