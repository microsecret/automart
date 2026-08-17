import { prisma } from "@/lib/prisma"
import { slugify } from "@/lib/news"

// Новости уже размечены тегами, но страниц под них не было: тема вроде
// «авто из Китая» существовала только внутри статей и не отвечала на
// поисковый запрос. Страницы строятся из фактической разметки, поэтому новая
// тема появляется сама, как только по ней накопились публикации.

// Служебные теги стоят почти в каждой статье и не выражают тему: страница
// «авто» дублировала бы всю ленту и конкурировала бы с ней в выдаче.
const GENERIC_TAGS = new Set(["авто", "автоновости", "автомобили", "авторынок", "новинки", "автомобиль"])

// Тема с одной-двумя заметками выглядит пустой и портит поведенческие
// факторы, поэтому в индекс попадают только накопившиеся рубрики.
const MIN_ARTICLES_FOR_TAG = 4

export type NewsTag = {
  tag: string
  slug: string
  count: number
}

export function parseNewsTags(raw: string | null): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as { tags?: unknown }
    if (!Array.isArray(parsed.tags)) return []
    return parsed.tags.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0)
  } catch {
    return []
  }
}

/** Человекочитаемая подпись: «автоизКитая» → «Авто из Китая». */
export function formatTagLabel(tag: string) {
  const spaced = tag
    .replace(/([а-яё])([А-ЯЁ])/g, "$1 $2")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
  return spaced.charAt(0).toLocaleUpperCase("ru-RU") + spaced.slice(1)
}

/**
 * Собирает темы, по которым накопилось достаточно публикаций.
 *
 * Используется генерацией маршрутов, sitemap и лентой, поэтому набор страниц
 * в индексе всегда совпадает с тем, что реально открывается.
 */
export async function listNewsTags(): Promise<NewsTag[]> {
  const rows = await prisma.news.findMany({
    where: { publishedAt: { lte: new Date() } },
    select: { tags: true },
  })

  const counts = new Map<string, number>()
  for (const row of rows) {
    // Один тег в разных регистрах — одна тема, иначе страницы дробятся.
    const unique = new Set(parseNewsTags(row.tags).map((tag) => tag.trim()))
    for (const tag of unique) {
      if (GENERIC_TAGS.has(tag.toLocaleLowerCase("ru-RU"))) continue
      counts.set(tag, (counts.get(tag) || 0) + 1)
    }
  }

  const bySlug = new Map<string, NewsTag>()
  for (const [tag, count] of counts) {
    const slug = slugify(tag)
    if (!slug) continue
    const existing = bySlug.get(slug)
    // Разные написания одной темы сводятся в одну страницу, подпись берётся
    // у самого частого варианта.
    if (existing) {
      if (count > existing.count) existing.tag = tag
      existing.count += count
    } else {
      bySlug.set(slug, { tag, slug, count })
    }
  }

  return [...bySlug.values()]
    .filter((item) => item.count >= MIN_ARTICLES_FOR_TAG)
    .sort((left, right) => right.count - left.count)
}

export async function findNewsTag(slug: string) {
  const tags = await listNewsTags()
  return tags.find((item) => item.slug === slug) || null
}

/** Возвращает публикации темы. Фильтрация идёт в приложении: теги хранятся JSON-строкой. */
export async function listNewsByTag(slug: string, limit = 40) {
  const target = await findNewsTag(slug)
  if (!target) return { tag: null, articles: [] as Array<{ id: string; slug: string | null; title: string; excerpt: string | null; imageUrl: string | null; publishedAt: Date }> }

  const rows = await prisma.news.findMany({
    where: { publishedAt: { lte: new Date() } },
    select: { id: true, slug: true, title: true, excerpt: true, imageUrl: true, publishedAt: true, tags: true },
    orderBy: { publishedAt: "desc" },
    take: 600,
  })

  const articles = rows
    .filter((row) => parseNewsTags(row.tags).some((tag) => slugify(tag) === slug))
    .slice(0, limit)
    .map(({ tags: _tags, ...article }) => article)

  return { tag: target, articles }
}
