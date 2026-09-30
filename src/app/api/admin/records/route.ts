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
const KINDS = ["inbox", "conversations", "listings", "reviews", "notifications", "contacts", "part-requests", "part-orders", "payments", "fuel-reports", "fuel-subscriptions"] as const
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

/**
 * Все диалоги площадки одной лентой.
 *
 * Обращения жили по разным углам: переписка покупателя с продавцом — в
 * сообщениях, вопрос в поддержку — в тикетах, чат доставки — в заказе,
 * заявки на импорт и на запчасти — в своих таблицах. Администратор видел
 * их порознь и не видел вовсе, откуда человеку не ответили. Здесь всё
 * сливается по времени последней активности; тип виден меткой.
 */
type InboxItem = {
  type: "message" | "support" | "delivery" | "auction-inquiry" | "part-request"
  id: string
  title: string
  who: string
  preview: string
  at: Date
  count: number
  status?: string | null
  href?: string | null
}

async function listInbox(q: string, page: number): Promise<InboxItem[]> {
  const take = page * PAGE_SIZE
  const contains = q ? { contains: q } : undefined
  const [tickets, deliveries, inquiries, partRequests] = await Promise.all([
    prisma.supportTicket.findMany({
      where: q ? { OR: [{ subject: { contains: q } }, { guestName: { contains: q } }, { guestEmail: { contains: q } }] } : undefined,
      orderBy: { lastMessageAt: "desc" },
      take,
      select: {
        id: true, subject: true, status: true, lastMessageAt: true, guestName: true, guestEmail: true,
        user: userBrief, _count: { select: { messages: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1, select: { content: true } },
      },
    }),
    prisma.deliveryOrder.findMany({
      where: { messages: { some: {} }, ...(q ? { OR: [{ title: { contains: q } }, { code: { contains: q } }] } : {}) },
      orderBy: { updatedAt: "desc" },
      take,
      select: {
        id: true, code: true, title: true, status: true, updatedAt: true, buyer: userBrief,
        _count: { select: { messages: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1, select: { content: true, createdAt: true } },
      },
    }),
    prisma.auctionInquiry.findMany({
      where: q ? { OR: [{ name: { contains: q } }, { city: { contains: q } }, { comment: contains }] } : undefined,
      orderBy: { updatedAt: "desc" },
      take,
      select: { id: true, name: true, city: true, comment: true, status: true, updatedAt: true, auctionListing: { select: { make: true, model: true, year: true } } },
    }),
    prisma.partRequest.findMany({
      where: q ? { OR: [{ partName: { contains: q } }, { name: { contains: q } }, { city: { contains: q } }] } : undefined,
      orderBy: { updatedAt: "desc" },
      take,
      select: { id: true, partName: true, oemNumber: true, name: true, city: true, comment: true, status: true, updatedAt: true, _count: { select: { offers: true } } },
    }),
  ])
  const messageThreads = await listConversationsTop(q, take)

  const items: InboxItem[] = [
    ...messageThreads.map((item): InboxItem => ({
      type: "message", id: item.conversationId,
      title: item.listing?.title || "Переписка пользователей",
      who: item.participants.map((person) => person?.name || person?.email || "—").join(" ↔ "),
      preview: item.lastText, at: item.lastAt ?? new Date(0), count: item.messages,
    })),
    ...tickets.map((ticket): InboxItem => ({
      type: "support", id: ticket.id, title: ticket.subject,
      who: ticket.user?.name || ticket.user?.email || ticket.guestName || ticket.guestEmail || "Гость",
      preview: ticket.messages[0]?.content.slice(0, 160) || "", at: ticket.lastMessageAt,
      count: ticket._count.messages, status: ticket.status, href: "/admin/support",
    })),
    ...deliveries.map((order): InboxItem => ({
      type: "delivery", id: order.id, title: `${order.code} · ${order.title}`,
      who: order.buyer?.name || order.buyer?.email || "Покупатель",
      preview: order.messages[0]?.content.slice(0, 160) || "", at: order.messages[0]?.createdAt || order.updatedAt,
      count: order._count.messages, status: order.status, href: "/dashboard/deliveries",
    })),
    ...inquiries.map((inquiry): InboxItem => ({
      type: "auction-inquiry", id: inquiry.id,
      title: `Импорт: ${[inquiry.auctionListing?.make, inquiry.auctionListing?.model, inquiry.auctionListing?.year].filter(Boolean).join(" ")}`,
      who: [inquiry.name, inquiry.city].filter(Boolean).join(", "),
      preview: inquiry.comment?.slice(0, 160) || "", at: inquiry.updatedAt, count: 1, status: inquiry.status, href: "/admin/auctions",
    })),
    ...partRequests.map((request): InboxItem => ({
      type: "part-request", id: request.id, title: `Запчасть: ${request.partName || request.oemNumber || "не указана"}`,
      who: [request.name, request.city].filter(Boolean).join(", "),
      preview: request.comment?.slice(0, 160) || "", at: request.updatedAt, count: request._count.offers, status: request.status,
    })),
  ]
  items.sort((left, right) => right.at.getTime() - left.at.getTime())
  return items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
}

/* Переписки пользователей — первые N по времени, для общей ленты. */
async function listConversationsTop(q: string, take: number) {
  const pages = Math.ceil(take / PAGE_SIZE)
  const result: Awaited<ReturnType<typeof listConversations>> = []
  for (let page = 1; page <= pages; page += 1) {
    const chunk = await listConversations(q, page)
    result.push(...chunk)
    if (chunk.length < PAGE_SIZE) break
  }
  return result
}

/* Объявления во всех статусах — модерация видит только очередь на проверку,
   а черновики, снятые и архивные пропадали из вида. */
async function listListings(q: string, page: number) {
  return prisma.listing.findMany({
    where: q ? { OR: [{ title: { contains: q } }, { title: { contains: q.charAt(0).toUpperCase() + q.slice(1) } }] } : undefined,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      id: true, title: true, price: true, status: true, statusReason: true, views: true, createdAt: true,
      user: userBrief, vehicle: { select: { id: true } }, part: { select: { id: true } },
    },
  })
}

async function listPartOrders(q: string, page: number) {
  return prisma.partOrder.findMany({
    where: q ? { OR: [{ itemName: { contains: q } }, { contactName: { contains: q } }, { city: { contains: q } }] } : undefined,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      id: true, itemName: true, quantity: true, itemPriceRub: true, status: true, contactName: true, contactPhone: true,
      city: true, comment: true, createdAt: true, store: { select: { name: true } },
    },
  })
}

async function listPayments(page: number) {
  return prisma.promotionOrder.findMany({
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      id: true, tariffId: true, amountRub: true, durationDays: true, status: true, provider: true, paidAt: true, createdAt: true,
      user: userBrief, listing: { select: { id: true, title: true } },
    },
  })
}

/* Отметки водителей на карте АЗС — цена и наличие одной лентой. */
async function listFuelReports(q: string, page: number) {
  const take = page * PAGE_SIZE
  const [prices, availability] = await Promise.all([
    prisma.fuelPriceReport.findMany({
      orderBy: { createdAt: "desc" }, take,
      select: { id: true, stationId: true, fuel: true, priceRub: true, status: true, createdAt: true, user: userBrief },
    }),
    prisma.fuelAvailabilityReport.findMany({
      where: q ? { OR: [{ stationName: { contains: q } }, { city: { contains: q } }, { comment: { contains: q } }] } : undefined,
      orderBy: { createdAt: "desc" }, take,
      select: { id: true, stationId: true, stationName: true, city: true, fuel: true, state: true, queue: true, comment: true, createdAt: true, user: userBrief },
    }),
  ])
  const rows = [
    ...prices.map((row) => ({ kind: "price" as const, ...row, stationName: null as string | null, city: null as string | null, state: null as string | null, comment: null as string | null })),
    ...availability.map((row) => ({ kind: "availability" as const, ...row, priceRub: null as number | null, status: null as string | null })),
  ]
  rows.sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
  return rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
}

async function listFuelSubscriptions(q: string, page: number) {
  return prisma.fuelSubscription.findMany({
    where: q ? { OR: [{ stationName: { contains: q } }, { city: { contains: q } }] } : undefined,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: { id: true, kind: true, stationName: true, fuel: true, city: true, lastNotifiedAt: true, createdAt: true, user: userBrief },
  })
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
    const items = kind === "inbox" ? await listInbox(q, page)
      : kind === "conversations" ? await listConversations(q, page)
      : kind === "listings" ? await listListings(q, page)
      : kind === "part-orders" ? await listPartOrders(q, page)
      : kind === "payments" ? await listPayments(page)
      : kind === "fuel-reports" ? await listFuelReports(q, page)
      : kind === "fuel-subscriptions" ? await listFuelSubscriptions(q, page)
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
