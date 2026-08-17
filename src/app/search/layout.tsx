import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Поиск транспорта и запчастей",
  description: "Поиск объявлений LeWheel по марке, модели, цене, году, городу и характеристикам.",
  alternates: { canonical: "/search" },
  robots: { index: false, follow: true },
}

export default function SearchLayout({ children }: { children: React.ReactNode }) { return children }
