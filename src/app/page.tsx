import type { Metadata } from "next"
import { Suspense } from "react"
import { Container } from "@mantine/core"
import HomeCatalog from "@/components/catalog/HomeCatalog"
import ForumHighlights from "@/components/forum/ForumHighlights"
import { getCatalogFirstPage } from "@/lib/catalog-first-page"

export const metadata: Metadata = {
  alternates: { canonical: "/" },
}

/* Главная обновляется раз в минуту.

   Частота не была задана вовсе, и Next считал страницу полностью
   статической: боевой сайт отдавал `Cache-Control: s-maxage=31536000`
   и `x-nextjs-cache: HIT` — то есть копию, сохранённую на год.

   Из-за этого правки доходили до сервера, но люди продолжали видеть
   прежнюю страницу: владелец присылал снимки со старой вёрсткой уже
   после нескольких деплоев, и выглядело это так, будто правки не
   применяются.

   Шестьдесят секунд — как у ленты форума рядом: объявления добавляются
   не чаще, а робот и посетитель получают свежую разметку. Полностью
   динамической её делать не стоит: первая страница витрины ходит в
   базу, и на каждый заход это лишний запрос. */
export const revalidate = 60

/* Витрина рисуется на сервере, а не только в браузере.

   Раньше главная отдавала 208 КБ разметки, в которой не встречалось ни
   одного href="/listings/...": карточки дорисовывал SWR после загрузки, и
   поисковый робот видел пустую страницу. Первая страница объявлений
   теперь приходит готовой, а дальше витриной по-прежнему управляет
   клиент. */
export default async function RootPage() {
  const initialListings = await getCatalogFirstPage()

  return (
    <>
      <HomeCatalog initialListings={initialListings ?? undefined} />
      {/* Блок форума идёт после каталога: человек пришёл за машинами, и
          обсуждения — это то, что удерживает его, когда подходящего лота
          не нашлось. Suspense не даёт запросу к форуму задержать первый
          экран. */}
      <Container size="xl" pb="xl">
        <Suspense fallback={null}>
          <ForumHighlights />
        </Suspense>
      </Container>
    </>
  )
}
