import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Личный кабинет",
  robots: { index: false, follow: false, nocache: true },
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children
}
