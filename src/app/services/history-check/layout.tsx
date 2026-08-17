import { buildSeoMetadata } from "@/lib/seo-metadata"
export const metadata = buildSeoMetadata({ title: "Проверка истории автомобиля", description: "Запросите проверку истории автомобиля: ограничения, ДТП, пробег, владельцы и регистрационные сведения.", canonical: "/services/history-check", keywords: ["проверка авто", "история автомобиля", "проверка VIN", "ДТП"] })
export default function Layout({ children }: { children: React.ReactNode }) { return children }
