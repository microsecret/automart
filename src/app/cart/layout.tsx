import type { Metadata } from "next"

/* Корзина личная: поисковику в ней нечего индексировать. */
export const metadata: Metadata = {
  title: "Корзина",
  robots: { index: false, follow: false },
}

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return children
}
