import { buildSeoMetadata } from "@/lib/seo-metadata"

// Без своего описания раздел отдавал общий заголовок площадки и в
// поиске был неотличим от главной.
export const metadata = buildSeoMetadata({
  title: "Поддержка LeWheel",
  description: "Как связаться с поддержкой площадки: вопросы по объявлениям, сделкам, доставке и работе аккаунта.",
  canonical: "/help/support",
  keywords: ["поддержка", "связаться", "помощь с объявлением"],
})

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
