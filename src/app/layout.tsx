import "./globals.css"
import type { Metadata } from "next"
import { Manrope, Inter } from "next/font/google"
import { ColorSchemeScript } from "@mantine/core"
import AppProviders from "@/components/providers/AppProviders"
import AppShellLayout from "@/components/layout/AppShellLayout"
import StructuredData from "@/components/seo/StructuredData"
import { absoluteUrl, getSiteUrl } from "@/lib/site-url"

/**
 * Типографика.
 *
 * Раньше сайт жил на системном Segoe UI — отсюда казённый, «офисный» вид.
 * Manrope с плотными засечками-полуштрихами держит заголовки и цифры, Inter
 * отвечает за длинный текст. Пара характерная, но не крикливая: марка
 * автомобиля и цена должны читаться мгновенно.
 */
const display = Manrope({
  subsets: ["latin", "cyrillic"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-display-next",
  display: "swap",
})

const body = Inter({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans-next",
  display: "swap",
})

const verification: NonNullable<Metadata["verification"]> = {}
const otherVerification: Record<string, string> = {}
if (process.env.GOOGLE_SITE_VERIFICATION) verification.google = process.env.GOOGLE_SITE_VERIFICATION
if (process.env.YANDEX_SITE_VERIFICATION) verification.yandex = process.env.YANDEX_SITE_VERIFICATION
if (process.env.BING_SITE_VERIFICATION) otherVerification["msvalidate.01"] = process.env.BING_SITE_VERIFICATION
if (Object.keys(otherVerification).length > 0) verification.other = otherVerification

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  applicationName: "LeWheel — Авторынок",
  category: "automotive",
  title: { default: "Авторынок LeWheel — купить и продать транспорт, найти авто из-за рубежа", template: "%s | LeWheel" },
  description: "LeWheel — маркетплейс транспорта и импорта авто: легковые, мото, грузовики, спецтехника и запчасти. Проверка истории, расчёт доставки и безопасная сделка.",
  openGraph: {
    title: "LeWheel — маркетплейс транспорта и авто из-за рубежа",
    description: "Транспорт, запчасти, подбор лотов с зарубежных площадок, расчёт доставки и безопасные сделки.",
    locale: "ru_RU",
    type: "website",
    siteName: "LeWheel",
    url: "/",
    images: [{ url: "/images/home/automarket-hero.png", alt: "LeWheel — транспорт и авто из-за рубежа" }],
  },
  twitter: { card: "summary_large_image", title: "LeWheel — Авторынок", description: "Маркетплейс транспорта, запчастей и авто из-за рубежа", images: ["/images/home/automarket-hero.png"] },
  keywords: ["LeWheel", "авторынок", "купить авто", "продать автомобиль", "авто из-за рубежа", "авто из Кореи", "авто из Китая", "авто из Японии", "импорт авто", "автомобильные аукционы", "запчасти", "мото", "грузовики", "спецтехника", "проверка VIN"],
  robots: { index: true, follow: true },
  verification: Object.keys(verification).length > 0 ? verification : undefined,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${display.variable} ${body.variable}`} suppressHydrationWarning>
      <head>
        <ColorSchemeScript defaultColorScheme="light" />
        {/* Auction cards use Encar's public CDN directly, so start DNS/TLS
            negotiation before a visitor opens an individual photo gallery. */}
        <link rel="preconnect" href="https://ci.encar.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://ci.encar.com" />
        <link rel="preconnect" href="https://img.kcar.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://img.kcar.com" />
      </head>
      <body>
        <StructuredData data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              "@id": `${getSiteUrl()}/#organization`,
              name: "LeWheel",
              url: getSiteUrl(),
              description: "Маркетплейс транспорта, запчастей и автомобилей с зарубежных площадок.",
            },
            {
              "@type": "WebSite",
              "@id": `${getSiteUrl()}/#website`,
              url: getSiteUrl(),
              name: "LeWheel",
              inLanguage: "ru-RU",
              publisher: { "@id": `${getSiteUrl()}/#organization` },
              potentialAction: {
                "@type": "SearchAction",
                target: { "@type": "EntryPoint", urlTemplate: `${absoluteUrl("/search")}?q={search_term_string}` },
                "query-input": "required name=search_term_string",
              },
            },
          ],
        }} />
        <AppProviders>
          <AppShellLayout>{children}</AppShellLayout>
        </AppProviders>
      </body>
    </html>
  )
}
