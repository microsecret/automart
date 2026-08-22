import { buildSeoMetadata } from "@/lib/seo-metadata"

// Без своего описания раздел отдавал общий заголовок площадки и в
// поиске был неотличим от главной.
export const metadata = buildSeoMetadata({
  title: "Безопасность сделок с автомобилем",
  description: "Как не стать жертвой мошенников при покупке и продаже машины: проверка документов, безопасный расчёт, признаки обмана.",
  canonical: "/help/safety",
  keywords: ["безопасная сделка", "мошенники при покупке авто", "проверка документов"],
})

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
