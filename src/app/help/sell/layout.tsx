import { buildSeoMetadata } from "@/lib/seo-metadata"

// Без своего описания страница отдавала общий заголовок площадки, и в
// поиске она была неотличима от главной.
export const metadata = buildSeoMetadata({
  title: "Как продать автомобиль: пошаговая инструкция",
  description: "Что сфотографировать, какие данные указать и как быстро отвечать покупателям, чтобы продать машину без лишних просмотров.",
  canonical: "/help/sell",
  keywords: ["как продать авто", "продать машину быстро", "объявление о продаже авто"],
})

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
