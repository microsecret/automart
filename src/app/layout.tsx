import "./globals.css"
import type { Metadata } from "next"
import { Inter, Manrope } from "next/font/google"
import { ColorSchemeScript } from "@mantine/core"
import AppProviders from "@/components/providers/AppProviders"
import AppShellLayout from "@/components/layout/AppShellLayout"

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-sans",
  display: "swap",
})

const jakarta = Manrope({
  subsets: ["latin", "cyrillic"],
  variable: "--font-display",
  weight: ["500", "600", "700", "800"],
  display: "swap",
})

export const metadata: Metadata = {
  title: {
    default: "Авторынок — купить и продать авто, мото, спецтехнику, запчасти",
    template: "%s | Авторынок",
  },
  description:
    "Маркетплейс автомобилей и спецтехники: легковые, мото, грузовики, водный транспорт, запчасти. Проверка истории, оценка стоимости, безопасная сделка.",
  keywords: ["авторынок", "купить авто", "продать машину", "запчасти", "мото", "спецтехника", "б/у автомобили"],
  openGraph: {
    title: "Авторынок — маркетплейс транспорта и запчастей",
    description: "Покупайте и продавайте автомобили, мото, спецтехнику с проверкой истории и безопасной сделкой",
    locale: "ru_RU",
    type: "website",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru" className={`${inter.variable} ${jakarta.variable}`}>
      <head>
        <ColorSchemeScript defaultColorScheme="light" />
      </head>
      <body>
        <AppProviders>
          <AppShellLayout>{children}</AppShellLayout>
        </AppProviders>
      </body>
    </html>
  )
}
