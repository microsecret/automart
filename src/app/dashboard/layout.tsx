import type { Metadata } from "next"
import { Suspense } from "react"
import DashboardNav from "@/components/dashboard/DashboardNav"

export const metadata: Metadata = {
  title: "Личный кабинет",
  robots: { index: false, follow: false, nocache: true },
}

/**
 * Раскладка личного кабинета.
 *
 * Полоса разделов раньше вставлялась на каждой странице отдельно, и на
 * трёх из шести её просто забыли: открыв «Мои заказы», человек терял
 * навигацию по кабинету целиком — выйти можно было только через шапку
 * или кнопкой «назад».
 *
 * Здесь она одна на все страницы: забыть её больше негде.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Полоса определяет активный раздел по адресу, а для этого читает
          строку запроса — та требует границы Suspense. */}
      <Suspense fallback={null}>
        <DashboardNav />
      </Suspense>
      {children}
    </>
  )
}
