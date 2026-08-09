import { NextRequest, NextResponse } from "next/server"
import { timingSafeEqual } from "crypto"
import { z } from "zod"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { cleanNewsTitle, makeExcerpt, makeImportedNewsSlug, makeSeoDescription, normalizeNewsText } from "@/lib/news"
import { safeHttpsUrl } from "@/lib/media-url"

export const runtime = "nodejs"

const importPayloadSchema = z.object({
  source: z.object({
    articleId: z.union([z.string(), z.number()]).transform((value) => String(value).trim()).pipe(z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/)),
    channel: z.string().trim().min(5).max(64).transform((value) => value.replace(/^@/, "")).refine((value) => /^[a-zA-Z0-9_]+$/.test(value), "Invalid channel"),
    messageId: z.coerce.number().int().positive().optional(),
  }),
  title: z.string().trim().min(3).max(500),
  content: z.string().trim().min(20).max(50_000),
  excerpt: z.string().trim().max(500).optional(),
  imageUrl: z.string().url().max(2_000).optional(),
  sourceUrl: z.string().url().max(2_000).optional(),
  telegramUrl: z.string().url().max(2_000).optional(),
  author: z.string().trim().max(120).optional(),
  tags: z.array(z.string().trim().min(1).max(64)).max(20).optional(),
  publishedAt: z.coerce.date(),
})

function isAuthorized(request: NextRequest) {
  const configuredToken = process.env.NEWS_IMPORT_TOKEN
  const suppliedToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || ""

  if (!configuredToken || !suppliedToken) return false
  const expected = Buffer.from(configuredToken)
  const received = Buffer.from(suppliedToken)
  return expected.length === received.length && timingSafeEqual(expected, received)
}

/** POST /api/news/import — private bridge from the moderated Telegram news editor. */
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const parsed = importPayloadSchema.parse(await request.json())
    const title = cleanNewsTitle(parsed.title)
    const content = normalizeNewsText(parsed.content)

    if (title.length < 3 || content.length < 20) {
      return NextResponse.json({ error: "Invalid editorial content" }, { status: 422 })
    }

    const sourceChannel = parsed.source.channel.toLowerCase()
    const sourceKey = `telegram-editor:${sourceChannel}:${parsed.source.articleId}`
    const slug = makeImportedNewsSlug(title, parsed.source.articleId)
    const sourceUrl = safeHttpsUrl(parsed.sourceUrl)
    const imageUrl = safeHttpsUrl(parsed.imageUrl)
    const telegramUrl = safeHttpsUrl(parsed.telegramUrl)
    const excerpt = makeExcerpt(parsed.excerpt || content)
    const seoTitle = `${title} — автоновости`
    const seoDescription = makeSeoDescription(parsed.excerpt || content)

    const news = await prisma.news.upsert({
      where: { sourceKey },
      create: {
        title,
        slug,
        content,
        excerpt,
        imageUrl,
        sourceUrl,
        telegramUrl,
        sourceKey,
        sourceChannel,
        sourceMessageId: parsed.source.messageId,
        author: parsed.author || null,
        tags: parsed.tags?.length ? JSON.stringify(parsed.tags) : null,
        seoTitle,
        seoDescription,
        publishedAt: parsed.publishedAt,
      },
      update: {
        title,
        slug,
        content,
        excerpt,
        imageUrl,
        sourceUrl,
        telegramUrl,
        sourceChannel,
        sourceMessageId: parsed.source.messageId,
        author: parsed.author || null,
        tags: parsed.tags?.length ? JSON.stringify(parsed.tags) : null,
        seoTitle,
        seoDescription,
        publishedAt: parsed.publishedAt,
      },
    })

    revalidatePath("/news")
    revalidatePath(`/news/${news.slug || news.id}`)
    revalidatePath("/sitemap.xml")

    return NextResponse.json({ id: news.id, slug: news.slug, imported: true }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid payload", details: error.flatten() }, { status: 422 })
    }

    console.error("News import error:", error)
    return NextResponse.json({ error: "Import failed" }, { status: 500 })
  }
}
