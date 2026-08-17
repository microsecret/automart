import { buildSeoMetadata } from "@/lib/seo-metadata"
export const metadata = buildSeoMetadata({ title: "Карта АЗС России и построение маршрута", description: "Найдите открытые автозаправочные станции по городу, сравните доступные точки и постройте маршрут.", canonical: "/services/fuel-map", keywords: ["карта АЗС", "заправки рядом", "АЗС России", "маршрут до заправки"] })
export default function Layout({ children }: { children: React.ReactNode }) { return children }
