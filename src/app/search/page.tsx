"use client"
export const dynamic = "force-dynamic"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import HomePage from "@/app/page"

function SearchContent() {
  const sp = useSearchParams()
  // Главная уже читает фильтры через SWR; для /search мы просто рендерим главную,
  // но передаём начальный запрос через URL ?q=
  const q = sp.get("q")
  return <HomePage initialQuery={q || undefined} />
}

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchContent />
    </Suspense>
  )
}
