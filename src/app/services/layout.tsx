import { buildSeoMetadata } from "@/lib/seo-metadata"

// Без своего описания раздел отдавал общий заголовок площадки и в
// поиске был неотличим от главной.
export const metadata = buildSeoMetadata({
  title: "Сервисы для покупателей и продавцов авто",
  description: "Проверка истории автомобиля, оценка стоимости, умный подбор и сопровождение сделки — инструменты площадки в одном разделе.",
  canonical: "/services",
  keywords: ["проверка авто", "оценка стоимости автомобиля", "подбор авто"],
})

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
