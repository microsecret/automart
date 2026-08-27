import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/permissions"
import { isInternalTelegramEmail } from "@/lib/telegram"
// GET user by ID
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { id } = await params

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        image: true,
        phone: true,
        telegramUsername: true,
        telegramVerifiedAt: true,
        role: true,
        createdAt: true,
        /* Подпись на форуме: её правит владелец учётной записи в
           кабинете, и без неё поле открывалось бы пустым поверх
           сохранённого текста. */
        forumSignature: true,
      }
    })

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      )
    }

    const canSeePrivateProfile = session.user.id === id || isAdmin(session.user.role)
    if (canSeePrivateProfile) {
      const internalTelegramEmail = isInternalTelegramEmail(user.email)
      return NextResponse.json({
        user: {
          ...user,
          email: internalTelegramEmail ? null : user.email,
          registrationChannel: internalTelegramEmail ? "TELEGRAM" : "WEB",
        },
      })
    }

    const publicUser = { id: user.id, name: user.name, image: user.image }
    return NextResponse.json({ user: publicUser })
  } catch (error) {
    console.error("Error fetching user:", error)
    return NextResponse.json(
      { error: "Failed to fetch user" },
      { status: 500 }
    )
  }
}
