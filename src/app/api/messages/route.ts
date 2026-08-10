import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createConversationId, normalizeMessageContent } from "@/lib/messages"
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit"

const MESSAGE_PAGE_SIZE = 20
// GET all conversations for the current user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)

    // Handle special case for unread count only
    if (searchParams.get("unreadCountOnly") === "true") {
      const unreadCount = await prisma.message.count({
        where: {
          receiverId: session.user.id,
          senderId: { not: session.user.id },
          isRead: false,
        }
      })

      return NextResponse.json({ count: unreadCount })
    }

    const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10) || 1)
    const limit = Math.min(50, Math.max(1, Number.parseInt(searchParams.get("limit") || String(MESSAGE_PAGE_SIZE), 10) || MESSAGE_PAGE_SIZE))
    const skip = (page - 1) * limit
    const participantWhere = {
      OR: [
        { senderId: session.user.id },
        { receiverId: session.user.id },
      ],
    }

    // Get conversations where the current user is either sender or receiver
    // Now we can efficiently query by conversationId
    const [conversations, conversationCount] = await Promise.all([
      prisma.message.groupBy({
        by: ['conversationId'],
        where: participantWhere,
        _count: { id: true },
        _max: { createdAt: true },
        orderBy: { _max: { createdAt: 'desc' } },
        skip,
        take: limit,
      }),
      prisma.message.groupBy({
        by: ['conversationId'],
        where: participantWhere,
      }),
    ])

    // Fetch all details in batches instead of making three additional queries
    // per conversation. The compound index on (conversationId, createdAt)
    // keeps this predictable as the mailbox grows.
    const latestMessageFilters = conversations.flatMap((conversation) => (
      conversation._max.createdAt
        ? [{ conversationId: conversation.conversationId, createdAt: conversation._max.createdAt }]
        : []
    ))
    const conversationIds = conversations.map((conversation) => conversation.conversationId)
    const [latestCandidates, unreadGroups] = await Promise.all([
      latestMessageFilters.length > 0
        ? prisma.message.findMany({
            where: { OR: latestMessageFilters },
            orderBy: { createdAt: "desc" },
            include: {
              listing: {
                select: {
                  id: true,
                  title: true,
                  vehicle: { select: { year: true, make: true, model: true } },
                  part: { select: { name: true, make: true, model: true } },
                },
              },
            },
          })
        : Promise.resolve([]),
      conversationIds.length > 0
        ? prisma.message.groupBy({
            by: ["conversationId"],
            where: {
              conversationId: { in: conversationIds },
              senderId: { not: session.user.id },
              receiverId: session.user.id,
              isRead: false,
            },
            _count: { id: true },
          })
        : Promise.resolve([]),
    ])

    // Timestamps are expected to be unique enough for the groupBy query; the
    // map also makes a rare tie deterministic without exposing duplicate rows.
    const latestByConversation = new Map<string, typeof latestCandidates[number]>()
    for (const message of latestCandidates) {
      if (!latestByConversation.has(message.conversationId)) latestByConversation.set(message.conversationId, message)
    }
    const unreadByConversation = new Map(unreadGroups.map((group) => [group.conversationId, group._count.id]))
    const otherUserIds = [...new Set(
      [...latestByConversation.values()]
        .map((message) => message.senderId === session.user.id ? message.receiverId : message.senderId)
        .filter(Boolean),
    )]
    const otherUsers = otherUserIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: otherUserIds } },
          select: { id: true, name: true, image: true },
        })
      : []
    const otherUserById = new Map(otherUsers.map((user) => [user.id, user]))

    const conversationDetails = conversations.map((conversation) => {
      const latestMessage = latestByConversation.get(conversation.conversationId)
      const otherUserId = latestMessage?.senderId === session.user.id
        ? latestMessage.receiverId
        : latestMessage?.senderId
      const otherUser = otherUserId ? otherUserById.get(otherUserId) : null

      return {
        id: conversation.conversationId,
        otherUser: otherUser ?? {
          id: otherUserId ?? "",
          name: "Пользователь",
          image: null,
        },
        listing: latestMessage?.listing ? {
          id: latestMessage.listing.id,
          title: latestMessage.listing.title,
          vehicle: latestMessage.listing.vehicle,
          part: latestMessage.listing.part,
        } : null,
        lastMessage: latestMessage ? {
          id: latestMessage.id,
          content: latestMessage.content,
          isRead: latestMessage.isRead,
          createdAt: latestMessage.createdAt,
          senderId: latestMessage.senderId,
        } : null,
        unreadCount: unreadByConversation.get(conversation.conversationId) || 0,
      }
    })

    return NextResponse.json({
      conversations: conversationDetails,
      pagination: {
        page,
        limit,
        total: conversationCount.length,
        pages: Math.ceil(conversationCount.length / limit)
      }
    })
  } catch (error) {
    console.error("Error fetching conversations:", error)
    return NextResponse.json(
      { error: "Failed to fetch conversations" },
      { status: 500 }
    )
  }
}

// POST send a new message
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Некорректные данные сообщения" }, { status: 400 })
    }
    const { content, receiverId, listingId } = body

    const normalizedContent = normalizeMessageContent(content)
    if (!normalizedContent) return NextResponse.json({ error: "Сообщение должно содержать от 1 до 4000 символов" }, { status: 400 })

    if (typeof receiverId !== "string" || !receiverId) return NextResponse.json({ error: "Укажите получателя" }, { status: 400 })
    if (receiverId === session.user.id) return NextResponse.json({ error: "Нельзя написать самому себе" }, { status: 400 })

    const userLimit = rateLimit(`messages:user:${session.user.id}`, { windowMs: 60_000, maxRequests: 30 })
    const ipLimit = rateLimit(`messages:ip:${getClientIp(request)}`, { windowMs: 60_000, maxRequests: 60 })
    if (!userLimit.success || !ipLimit.success) {
      const limit = !userLimit.success ? userLimit : ipLimit
      return NextResponse.json({ error: "Слишком много сообщений. Подождите минуту." }, { status: 429, headers: rateLimitHeaders(limit) })
    }

    // Verify receiver exists
    const receiver = await prisma.user.findUnique({
      where: { id: receiverId },
      select: { id: true }
    })

    if (!receiver) {
      return NextResponse.json(
        { error: "Receiver not found" },
        { status: 404 }
      )
    }

    const conversationId = createConversationId(session.user.id, receiverId, typeof listingId === "string" ? listingId : null)

    // New contacts are only allowed through a public card and its real owner.
    // A buyer and seller who have already begun a dialogue can still settle
    // details after the card is archived or sold.
    let normalizedListingId: string | null = null
    if (listingId !== undefined && listingId !== null) {
      if (typeof listingId !== "string" || !listingId) return NextResponse.json({ error: "Некорректное объявление" }, { status: 400 })
      const listing = await prisma.listing.findUnique({
        where: { id: listingId },
        select: { id: true, userId: true, status: true, deletedAt: true }
      })

      const isPublicSellerContact = Boolean(listing && !listing.deletedAt && listing.status === "ACTIVE" && listing.userId === receiverId)
      if (!isPublicSellerContact) {
        const existingDialogue = await prisma.message.findFirst({
          where: {
            conversationId,
            listingId,
            OR: [
              { senderId: session.user.id, receiverId },
              { senderId: receiverId, receiverId: session.user.id },
            ],
          },
          select: { id: true },
        })
        if (!existingDialogue) return NextResponse.json({ error: "Объявление недоступно для новых сообщений" }, { status: 404 })
      }
      normalizedListingId = listingId
    }

    // Create the message
    const message = await prisma.message.create({
      data: {
        content: normalizedContent,
        senderId: session.user.id,
        receiverId: receiverId,
        listingId: normalizedListingId,
        conversationId: conversationId
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            image: true
          }
        },
        receiver: {
          select: {
            id: true,
            name: true,
            image: true
          }
        },
        listing: {
          select: {
            id: true,
            title: true
          }
        }
      }
    })

    return NextResponse.json(message, { status: 201 })
  } catch (error) {
    console.error("Error sending message:", error)
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    )
  }
}
