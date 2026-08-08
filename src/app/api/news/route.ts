import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

/** GET /api/news — список новостей с пагинацией */
export async function GET(request: NextRequest) {
  try {
    const sp = new URL(request.url).searchParams
    const page = Math.max(1, parseInt(sp.get("page") || "1"))
    const limit = Math.min(50, parseInt(sp.get("limit") || "10"))
    const skip = (page - 1) * limit

    const [news, total] = await prisma.$transaction([
      prisma.news.findMany({
        orderBy: { publishedAt: "desc" },
        skip,
        take: limit,
        include: { _count: { select: { comments: true } } },
      }),
      prisma.news.count(),
    ])

    return NextResponse.json({
      news,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error("News fetch error:", error)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
