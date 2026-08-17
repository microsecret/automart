import { buildSeoMetadata } from "@/lib/seo-metadata"
export const metadata = buildSeoMetadata({ title: "Оценка стоимости автомобиля онлайн", description: "Предварительная оценка рыночной стоимости автомобиля по марке, модели, году, пробегу и состоянию.", canonical: "/services/valuation", keywords: ["оценка автомобиля", "стоимость авто", "оценить машину онлайн"] })
export default function Layout({ children }: { children: React.ReactNode }) { return children }
