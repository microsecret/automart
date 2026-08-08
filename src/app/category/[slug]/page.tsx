"use client"
export const dynamic = "force-dynamic"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import HomePage from "@/app/page"
import { Container, Center, Loader } from "@mantine/core"
import { TRANSPORT_CATEGORIES } from "@/lib/catalog"

function CategoryContent({ slug }: { slug: string }) {
  const sp = useSearchParams()
  const category = TRANSPORT_CATEGORIES.find((c) => c.slug === slug)
  const make = sp.get("make") || undefined

  const apiType = slug === "parts" ? "part" : "vehicle"

  return (
    <HomePage
      key={`${slug}-${make || ""}`}
      initialQuery={make}
      initialType={apiType as "vehicle" | "part"}
      pageTitle={category?.label}
      categorySlug={slug}
    />
  )
}

export default function CategoryPage({ params }: { params: { slug: string } }) {
  return (
    <Suspense fallback={<Container py={80}><Center><Loader color="indigo" /></Center></Container>}>
      <CategoryContent slug={params.slug} />
    </Suspense>
  )
}
