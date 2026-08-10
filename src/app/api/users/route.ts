import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
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
    const q = searchParams.get("q") || ""

    if (!q.trim()) {
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
