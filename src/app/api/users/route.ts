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

    // Search users by name or email
    const users = await prisma.user.findMany({
      where: {
        OR: [
          {
            name: {
              contains: q
            }
          },
          {
            email: {
              contains: q
            }
          }
        ],
        // Exclude current user from search results
        NOT: {
          id: session.user.id
        }
      },
      select: {
        id: true,
        name: true,
        email: true,
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
