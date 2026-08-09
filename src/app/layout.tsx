import "./globals.css"
import type { Metadata } from "next"
import { Inter, Manrope } from "next/font/google"
import { ColorSchemeScript } from "@mantine/core"
import AppProviders from "@/components/providers/AppProviders"
import AppShellLayout from "@/components/layout/AppShellLayout"

const inter = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-sans", display: "swap" })
const manrope = Manrope({ subsets: ["latin", "cyrillic"], variable: "--font-display", weight: ["500", "600", "700", "800"], display: "swap" })

export const metadata: Metadata = {
  title: { default: "Авторынок — купить и продать авто, мото, спецтехнику, запчасти", template: "%s | Авторынок" },
  description: "Маркетплейс автомобилей и спецтехники: легковые, мото, грузовики, водный транспорт, запчасти. Проверка истории, оценка стоимости, безопасная сделка.",
  openGraph: {
    title: "Авторынок — маркетплейс транспорта и запчастей",
    description: "300+ авто, 50+ запчастей, VIN-проверка, безопасные сделки. Легковые, мото, грузовики, спецтехника.",
    locale: "ru_RU",
    type: "website",
    siteName: "Авторынок",
  },
  twitter: { card: "summary_large_image", title: "Авторынок", description: "Маркетплейс транспорта и запчастей" },
  keywords: "авторынок, купить авто, продать авто, запчасти, мото, грузовики, спецтехника, vin проверка",
  robots: { index: true, follow: true },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning className={`${inter.variable} ${manrope.variable}`}>
      <head><ColorSchemeScript defaultColorScheme="light" /></head>
      <body>
        <AppProviders>
          <AppShellLayout>{children}</AppShellLayout>
        </AppProviders>
      </body>
    </html>
  )
}
