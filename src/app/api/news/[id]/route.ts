import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getClientIp, rateLimit } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

/** GET /api/news/[id] — одна новость с комментариями */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const found = await prisma.news.findFirst({
      where: { OR: [{ id }, { slug: id }] },
      select: { id: true },
    })

    if (!found) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const include = {
      comments: {
        orderBy: { createdAt: "desc" as const },
        include: { user: { select: { id: true, name: true, image: true } } },
      },
    }
    const viewCookieName = `news-view-${found.id}`
    const alreadyCounted = request.cookies.get(viewCookieName)?.value === "1"
    const uniqueView = rateLimit(`news-view:${found.id}:${getClientIp(request)}`, { windowMs: 60 * 60_000, maxRequests: 1 })
    const news = !alreadyCounted && uniqueView.success
      ? await prisma.news.update({ where: { id: found.id }, data: { views: { increment: 1 } }, include })
      : await prisma.news.findUnique({ where: { id: found.id }, include })

    if (!news) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const response = NextResponse.json(news)
    if (!alreadyCounted) response.cookies.set(viewCookieName, "1", { httpOnly: true, sameSite: "lax", maxAge: 60 * 60, path: "/" })
    return response
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}

/** POST /api/news/[id] — добавить комментарий */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json().catch(() => null)
    const content = typeof body?.content === "string" ? body.content.trim() : ""
    if (!content) return NextResponse.json({ error: "Пустой комментарий" }, { status: 400 })
    if (content.length > 2_000) return NextResponse.json({ error: "Комментарий не должен превышать 2 000 символов" }, { status: 400 })

    const news = await prisma.news.findFirst({
      where: { OR: [{ id }, { slug: id }] },
      select: { id: true },
    })

    if (!news) return NextResponse.json({ error: "Новость не найдена" }, { status: 404 })

    const comment = await prisma.comment.create({
      data: {
        content,
        userId: session.user.id,
        newsId: news.id,
      },
      include: { user: { select: { id: true, name: true, image: true } } },
    })

    return NextResponse.json(comment, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
