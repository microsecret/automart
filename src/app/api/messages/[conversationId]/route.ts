import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const CONVERSATION_PAGE_SIZE = 50
// GET messages in a conversation
export async function GET(request: NextRequest, { params }: { params: Promise<{ conversationId: string }> }) {
  try {
    const { conversationId } = await params
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Verify that the current user is part of this conversation
    // We'll check this by looking for messages in this conversation involving the user
    const hasAccess = await prisma.message.findFirst({
      where: {
        conversationId,
        OR: [
          { senderId: session.user.id },
          { receiverId: session.user.id }
        ]
      },
      select: {
        id: true
      }
    })

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Unauthorized to access this conversation" },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const requestedPage = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10) || 1)
    const limit = Math.min(100, Math.max(1, Number.parseInt(searchParams.get("limit") || String(CONVERSATION_PAGE_SIZE), 10) || CONVERSATION_PAGE_SIZE))
    const [total, conversationMeta] = await Promise.all([
      prisma.message.count({ where: { conversationId } }),
      prisma.message.findFirst({
        where: { conversationId },
        orderBy: { createdAt: "asc" },
        select: {
          senderId: true,
          receiverId: true,
          listingId: true,
          listing: {
            select: {
              id: true,
              title: true,
              vehicle: { select: { id: true } },
              part: { select: { id: true } },
            },
          },
        },
      }),
    ])
    const pages = Math.max(1, Math.ceil(total / limit))
    const page = Math.min(requestedPage, pages)
    const skip = (page - 1) * limit

    // Page one is the most recent page. We return each page in chronological
    // order so the client can prepend older pages without reordering bubbles.
    const newestFirstMessages = await prisma.message.findMany({
      where: {
        conversationId
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
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip,
      take: limit
    })
    const messages = [...newestFirstMessages].reverse()

    // Mark unread messages as read
    await prisma.message.updateMany({
      data: { isRead: true },
      where: {
        conversationId,
        senderId: {
          not: session.user.id
        },
        receiverId: session.user.id,
        isRead: false
      }
    })

    // The header must not depend on the currently requested page: a stale URL
    // still needs the participant and listing context in order to keep the
    // conversation usable.
    const otherUserId = conversationMeta?.senderId === session.user.id
      ? conversationMeta.receiverId
      : conversationMeta?.senderId
    const otherUser = otherUserId ? await prisma.user.findUnique({
      where: { id: otherUserId },
      select: { id: true, name: true, image: true },
    }) : null

    return NextResponse.json({
      messages,
      otherUser,
      listingId: conversationMeta?.listingId || null,
      listing: conversationMeta?.listing ? {
        id: conversationMeta.listing.id,
        title: conversationMeta.listing.title,
        target: conversationMeta.listing.vehicle ? "vehicle" : "part",
        targetId: conversationMeta.listing.vehicle?.id || conversationMeta.listing.part?.id || conversationMeta.listing.id,
      } : null,
      pagination: {
        page,
        limit,
        total,
        pages
      }
    })
  } catch (error) {
    console.error("Error fetching messages:", error)
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    )
  }
}

// PUT mark messages as read for the current user in this conversation
export async function PUT(request: NextRequest, { params }: { params: Promise<{ conversationId: string }> }) {
  try {
    const { conversationId } = await params
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Verify that the current user is part of this conversation
    const hasAccess = await prisma.message.findFirst({
      where: {
        conversationId,
        OR: [
          { senderId: session.user.id },
          { receiverId: session.user.id }
        ]
      },
      select: {
        id: true
      }
    })

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Unauthorized to access this conversation" },
        { status: 403 }
      )
    }

    // Mark unread messages as read
    const result = await prisma.message.updateMany({
      data: { isRead: true },
      where: {
        conversationId,
        senderId: {
          not: session.user.id
        },
        receiverId: session.user.id,
        isRead: false
      }
    })

    return NextResponse.json({
      success: true,
      updatedCount: result.count
    })
  } catch (error) {
    console.error("Error marking messages as read:", error)
    return NextResponse.json(
      { error: "Failed to mark messages as read" },
      { status: 500 }
    )
  }
}
