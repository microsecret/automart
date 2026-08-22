import { buildSeoMetadata } from "@/lib/seo-metadata"

// Без своего описания раздел отдавал общий заголовок площадки и в
// поиске был неотличим от главной.
export const metadata = buildSeoMetadata({
  title: "Помощь и поддержка",
  description: "Ответы по объявлениям, безопасности сделок и работе площадки. Как продать машину, что проверить перед покупкой и куда написать.",
  canonical: "/help",
  keywords: ["помощь", "поддержка", "как продать авто"],
})

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
