import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"
// GET all notifications for the current user
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
      const unreadCount = await prisma.notification.count({
        where: {
          userId: session.user.id,
          isRead: false
        }
      })

      return NextResponse.json({ count: unreadCount })
    }

    const page = Number(searchParams.get("page") || "1")
    const limit = Number(searchParams.get("limit") || "20")
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
      return NextResponse.json({ error: "Некорректная пагинация" }, { status: 400 })
    }
    const skip = (page - 1) * limit

    // Get where clause for filtering
    const where: Prisma.NotificationWhereInput = {
      userId: session.user.id
    }

    // Filter by read status if specified
    const isReadParam = searchParams.get("isRead")
    if (isReadParam !== null) {
      if (isReadParam !== "true" && isReadParam !== "false") {
        return NextResponse.json({ error: "Параметр isRead должен быть true или false" }, { status: 400 })
      }
      where.isRead = isReadParam === "true"
    }

    // Filter by type if specified
    const type = searchParams.get("type")
    if (type) {
      if (type.length > 80) return NextResponse.json({ error: "Тип уведомления слишком длинный" }, { status: 400 })
      where.type = type
    }

    // Get notifications for the current user
    const [notifications, total] = await prisma.$transaction([
      prisma.notification.findMany({
        where,
        include: {
          user: {
            select: {
                id: true,
                name: true,
                image: true
            }
          }
        },
        skip,
        take: limit,
        orderBy: {
          createdAt: "desc"
        }
      }),
      prisma.notification.count({
        where
      })
    ])

    return NextResponse.json({
      notifications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error("Error fetching notifications:", error)
    return NextResponse.json(
      { error: "Failed to fetch notifications" },
      { status: 500 }
    )
  }
}

// PUT mark a notification as read
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const notificationId = new URL(request.url).searchParams.get("id")?.trim()
    if (!notificationId) {
      return NextResponse.json({ error: "Notification id is required" }, { status: 400 })
    }

    // Verify the notification exists and belongs to the current user
    const notification = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId: session.user.id
      },
      select: {
        id: true
      }
    })

    if (!notification) {
      return NextResponse.json(
        { error: "Notification not found" },
        { status: 404 }
      )
    }

    // Mark the notification as read
    await prisma.notification.update({
      where: { id: notificationId },
      data: {
        isRead: true
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error marking notification as read:", error)
    return NextResponse.json(
      { error: "Failed to mark notification as read" },
      { status: 500 }
    )
  }
}

// DELETE delete a notification
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const notificationId = new URL(request.url).searchParams.get("id")?.trim()
    if (!notificationId) {
      return NextResponse.json({ error: "Notification id is required" }, { status: 400 })
    }

    // Verify the notification exists and belongs to the current user
    const notification = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId: session.user.id
      },
      select: {
        id: true
      }
    })

    if (!notification) {
      return NextResponse.json(
        { error: "Notification not found" },
        { status: 404 }
      )
    }

    // Delete the notification
    await prisma.notification.delete({
      where: { id: notificationId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting notification:", error)
    return NextResponse.json(
      { error: "Failed to delete notification" },
      { status: 500 }
    )
  }
}

// POST mark all notifications as read
export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Mark all unread notifications as read for the current user
    const result = await prisma.notification.updateMany({
      where: {
        userId: session.user.id,
        isRead: false
      },
      data: {
        isRead: true
      }
    })

    return NextResponse.json({
      success: true,
      updatedCount: result.count
    })
  } catch (error) {
    console.error("Error marking all notifications as read:", error)
    return NextResponse.json(
      { error: "Failed to mark all notifications as read" },
      { status: 500 }
    )
  }
}
/** PATCH /api/notifications — отметить прочитанными */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const { id, all } = body

    if (all === true) {
      await prisma.notification.updateMany({
        where: { userId: session.user.id, isRead: false },
        data: { isRead: true },
      })
    } else if (typeof id === "string" && id.trim()) {
      const result = await prisma.notification.updateMany({
        where: { id: id.trim(), userId: session.user.id, isRead: false },
        data: { isRead: true },
      })
      if (result.count === 0) {
        return NextResponse.json({ error: "Notification not found" }, { status: 404 })
      }
    } else {
      return NextResponse.json({ error: "Notification id or all flag is required" }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Notifications PATCH error:", error)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
