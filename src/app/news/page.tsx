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
    images: [{
      url: "/images/home/automarket-hero.png",
      alt: "Автомобильные новости LeWheel",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Автомобильные новости России и мира",
    description: "Свежие новости автомобилей, транспорта и авторынка.",
    images: ["/images/home/automarket-hero.png"],
  },
}

export default async function NewsPage() {
  // Одиннадцать, а не двенадцать: главная новость занимает две колонки из
  // трёх, поэтому двенадцать карточек дают тринадцать ячеек и последний ряд
  // остаётся с дырой. Клиент запрашивает столько же — иначе до подгрузки
  // SWR показывались серверные двенадцать и ряд рвался.
  const initialPage = await getNewsPage({ page: 1, limit: 11 })

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
