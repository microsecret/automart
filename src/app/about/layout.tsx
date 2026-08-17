import { buildSeoMetadata } from "@/lib/seo-metadata"

export const metadata = buildSeoMetadata({
  title: "О LeWheel — единый авторынок и импорт автомобилей",
  description: "LeWheel объединяет объявления транспорта, запчасти, зарубежные автомобильные площадки, проверку истории и сопровождение доставки.",
  canonical: "/about",
  keywords: ["LeWheel", "авторынок", "импорт автомобилей", "маркетплейс транспорта"],
})

export default function AboutLayout({ children }: { children: React.ReactNode }) { return children }
