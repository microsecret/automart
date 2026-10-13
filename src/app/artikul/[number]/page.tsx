import type { Metadata } from "next"
import Link from "next/link"
import { cache } from "react"
import { prisma } from "@/lib/prisma"
import { loadArticleOffers, type ArticleOffer } from "@/lib/part-number-offers"
import { catalogHref, findCatalogBrandByName } from "@/lib/parts-catalog"
import { matchKnownMake } from "@/lib/listing-make"
import ShopBar from "@/components/catalogs/ShopBar"
import ArticleOfferList from "@/components/catalogs/ArticleOfferList"
import PartRequestPrompt from "@/components/parts/PartRequestPrompt"
import styles from "@/components/catalogs/catalogs.module.css"

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ number: string }>; searchParams: Promise<{ sort?: string }> }

const rub = (value: number) => `${value.toLocaleString("ru-RU")} ₽`

function offersWord(count: number) {
  const lastTwo = count % 100
  const last = count % 10
  if (lastTwo >= 11 && lastTwo <= 14) return "предложений"
  if (last === 1) return "предложение"
  if (last >= 2 && last <= 4) return "предложения"
  return "предложений"
}

function analogsWord(count: number) {
  const lastTwo = count % 100
  const last = count % 10
  if (lastTwo >= 11 && lastTwo <= 14) return "аналогов"
  if (last === 1) return "аналог"
  if (last >= 2 && last <= 4) return "аналога"
  return "аналогов"
}

/* Заголовок страницы и сама страница читают одно и то же — один запрос. */
const loadOffers = cache((raw: string) => loadArticleOffers(raw).catch(() => null))

/* Срок для сортировки: наличие — ноль дней, под заказ без срока — в конец. */
const leadDays = (offer: ArticleOffer) => offer.supplyMode !== "ORDER" ? 0 : offer.leadTimeDaysMin ?? 999

function sortOffers(offers: ArticleOffer[], sort: string) {
  return [...offers].sort((a, b) => sort === "lead"
    ? leadDays(a) - leadDays(b) || a.price - b.price
    : a.price - b.price || leadDays(a) - leadDays(b))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { number } = await params
  const raw = decodeURIComponent(number).slice(0, 64)
  const data = await loadOffers(raw)
  const count = (data?.originals.length ?? 0) + (data?.analogs.length ?? 0)
  return {
    title: `${data?.display || raw} — цены и аналоги`,
    description: count
      ? `Артикул ${data?.display}: ${count} ${offersWord(count)} магазинов, аналоги и применимость. Заказ на LeWheel.`
      : `Артикул ${raw}: поиск предложений и аналогов на LeWheel.`,
    alternates: { canonical: `/artikul/${encodeURIComponent(data?.display || raw)}` },
    /* Пустая страница номера — не ответ на запрос: не индексируем. */
    robots: count ? undefined : { index: false, follow: true },
  }
}

/**
 * Страница артикула: все предложения по одному номеру и его аналоги.
 *
 * Так устроены автомагазины-образцы: человек знает номер детали (из
 * старой коробки или каталога) и сравнивает цены и сроки у продавцов, а
 * не листает выдачу по названию.
 */
export default async function ArticlePage({ params, searchParams }: Props) {
  const { number } = await params
  const { sort = "price" } = await searchParams
  const raw = decodeURIComponent(number).slice(0, 64)
  const [data, activeStores] = await Promise.all([
    loadOffers(raw),
    prisma.partStore.count({ where: { status: "ACTIVE" } }).catch(() => 0),
  ])
  const originals = sortOffers(data?.originals ?? [], sort)
  const analogs = sortOffers(data?.analogs ?? [], sort)
  const all = [...originals, ...analogs]
  const minPrice = all.length ? Math.min(...all.map((offer) => offer.price)) : null
  const brands = Array.from(new Set(originals.map((offer) => offer.brandName).filter(Boolean))) as string[]
  const display = data?.display || raw.toUpperCase()

  return (
    <main className={styles.page}>
      <ShopBar />
      <nav className={styles.crumbs} aria-label="Навигация">
        <Link href="/">Главная</Link>
        <span aria-hidden="true">›</span>
        <Link href="/parts-finder">Запчасти</Link>
        <span aria-hidden="true">›</span>
        <span aria-current="page">Артикул {display}</span>
      </nav>

      <header className={styles.pageHead}>
        <h1 className={styles.titleDark}>
          {display}
          {all.length > 0 && <> <span className={styles.titleCount}>{all.length} {offersWord(all.length)}</span></>}
        </h1>
        <p className={styles.muted}>
          {all.length
            ? `${brands.length ? `${brands.join(", ")} · ` : ""}от ${rub(minPrice as number)}${analogs.length ? ` · ${analogs.length} ${analogsWord(analogs.length)}` : ""}`
            : "По этому номеру пока нет предложений магазинов."}
        </p>
        {data?.crossNumbers.length ? (
          <p className={styles.articleCross}>
            Заменяет: {data.crossNumbers.map((cross, index) => (
              <span key={cross}>{index ? ", " : ""}<Link href={`/artikul/${encodeURIComponent(cross)}`}>{cross}</Link></span>
            ))}
          </p>
        ) : null}
      </header>

      {all.length > 0 && (
        <nav className={styles.articleSort} aria-label="Сортировка">
          <span>Сортировать:</span>
          <Link href={`?sort=price`} aria-current={sort !== "lead" ? "true" : undefined} prefetch={false}>дешевле</Link>
          <Link href={`?sort=lead`} aria-current={sort === "lead" ? "true" : undefined} prefetch={false}>быстрее</Link>
        </nav>
      )}

      {originals.length > 0 && (
        <section aria-labelledby="originals-title">
          <div className={styles.sectionHead}>
            <h2 id="originals-title" className={styles.h2}>Предложения по номеру</h2>
            <span className={styles.sectionMeta}>{originals.length}</span>
          </div>
          <ArticleOfferList offers={originals} />
        </section>
      )}

      {analogs.length > 0 && (
        <section aria-labelledby="analogs-title">
          <div className={styles.sectionHead}>
            <h2 id="analogs-title" className={styles.h2}>Аналоги и заменители</h2>
            <span className={styles.sectionMeta}>Другие производители — проверьте применимость</span>
          </div>
          <ArticleOfferList offers={analogs} />
        </section>
      )}

      {data?.applicability.length ? (
        <section aria-labelledby="fits-title">
          <div className={styles.sectionHead}>
            <h2 id="fits-title" className={styles.h2}>Подходит к</h2>
            <span className={styles.sectionMeta}>По данным продавцов</span>
          </div>
          <div className={styles.articleFits}>
            {data.applicability.map((row) => {
              const brand = findCatalogBrandByName(matchKnownMake(row.make) ?? row.make)
              const label = `${row.make} ${row.model}${row.yearFrom ? ` ${row.yearFrom}–${row.yearTo ?? ""}` : ""}`
              return brand
                ? <Link key={label} href={catalogHref(brand.name, brand.models.find((model) => model.toLowerCase() === row.model.toLowerCase()) ?? null)} prefetch={false}>{label}</Link>
                : <span key={label}>{label}</span>
            })}
          </div>
        </section>
      ) : null}

      {all.length === 0 && (activeStores > 0 ? (
        <PartRequestPrompt activeStores={activeStores} />
      ) : (
        <section className={styles.sellerBand}>
          <div>
            <h2 className={styles.h2}>Продаёте эту деталь?</h2>
            <p className={styles.muted}>Загрузите прайс с артикулами — покупатели найдут позицию по номеру и аналогам.</p>
          </div>
          <Link href="/sell" className={styles.sellerButton}>Открыть магазин</Link>
        </section>
      ))}
    </main>
  )
}
