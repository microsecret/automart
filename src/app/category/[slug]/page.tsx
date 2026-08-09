"use client"
export const dynamic = "force-dynamic"

import { Suspense } from "react"
import { useParams, useSearchParams } from "next/navigation"
import HomePage from "@/components/catalog/HomeCatalog"
import { Container, Center, Loader } from "@mantine/core"
import { TRANSPORT_CATEGORIES } from "@/lib/catalog"

const SLUG_TO_VEHICLE_TYPE: Record<string, string> = {
  cars: "CAR",
  moto: "MOTORCYCLE",
  trucks: "TRUCK",
  special: "SPECIAL",
  water: "WATER",
  air: "AIR",
}

function CategoryContent({ slug }: { slug: string }) {
  const sp = useSearchParams()
  const category = TRANSPORT_CATEGORIES.find((c) => c.slug === slug)
  const make = sp.get("make") || undefined

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

export default function CategoryPage() {
  const { slug } = useParams<{ slug: string }>()
  return (
    <Suspense fallback={<Container py={80}><Center><Loader color="indigo" /></Center></Container>}>
      <CategoryContent slug={slug} />
    </Suspense>
  )
}
