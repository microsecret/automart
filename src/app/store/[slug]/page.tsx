import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import type { Prisma } from "@prisma/client"
import { IconBuildingStore, IconClock, IconMapPin, IconSearch, IconShieldCheck } from "@tabler/icons-react"
import StructuredData from "@/components/seo/StructuredData"
import ShopBar from "@/components/catalogs/ShopBar"
import PartOfferCard from "@/components/catalogs/PartOfferCard"
import { prisma } from "@/lib/prisma"
import { plural } from "@/lib/plural"
import { parseMarketplaceImages } from "@/lib/media-url"
import { containsAnyCase } from "@/lib/search-terms"
import { PRODUCT_GROUP_BY_KEY } from "@/lib/product-groups"
import { countryLabel } from "@/lib/product-legal"
import styles from "@/components/catalogs/catalogs.module.css"

type PageProps = {
  params: Promise<{ slug: string }>
  searchParams?: Promise<{ page?: string; group?: string; q?: string; sort?: string }>
}

/* Позиций на странице витрины. Без постраничного просмотра покупатель видел
   только 60 последних: после загрузки прайса на 60 строк ручная позиция
   магазина пропадала из вида (поймано сквозным прогоном 13.10.2026). */
const STORE_PAGE_SIZE = 48

const SORTS: Readonly<Record<string, { label: string; orderBy: Prisma.PartOrderByWithRelationInput }>> = {
  new: { label: "Новые", orderBy: { createdAt: "desc" } },
  cheap: { label: "Дешевле", orderBy: { price: "asc" } },
  dear: { label: "Дороже", orderBy: { price: "desc" } },
}

/** Витрина публикуется только после проверки: черновик виден лишь владельцу. */
async function getPublicStore(slug: string) {
  return prisma.partStore.findFirst({
    where: { slug, status: "ACTIVE" },
    select: {
      id: true, name: true, slug: true, description: true, city: true, logoUrl: true,
      legalName: true, inn: true, ogrn: true, legalAddress: true, sellerType: true,
      defaultLeadTimeDaysMin: true, defaultLeadTimeDaysMax: true, defaultOriginCountry: true,
      _count: { select: { parts: true } },
    },
  })
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const store = await getPublicStore(slug)
  if (!store) return { title: "Магазин недоступен", robots: { index: false, follow: false } }
  const title = `${store.name} — автотовары${store.city ? `, ${store.city}` : ""}`
  const description = store.description?.slice(0, 155)
    || `${store.name}: ${store._count.parts} позиций в каталоге${store.city ? `, ${store.city}` : ""}. Цены, сроки поставки и наличие в карточке каждого товара.`
  return {
    title,
    description,
    alternates: { canonical: `/store/${store.slug}` },
    robots: { index: true, follow: true },
    openGraph: { type: "website", locale: "ru_RU", siteName: "LeWheel", title, description, url: `/store/${store.slug}` },
  }
}

/**
 * Витрина магазина в раскладке каталога: строка магазина, шапка продавца,
 * слева группы его товаров со счётчиками, справа поиск, сортировка и
 * карточки с корзиной. Реквизиты продавца — по закону о защите прав
 * потребителей (ст. 9): покупатель видит, у кого покупает.
 */
export default async function StorefrontPage({ params, searchParams }: PageProps) {
  const { slug } = await params
  const query = (await searchParams) ?? {}
  const store = await getPublicStore(slug)
  if (!store) notFound()

  const group = query.group && PRODUCT_GROUP_BY_KEY.has(query.group) ? query.group : null
  const search = (query.q || "").trim().slice(0, 80)
  const sort = SORTS[query.sort || ""] ? (query.sort as string) : "new"

  const where: Prisma.PartWhereInput = {
    storeId: store.id,
    ...(group ? { productGroup: group } : {}),
    ...(search ? { OR: [...containsAnyCase("name", search), { oemNumber: { contains: search.toUpperCase() } }, ...containsAnyCase("brandName", search)] as Prisma.PartWhereInput["OR"] } : {}),
  }

  const [total, groups] = await Promise.all([
    prisma.part.count({ where }),
    prisma.part.groupBy({
      by: ["productGroup"],
      where: { storeId: store.id },
      _count: { _all: true },
      orderBy: { _count: { productGroup: "desc" } },
      take: 40,
    }),
  ])
  const pageCount = Math.max(1, Math.ceil(total / STORE_PAGE_SIZE))
  const requestedPage = Number.parseInt(query.page || "1", 10)
  const currentPage = Number.isFinite(requestedPage) ? Math.min(pageCount, Math.max(1, requestedPage)) : 1

  const parts = await prisma.part.findMany({
    where,
    orderBy: [SORTS[sort].orderBy, { id: "desc" }],
    skip: (currentPage - 1) * STORE_PAGE_SIZE,
    take: STORE_PAGE_SIZE,
    select: {
      id: true, name: true, price: true, oemNumber: true, brandName: true, images: true,
      supplyMode: true, leadTimeDaysMin: true, leadTimeDaysMax: true,
    },
  })

  const href = (patch: Record<string, string | null>) => {
    const params = new URLSearchParams()
    const next = { group, q: search || null, sort: sort === "new" ? null : sort, page: null as string | null, ...patch }
    for (const [key, value] of Object.entries(next)) if (value) params.set(key, value)
    const queryString = params.toString()
    return `/store/${store.slug}${queryString ? `?${queryString}` : ""}`
  }

  const origin = countryLabel(store.defaultOriginCountry)
  const initials = store.name.replace(/[^\p{L}\d]/gu, "").slice(0, 2)
  const groupedTotal = groups.filter((row) => row.productGroup).reduce((sum, row) => sum + row._count._all, 0)
  const otherCount = store._count.parts - groupedTotal

  return (
    <main className={styles.page}>
      <ShopBar />
      <nav className={styles.crumbs} aria-label="Навигация">
        <Link href="/">Главная</Link>
        <span aria-hidden="true">›</span>
        <Link href="/parts-finder">Запчасти</Link>
        <span aria-hidden="true">›</span>
        <span aria-current="page">{store.name}</span>
      </nav>

      <header className={styles.storeHero}>
        <span className={styles.storeLogo}>
          {store.logoUrl ? <img src={store.logoUrl} alt="" /> : <span>{initials}</span>}
        </span>
        <div className={styles.storeHeroMain}>
          <h1 className={styles.titleDark}>
            {store.name} <span className={styles.titleCount}>{store._count.parts} {plural(store._count.parts, "товар", "товара", "товаров")}</span>
          </h1>
          <div className={styles.storeFacts}>
            <span className={styles.storeVerified}><IconShieldCheck size={16} /> Реквизиты проверены</span>
            {store.city && <span><IconMapPin size={16} /> {store.city}</span>}
            {store.defaultLeadTimeDaysMin && (
              <span><IconClock size={16} /> Под заказ {store.defaultLeadTimeDaysMin}–{store.defaultLeadTimeDaysMax || store.defaultLeadTimeDaysMin} дн.</span>
            )}
            {origin && <span><IconBuildingStore size={16} /> Поставки: {origin}</span>}
          </div>
          {store.description && <p className={styles.muted}>{store.description}</p>}
        </div>
        <details className={styles.storeRequisites}>
          <summary>О продавце</summary>
          <dl>
            {store.legalName && <div><dt>{store.sellerType === "SELF_EMPLOYED" ? "Самозанятый" : store.sellerType === "ENTREPRENEUR" ? "ИП" : "Организация"}</dt><dd>{store.legalName}</dd></div>}
            {store.ogrn && <div><dt>{store.ogrn.length === 15 ? "ОГРНИП" : "ОГРН"}</dt><dd>{store.ogrn}</dd></div>}
            {store.inn && <div><dt>ИНН</dt><dd>{store.inn}</dd></div>}
            {store.legalAddress && <div><dt>Адрес</dt><dd>{store.legalAddress}</dd></div>}
          </dl>
        </details>
      </header>

      <div className={styles.shopLayout}>
        <aside className={styles.sidebar} aria-label="Группы товаров магазина">
          <p className={styles.sidebarTitle}>Товары</p>
          <ul className={styles.sidebarList}>
            <li><Link href={href({ group: null })} aria-current={!group ? "true" : undefined}><span>Все товары</span><b>{store._count.parts}</b></Link></li>
            {groups.filter((row) => row.productGroup && PRODUCT_GROUP_BY_KEY.has(row.productGroup)).map((row) => (
              <li key={row.productGroup}>
                <Link href={href({ group: row.productGroup })} aria-current={group === row.productGroup ? "true" : undefined}>
                  <span>{PRODUCT_GROUP_BY_KEY.get(row.productGroup as string)?.label}</span>
                  <b>{row._count._all}</b>
                </Link>
              </li>
            ))}
            {otherCount > 0 && groups.length > 1 && <li className={styles.sidebarNote}><span>Без группы — {otherCount}</span></li>}
          </ul>
        </aside>

        <div className={styles.shopMain}>
          <div className={styles.storeToolbar}>
            <form className={styles.storeSearch} action={`/store/${store.slug}`} role="search">
              {group && <input type="hidden" name="group" value={group} />}
              <IconSearch size={18} aria-hidden="true" />
              <input name="q" defaultValue={search} placeholder="Поиск в магазине: название, артикул, бренд" aria-label="Поиск в магазине" />
            </form>
            <nav className={styles.articleSort} aria-label="Сортировка">
              {Object.entries(SORTS).map(([key, value]) => (
                <Link key={key} href={href({ sort: key === "new" ? null : key })} aria-current={sort === key ? "true" : undefined} prefetch={false}>{value.label}</Link>
              ))}
            </nav>
          </div>

          {parts.length === 0 ? (
            <section className={styles.sellerBand}>
              <div>
                <h2 className={styles.h2}>{search || group ? "Ничего не нашлось" : "Каталог магазина пока пуст"}</h2>
                <p className={styles.muted}>
                  {search || group
                    ? "Попробуйте другой запрос или посмотрите все товары магазина."
                    : "Ищете конкретную деталь — опишите её: магазины ответят ценой и сроком."}
                </p>
              </div>
              <Link href={search || group ? href({ group: null, q: null }) : "/parts-finder"} className={styles.sellerButton}>
                {search || group ? "Все товары" : "Оставить заявку"}
              </Link>
            </section>
          ) : (
            <div className={styles.offerGrid}>
              {parts.map((part) => (
                <PartOfferCard
                  key={part.id}
                  offer={{
                    id: part.id, name: part.name, price: part.price,
                    image: parseMarketplaceImages(part.images, 1)?.[0] ?? null,
                    oemNumber: part.oemNumber, brandName: part.brandName, storeName: null,
                    supplyMode: part.supplyMode, leadTimeDaysMin: part.leadTimeDaysMin, leadTimeDaysMax: part.leadTimeDaysMax,
                  }}
                />
              ))}
            </div>
          )}

          {pageCount > 1 && (
            <nav className={styles.pager} aria-label="Страницы">
              {currentPage > 1 && <Link href={href({ page: String(currentPage - 1) })}>Назад</Link>}
              <span>Страница {currentPage} из {pageCount}</span>
              {currentPage < pageCount && <Link href={href({ page: String(currentPage + 1) })}>Дальше</Link>}
            </nav>
          )}
        </div>
      </div>

      <StructuredData
        data={{
          "@context": "https://schema.org",
          "@type": "Store",
          name: store.name,
          description: store.description || undefined,
          url: `https://lewheel.ru/store/${store.slug}`,
          address: store.city ? { "@type": "PostalAddress", addressLocality: store.city } : undefined,
          makesOffer: parts.slice(0, 10).map((part) => ({
            "@type": "Offer",
            name: part.name,
            price: part.price,
            priceCurrency: "RUB",
            availability: part.supplyMode === "STOCK" ? "https://schema.org/InStock" : "https://schema.org/PreOrder",
          })),
        }}
      />
    </main>
  )
}
