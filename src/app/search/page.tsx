"use client"
export const dynamic = "force-dynamic"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import HomePage from "@/app/page"

function SearchContent() {
  const sp = useSearchParams()
  const q = sp.get("q") || undefined
  const type = sp.get("type") || undefined
  const make = sp.get("make") || undefined
  const partType = sp.get("partType") || undefined
  const pageTitle = type === "part" ? "Запчасти" : make ? `${make} — результаты поиска` : "Результаты поиска"

  return (
    <HomePage
      initialQuery={q}
      initialType={type}
      pageTitle={pageTitle}
    />
  )
}

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchContent />
    </Suspense>
  )
}
