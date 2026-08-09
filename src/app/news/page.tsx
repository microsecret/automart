import type { Metadata } from "next"
import NewsListClient from "./NewsListClient"

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

export default function NewsPage() {
  return <NewsListClient />
}
