import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/permissions"
import { isInternalTelegramEmail } from "@/lib/telegram"

function asPositiveInt(value: string | null, fallback: number, max: number) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback
}

// GET search users
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
    const q = (searchParams.get("q") || "").trim()
    const scope = searchParams.get("scope")

    // The admin directory intentionally lives in the same route as the
    // privacy-preserving message search, but is explicitly opt-in and guarded
    // by an administrator role. Public messaging search must never expose an
    // email address or a phone number.
    if (scope === "admin") {
      if (!isAdmin(session.user.role)) {
        return NextResponse.json({ error: "Доступ только для администраторов" }, { status: 403 })
      }

      const page = asPositiveInt(searchParams.get("page"), 1, 10_000)
      const limit = asPositiveInt(searchParams.get("limit"), 30, 100)
      const where = q ? {
        OR: [
          { name: { contains: q } },
          { email: { contains: q } },
          { phone: { contains: q } },
          { telegramUsername: { contains: q } },
        ],
      } : undefined

      const [total, users] = await Promise.all([
        prisma.user.count({ where }),
        prisma.user.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            phone: true,
            telegramUsername: true,
            telegramVerifiedAt: true,
            emailVerified: true,
            role: true,
            createdAt: true,
            _count: { select: { listings: true, messagesSent: true } },
          },
        }),
      ])

      return NextResponse.json({
        users: users.map((user) => ({
          ...user,
          email: isInternalTelegramEmail(user.email) ? null : user.email,
          registrationChannel: isInternalTelegramEmail(user.email) ? "TELEGRAM" : "WEB",
        })),
        pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
      })
    }

    if (!q) {
      return NextResponse.json(
        { users: [] },
        { status: 200 }
      )
    }

    // Messaging should be initiated from an active listing whenever possible.
    // Keep the optional directory limited to public display names: email is an
    // account credential and must not become a contact-discovery mechanism.
    const users = await prisma.user.findMany({
      where: {
        name: { contains: q.trim() },
        // Exclude current user from search results
        NOT: {
          id: session.user.id
        }
      },
      select: {
        id: true,
        name: true,
        image: true
      },
      take: 10
    })

    return NextResponse.json({ users })
  } catch (error) {
    console.error("Error searching users:", error)
    return NextResponse.json(
      { error: "Failed to search users" },
      { status: 500 }
    )
  }
}

// PATCH current user profile. The endpoint intentionally exposes only the
// display name: phone, email and Telegram identity have separate verification
// flows and must not be silently changed from the dashboard.
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const payload = await request.json().catch(() => null)
    const name = typeof payload?.name === "string" ? payload.name.trim().replace(/\s+/g, " ") : ""

    if (name.length < 2 || name.length > 60) {
      return NextResponse.json({ error: "Укажите имя от 2 до 60 символов" }, { status: 400 })
    }

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: { name },
      select: { id: true, name: true, email: true, image: true },
    })

    return NextResponse.json({ user })
  } catch (error) {
    console.error("Error updating current user:", error)
    return NextResponse.json({ error: "Не удалось обновить профиль" }, { status: 500 })
  }
}
