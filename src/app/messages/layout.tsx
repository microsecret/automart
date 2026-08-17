import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Сообщения",
  robots: { index: false, follow: false, nocache: true },
}

export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  return children
}
