import { buildSeoMetadata } from "@/lib/seo-metadata"

// Без своего описания раздел отдавал общий заголовок площадки и в
// поиске был неотличим от главной.
export const metadata = buildSeoMetadata({
  title: "Правила площадки",
  description: "Что можно и что нельзя размещать, как проходит модерация объявлений и какие требования к продавцам на LeWheel.",
  canonical: "/help/rules",
  keywords: ["правила размещения объявлений", "модерация", "требования к продавцам"],
})

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
