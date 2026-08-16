import type { Metadata } from "next"
import NewsListClient from "./NewsListClient"
import { getNewsPage } from "@/lib/news-feed"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Автомобильные новости России и мира",
  description: "Свежие автомобильные новости: модели, технологии, рынок, цены и транспорт. Отобранные редакцией публикации в удобном формате.",
  alternates: { canonical: "/news" },
  openGraph: {
    title: "Автомобильные новости России и мира",
    description: "Свежие новости автомобилей, транспорта и авторынка.",
    type: "website",
  },
}

export default async function NewsPage() {
  const initialPage = await getNewsPage({ page: 1, limit: 12 })
  return (
    <NewsListClient
      initialData={{
        ...initialPage,
        news: initialPage.news.map((article) => ({
          ...article,
          publishedAt: article.publishedAt.toISOString(),
        })),
      }}
    />
  )
}
