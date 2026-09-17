import type { Metadata } from "next"

/* Обновление задаётся здесь, а не в самой странице.

   В page.tsx стоит `export const dynamic = "force-dynamic"`, но файл
   начинается с "use client": в клиентском компоненте эта настройка не
   действует — Next читает её только в серверных. Из-за этого страница
   кэшировалась как полностью статическая, и боевой сайт отдавал
   `s-maxage=31536000`, то есть копию на год. Правки доходили до
   сервера, а люди видели прежнюю вёрстку.

   Шестьдесят секунд: выдача меняется не чаще, а посетитель и робот
   получают свежую разметку. */
export const revalidate = 60


export const metadata: Metadata = {
  title: "Поиск транспорта и запчастей",
  description: "Поиск объявлений LeWheel по марке, модели, цене, году, городу и характеристикам.",
  alternates: { canonical: "/search" },
  robots: { index: false, follow: true },
}

export default function SearchLayout({ children }: { children: React.ReactNode }) { return children }
