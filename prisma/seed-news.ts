import { prisma } from "../src/lib/prisma"
import { readFileSync } from "fs"

interface NewsItem {
  title: string
  content: string
  excerpt: string
  sourceUrl: string
  publishedAt: string
  imageUrl: string
}

async function main() {
  if (process.env.ALLOW_DEMO_SEED !== "true") {
    throw new Error("Destructive news seed is disabled. Set ALLOW_DEMO_SEED=true only for an isolated development database.")
  }

  console.log("Импорт авто-новостей...")

  const raw = readFileSync("./prisma/news-export.json", "utf8")
  const news: NewsItem[] = JSON.parse(raw)

  // Очищаем старые новости
  await prisma.comment.deleteMany({ where: { newsId: { not: null } } })
  await prisma.news.deleteMany({})

  let count = 0
  for (const item of news) {
    // Очищаем HTML из контента, но сохраняем переносы
    const cleanContent = item.content
      .replace(/<b>/g, "**").replace(/<\/b>/g, "**")
      .replace(/<i>/g, "*").replace(/<\/i>/g, "*")
      .replace(/<br\s*\/?>/g, "\n")
      .replace(/<p>/g, "").replace(/<\/p>/g, "\n\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .trim()

    const excerpt = item.excerpt
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .substring(0, 200) + "..."

    await prisma.news.create({
      data: {
        title: item.title.substring(0, 300),
        content: cleanContent.substring(0, 10000),
        excerpt,
        sourceUrl: item.sourceUrl,
        publishedAt: new Date(item.publishedAt),
      },
    })
    count++
  }

  console.log(`Импортировано ${count} новостей`)
  await prisma.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
