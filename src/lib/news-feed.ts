import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"

export const MAX_NEWS_PAGE = 10_000
export const MAX_NEWS_LIMIT = 50
export const MAX_NEWS_QUERY_LENGTH = 160
export const NEWS_SORTS = ["recent", "popular"] as const
export type NewsSort = typeof NEWS_SORTS[number]

export type NewsPageInput = {
  page: number
  limit: number
  query?: string
  sort?: NewsSort
}

/** Shared, minimal news-card query for SSR and the paginated public API. */
export async function getNewsPage({ page, limit, query, sort = "recent" }: NewsPageInput) {
  const normalizedQuery = query?.trim()
  const where: Prisma.NewsWhereInput | undefined = normalizedQuery ? {
    OR: [
      { title: { contains: normalizedQuery } },
      { content: { contains: normalizedQuery } },
      { excerpt: { contains: normalizedQuery } },
    ],
  } : undefined

  const [news, total] = await prisma.$transaction([
    prisma.news.findMany({
      where,
      orderBy: sort === "popular"
        ? [{ views: "desc" }, { publishedAt: "desc" }]
        : [{ publishedAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        slug: true,
        title: true,
        excerpt: true,
        imageUrl: true,
        sourceChannel: true,
        publishedAt: true,
        views: true,
        _count: { select: { comments: true } },
      },
    }),
    prisma.news.count({ where }),
  ])

  return {
    news,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    sort,
  }
}
