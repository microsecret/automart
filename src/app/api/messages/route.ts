import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "../auth/[...nextauth]/route"
import { prisma } from "@/lib/prisma"
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
          OR: [
            { senderId: session.user.id },
            { receiverId: session.user.id }
          ],
          AND: [
            {
              OR: [
                { senderId: session.user.id, receiverNotId: session.user.id },
                { receiverId: session.user.id, senderNotId: session.user.id }
              ]
            },
            {
              isRead: false
            }
          ]
        }
      })

      return NextResponse.json({ count: unreadCount })
    }

    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "20")
    const skip = (page - 1) * limit

    // Get conversations where the current user is either sender or receiver
    // Now we can efficiently query by conversationId
    const conversations = await prisma.message.groupBy({
      by: ['conversationId'],
      where: {
        OR: [
          { senderId: session.user.id },
          { receiverId: session.user.id }
        ]
      },
      _count: {
        id: true
      },
      _max: {
        createdAt: true
      },
      orderBy: {
        _max: { createdAt: 'desc' }
      },
      skip,
      take: limit
    })

    // Get detailed information for each conversation
    const conversationDetails = await Promise.all(
      conversations.map(async (conv) => {
        // Get the latest message in this conversation
        const latestMessage = await prisma.message.findFirst({
          where: {
            conversationId: conv.conversationId
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
                title: true,
                vehicle: true,
                part: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        })

        // Count unread messages in this conversation for the current user
        const unreadCount = await prisma.message.count({
          where: {
            conversationId: conv.conversationId,
            OR: [
              {
                senderId: {
                  not: session.user.id
                },
                receiverId: session.user.id,
                isRead: false
              }
            ]
          }
        })

        // Determine the other user in the conversation
        const otherUserId = latestMessage?.senderId === session.user.id
          ? latestMessage?.receiverId
          : latestMessage?.senderId

        // Get other user info
        const otherUser = await prisma.user.findUnique({
          where: { id: otherUserId ?? '' },
          select: {
            id: true,
            name: true,
            image: true
          }
        })

        return {
          id: conv.conversationId,
          otherUser: otherUser ?? {
            id: otherUserId ?? '',
            name: 'Unknown User',
            image: null
          },
          listing: latestMessage?.listing ? {
            id: latestMessage.listing.id,
            title: latestMessage.listing.title,
            vehicle: latestMessage.listing.vehicle ? {
              year: latestMessage.listing.vehicle.year,
              make: latestMessage.listing.vehicle.make,
              model: latestMessage.listing.vehicle.model
            } : null,
            part: latestMessage.listing.part ? {
              name: latestMessage.listing.part.name,
              make: latestMessage.listing.part.make,
              model: latestMessage.listing.part.model
            } : null
          } : null,
          lastMessage: latestMessage ? {
            id: latestMessage.id,
            content: latestMessage.content,
            isRead: latestMessage.isRead,
            createdAt: latestMessage.createdAt,
            senderId: latestMessage.senderId
          } : null,
          unreadCount: unreadCount
        }
      })
    )

    // Get total count for pagination
    const total = await prisma.message.count({
      where: {
        OR: [
          { senderId: session.user.id },
          { receiverId: session.user.id }
        ]
      }
    })

    return NextResponse.json({
      conversations: conversationDetails,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
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

    const body = await request.json()
    const { content, receiverId, listingId } = body

    // Validation
    if (!content || content.trim() === "") {
      return NextResponse.json(
        { error: "Message content is required" },
        { status: 400 }
      )
    }

    if (!receiverId) {
      return NextResponse.json(
        { error: "Receiver ID is required" },
        { status: 400 }
      )
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

    // Verify listing exists if provided
    if (listingId) {
      const listing = await prisma.listing.findUnique({
        where: { id: listingId },
        select: { id: true }
      })

      if (!listing) {
        return NextResponse.json(
          { error: "Listing not found" },
          { status: 404 }
        )
      }
    }

    // Generate conversation ID
    // Format: "{userId1}-{userId2}-{listingId}" or "{userId1}-{userId2}-no-listing"
    // where userId1 < userId2 alphabetically
    const userIds = [session.user.id, receiverId].sort()
    const conversationId = `${userIds[0]}-${userIds[1]}-${listingId || 'no-listing'}`

    // Create the message
    const message = await prisma.message.create({
      data: {
        content: content.trim(),
        senderId: session.user.id,
        receiverId: receiverId,
        listingId: listingId || null,
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