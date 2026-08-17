import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Избранное",
  robots: { index: false, follow: false, nocache: true },
}

export default function FavoritesLayout({ children }: { children: React.ReactNode }) {
  return children
}
