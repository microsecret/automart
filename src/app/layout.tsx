import "./globals.css"
import type { Metadata } from "next"
import { Inter, Manrope } from "next/font/google"
import { ColorSchemeScript } from "@mantine/core"
import AppProviders from "@/components/providers/AppProviders"
import AppShellLayout from "@/components/layout/AppShellLayout"
import { getSiteUrl } from "@/lib/site-url"

const inter = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-sans", display: "swap" })
const manrope = Manrope({ subsets: ["latin", "cyrillic"], variable: "--font-display", weight: ["500", "600", "700", "800"], display: "swap" })

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  applicationName: "LeWheel — Авторынок",
  title: { default: "Авторынок LeWheel — купить и продать транспорт, найти авто из-за рубежа", template: "%s | LeWheel" },
  description: "LeWheel — маркетплейс транспорта и импорта авто: легковые, мото, грузовики, спецтехника и запчасти. Проверка истории, расчёт доставки и безопасная сделка.",
  openGraph: {
    title: "LeWheel — маркетплейс транспорта и авто из-за рубежа",
    description: "Транспорт, запчасти, подбор лотов с зарубежных площадок, расчёт доставки и безопасные сделки.",
    locale: "ru_RU",
    type: "website",
    siteName: "LeWheel",
  },
  twitter: { card: "summary_large_image", title: "LeWheel — Авторынок", description: "Маркетплейс транспорта, запчастей и авто из-за рубежа" },
  keywords: "LeWheel, авторынок, купить авто, авто из-за рубежа, импорт авто, запчасти, мото, грузовики, спецтехника, VIN проверка",
  robots: { index: true, follow: true },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning className={`${inter.variable} ${manrope.variable}`}>
      <head>
        <ColorSchemeScript defaultColorScheme="light" />
        {/* Auction cards use Encar's public CDN directly, so start DNS/TLS
            negotiation before a visitor opens an individual photo gallery. */}
        <link rel="preconnect" href="https://ci.encar.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://ci.encar.com" />
      </head>
      <body>
        <AppProviders>
          <AppShellLayout>{children}</AppShellLayout>
        </AppProviders>
      </body>
    </html>
  )
}
