export const dynamic = "force-dynamic"

import type { Metadata } from "next"
import { notFound } from "next/navigation"
import HomePage from "@/components/catalog/HomeCatalog"
import { TRANSPORT_CATEGORIES } from "@/lib/catalog"
import { buildSeoMetadata } from "@/lib/seo-metadata"

const SLUG_TO_VEHICLE_TYPE: Record<string, string> = {
  cars: "CAR",
  moto: "MOTORCYCLE",
  trucks: "TRUCK",
  special: "SPECIAL",
  water: "WATER",
  air: "AIR",
}

type CategoryPageProps = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ make?: string | string[] }>
}

const CATEGORY_SEO: Record<string, { title: string; description: string; keywords: string[] }> = {
  cars: { title: "Легковые автомобили — купить и продать авто", description: "Объявления легковых автомобилей с фото, характеристиками, историей и фильтрами по марке, цене, году и городу.", keywords: ["купить автомобиль", "продать авто", "легковые автомобили", "авто с пробегом"] },
  moto: { title: "Мотоциклы и мототехника", description: "Мотоциклы и мототехника: объявления владельцев, подробные характеристики, пробег, состояние и местонахождение.", keywords: ["купить мотоцикл", "мототехника", "мотоциклы с пробегом"] },
  trucks: { title: "Грузовики и коммерческий транспорт", description: "Грузовые автомобили и коммерческий транспорт с фильтрами по кузову, грузоподъёмности, пробегу и состоянию.", keywords: ["купить грузовик", "коммерческий транспорт", "грузовые автомобили"] },
  special: { title: "Спецтехника — объявления о продаже", description: "Строительная, сельскохозяйственная и коммунальная спецтехника в едином каталоге LeWheel.", keywords: ["купить спецтехнику", "строительная техника", "сельхозтехника"] },
  water: { title: "Водный транспорт — катера, лодки и яхты", description: "Катера, моторные лодки, гидроциклы и яхты: поиск по типу, году, мощности и местонахождению.", keywords: ["купить катер", "моторная лодка", "водный транспорт"] },
  air: { title: "Воздушный транспорт и авиационная техника", description: "Объявления воздушного транспорта и авиационной техники с подробными характеристиками.", keywords: ["воздушный транспорт", "авиационная техника", "купить самолёт"] },
  parts: { title: "Автозапчасти — поиск по марке и модели", description: "Новые и подержанные автозапчасти с подбором по марке, модели, OEM-номеру и категории детали.", keywords: ["автозапчасти", "купить запчасти", "запчасти по модели", "OEM"] },
}

export async function generateMetadata({ params }: Pick<CategoryPageProps, "params">): Promise<Metadata> {
  const { slug } = await params
  const seo = CATEGORY_SEO[slug]
  if (!seo) return { title: "Категория не найдена", robots: { index: false, follow: false } }
  return buildSeoMetadata({ ...seo, canonical: `/category/${slug}` })
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams])
  const category = TRANSPORT_CATEGORIES.find((c) => c.slug === slug)
  const make = typeof query.make === "string" ? query.make : undefined

  if (!CATEGORY_SEO[slug]) notFound()

  if (slug === "parts") {
    return <HomePage key={`parts-${make || ""}`} initialMake={make} initialType="part" pageTitle="Запчасти" categorySlug="parts" />
  }

  const vehicleType = SLUG_TO_VEHICLE_TYPE[slug] || "CAR"

  return (
    <HomePage
      key={`${slug}-${make || ""}`}
      initialMake={make}
      initialType="vehicle"
      initialVehicleType={vehicleType}
      pageTitle={category?.label}
      categorySlug={slug}
    />
  )
}
