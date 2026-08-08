import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export const dynamic = "force-dynamic"

/** GET /api/news/[id] — одна новость с комментариями */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const news = await prisma.news.update({
      where: { id: params.id },
      data: { views: { increment: 1 } },
      include: {
        comments: {
          orderBy: { createdAt: "desc" },
          include: { user: { select: { id: true, name: true, image: true } } },
        },
      },
    })

    if (!news) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json(news)
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}

/** POST /api/news/[id] — добавить комментарий */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { content } = await request.json()
    if (!content?.trim()) return NextResponse.json({ error: "Пустой комментарий" }, { status: 400 })

    const comment = await prisma.comment.create({
      data: {
        content: content.trim(),
        userId: session.user.id,
        newsId: params.id,
      },
      include: { user: { select: { id: true, name: true, image: true } } },
    })

    return NextResponse.json(comment, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
