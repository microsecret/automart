import { buildSeoMetadata } from "@/lib/seo-metadata"
export const metadata = buildSeoMetadata({ title: "Безопасная сделка при покупке автомобиля", description: "Сопровождение покупки транспорта: проверка сторон, документы, этапы расчёта и фиксация договорённостей.", canonical: "/services/safe-deal", keywords: ["безопасная покупка авто", "сопровождение сделки", "договор купли продажи авто"] })
export default function Layout({ children }: { children: React.ReactNode }) { return children }
