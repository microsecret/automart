export const dynamic = "force-dynamic"

import HomePage from "@/components/catalog/HomeCatalog"
import { TRANSPORT_CATEGORIES } from "@/lib/catalog"

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

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams])
  const category = TRANSPORT_CATEGORIES.find((c) => c.slug === slug)
  const make = typeof query.make === "string" ? query.make : undefined

  if (slug === "parts") {
    return <HomePage key={`parts-${make || ""}`} initialQuery={make} initialType="part" pageTitle="Запчасти" categorySlug="parts" />
  }

  const vehicleType = SLUG_TO_VEHICLE_TYPE[slug] || "CAR"

  return (
    <HomePage
      key={`${slug}-${make || ""}`}
      initialQuery={make}
      initialType="vehicle"
      initialVehicleType={vehicleType}
      pageTitle={category?.label}
      categorySlug={slug}
    />
  )
}
