import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "../../auth/[...nextauth]/route"
import { prisma } from "@/lib/prisma"
// GET messages in a conversation
export async function GET(request: NextRequest, { params }: { params: { conversationId: string } }) {
  try {
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
        conversationId: params.conversationId,
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
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "50")
    const skip = (page - 1) * limit

    // Get messages in this conversation using the conversationId index
    const messages = await prisma.message.findMany({
      where: {
        conversationId: params.conversationId
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
        createdAt: 'asc'
      },
      skip,
      take: limit
    })

    // Mark unread messages as read
    await prisma.message.updateMany({
      where: {
        conversationId: params.conversationId,
        senderId: {
          not: session.user.id
        },
        receiverId: session.user.id,
        isRead: false
      }
    })

    // Get total count for pagination
    const total = await prisma.message.count({
      where: {
        conversationId: params.conversationId
      }
    })

    return NextResponse.json({
      messages,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
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
export async function PUT(request: NextRequest, { params }: { params: { conversationId: string } }) {
  try {
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
        conversationId: params.conversationId,
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
      where: {
        conversationId: params.conversationId,
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