import "./globals.css"
import type { Metadata, Viewport } from "next"
import { ColorSchemeScript } from "@mantine/core"
import AppProviders from "@/components/providers/AppProviders"
import AppShellLayout from "@/components/layout/AppShellLayout"
import StructuredData from "@/components/seo/StructuredData"
import { absoluteUrl, getSiteUrl } from "@/lib/site-url"

/**
 * Типографика: системный шрифт, без загрузки из сети.
 *
 * Раньше грузились две гарнитуры из Google Fonts — Montserrat и
 * Playfair Display. Каждая тянула файл на первом же экране: до их
 * загрузки текст либо не виден, либо переставляется, когда шрифт
 * доезжает.
 *
 * Системный стек решает это целиком: шрифт уже стоит в системе, файл
 * не грузится, перестановки нет. На Windows это Segoe UI, на Mac —
 * San Francisco, на Android — Roboto. Каждый из них нарисован под
 * свой экран и свой сглаживатель, поэтому мелкий текст в таблицах и
 * сводках читается лучше присланного из сети.
 *
 * Так же устроена площадка RawMart, чей облик взят за образец: там в
 * стилях объявлен Inter, но ни одной загрузки нет — сайт всё это
 * время рисуется системным шрифтом, и именно он даёт ту самую
 * плотность.
 *
 * Расплата честная: на разных устройствах сайт выглядит немного
 * по-разному. Для интерфейса со сводками и числами это меньшая беда,
 * чем прыгающий текст при загрузке.
 *
 * Обе переменные заданы в globals.css: --font-display и --font-sans
 * читают сотни правил, менять их поимённо не нужно.
 */

/* Вторая переменная задаётся в стилях, а не вторым вызовом шрифта.

   Раньше здесь было второе объявление того же Manrope ради имени
   `--font-sans-next`, которое читают сотни правил. Но на одинаковые
   вызовы next/font выдаёт один и тот же класс, и в разметке он оказывался
   дважды: `class="__variable_de5441 __variable_de5441"`. Сервер и браузер
   собирали эту строку по-разному, React ругался ошибкой 418 на каждой
   загрузке главной, и настоящие расхождения в этом шуме было не найти.

   Псевдоним в globals.css делает то же самое и ничего не дублирует. */

const verification: NonNullable<Metadata["verification"]> = {}
const otherVerification: Record<string, string> = {}
if (process.env.GOOGLE_SITE_VERIFICATION) verification.google = process.env.GOOGLE_SITE_VERIFICATION
if (process.env.YANDEX_SITE_VERIFICATION) verification.yandex = process.env.YANDEX_SITE_VERIFICATION
if (process.env.BING_SITE_VERIFICATION) otherVerification["msvalidate.01"] = process.env.BING_SITE_VERIFICATION
if (Object.keys(otherVerification).length > 0) verification.other = otherVerification

/**
 * Область отрисовки доходит до краёв экрана.
 *
 * Без `viewportFit: "cover"` браузер отдаёт `env(safe-area-inset-*)`
 * равным нулю — и все отступы под вырез экрана, которые расставлены по
 * проекту, не делают ничего. На айфоне это значит, что нижнее меню,
 * полоса заказа на странице лота и кнопки в нижних листах уезжают под
 * системную полосу жестов: вместо нажатия срабатывает свайп «домой».
 *
 * Правило одно на весь сайт, поэтому и живёт в корневом макете: десяток
 * аккуратно написанных `env(safe-area-inset-bottom)` в стилях начинают
 * работать разом.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

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
    <html lang="ru" suppressHydrationWarning>
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
