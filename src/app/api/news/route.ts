import { NextRequest, NextResponse } from "next/server"
import { getNewsPage, MAX_NEWS_LIMIT, MAX_NEWS_PAGE, MAX_NEWS_QUERY_LENGTH, NEWS_SORTS, type NewsSort } from "@/lib/news-feed"

export const dynamic = "force-dynamic"

function parsePaginationParam(value: string | null, fallback: number, maximum: number) {
  if (value === null) return fallback
  if (!/^\d+$/.test(value)) return null

  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= maximum ? parsed : null
}

/** GET /api/news — список новостей с пагинацией */
export async function GET(request: NextRequest) {
  try {
    const sp = new URL(request.url).searchParams
    const page = parsePaginationParam(sp.get("page"), 1, MAX_NEWS_PAGE)
    const limit = parsePaginationParam(sp.get("limit"), 10, MAX_NEWS_LIMIT)
    const q = sp.get("q")?.trim()
    const sortParam = sp.get("sort") || "recent"

    if (page === null || limit === null) {
      return NextResponse.json({ error: "Параметры page и limit должны быть положительными целыми числами в допустимом диапазоне" }, { status: 400 })
    }
    if (q && q.length > MAX_NEWS_QUERY_LENGTH) {
      return NextResponse.json({ error: `Поисковый запрос не должен превышать ${MAX_NEWS_QUERY_LENGTH} символов` }, { status: 400 })
    }
    if (!NEWS_SORTS.includes(sortParam as NewsSort)) {
      return NextResponse.json({ error: "Параметр sort должен быть recent или popular" }, { status: 400 })
    }

    return NextResponse.json(await getNewsPage({ page, limit, query: q, sort: sortParam as NewsSort }))
  } catch (error) {
    console.error("News fetch error:", error)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
