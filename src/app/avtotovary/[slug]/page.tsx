import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { DEPARTMENTS, formatAttributeValue, productGroupsOfDepartment, summarizeAttributes } from "@/lib/product-groups"
import { buyingGuide, groupBySlug, groupHref, legalNotes } from "@/lib/product-group-pages"
import { PUBLIC_PART_WHERE } from "@/lib/parts-catalog-offers"
import { parseMarketplaceImages } from "@/lib/media-url"
import { absoluteUrl } from "@/lib/site-url"
import { plural } from "@/lib/plural"
import ShopBar from "@/components/catalogs/ShopBar"
import PartOfferCard from "@/components/catalogs/PartOfferCard"
import styles from "@/components/catalogs/catalogs.module.css"

export const revalidate = 900

type Props = { params: Promise<{ slug: string }> }

async function countInGroup(key: string) {
  return prisma.part.count({ where: { AND: [PUBLIC_PART_WHERE, { productGroup: key }] } }).catch(() => 0)
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const group = groupBySlug(slug)
  if (!group) return { title: "Раздел не найден", robots: { index: false, follow: false } }
  const count = await countInGroup(group.key)
  const lower = group.label.toLocaleLowerCase("ru-RU")
  return {
    title: `${group.label} — купить в магазинах LeWheel`,
    description: count > 0
      ? `${group.label}: ${count} предложений магазинов с ценами и сроками. Фильтры по характеристикам, производителю и наличию.`
      : `${group.label}: как выбрать, какие характеристики сравнивать и что требует закон. Подписка на поступление.`,
    alternates: { canonical: groupHref(group) },
    /* Пустой раздел — не ответ на запрос «купить ${lower}»: в индекс
       страница попадает, когда в ней появляются товары. */
    robots: count > 0 ? { index: true, follow: true } : { index: false, follow: true },
  }
}

/**
 * Страница товарной группы: серверная, чтобы поисковик видел содержимое.
 * Товары магазинов, производители и популярные значения характеристик —
 * ссылками в интерактивный поиск с уже выставленными фильтрами.
 */
export default async function ProductGroupPage({ params }: Props) {
  const { slug } = await params
  const group = groupBySlug(slug)
  if (!group) notFound()

  const where = { AND: [PUBLIC_PART_WHERE, { productGroup: group.key }] }
  const summaryKeys = group.attributes.filter((def) => def.summary && def.filter).map((def) => def.key)
  const [count, parts, brands, values] = await Promise.all([
    countInGroup(group.key),
    prisma.part.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: 12,
      select: {
        id: true, name: true, price: true, oemNumber: true, brandName: true, images: true, storeId: true, location: true,
        supplyMode: true, leadTimeDaysMin: true, leadTimeDaysMax: true, productGroup: true,
        attributes: { select: { key: true, num: true, text: true } },
        store: { select: { name: true } },
      },
    }).catch(() => []),
    prisma.part.groupBy({
      by: ["brandName"],
      where: { AND: [where, { brandName: { not: null } }] },
      _count: { _all: true },
      orderBy: { _count: { brandName: "desc" } },
      take: 24,
    }).catch(() => []),
    summaryKeys.length
      ? prisma.partAttribute.groupBy({
          by: ["key", "num", "text"],
          where: { key: { in: summaryKeys }, part: where },
          _count: { _all: true },
          orderBy: { _count: { key: "desc" } },
          take: 60,
        }).catch(() => [])
      : Promise.resolve([]),
  ])

  const department = DEPARTMENTS.find((item) => item.key === group.department)
  const guide = buyingGuide(group)
  const notes = legalNotes(group)
  const finderHref = `/parts-finder?group=${group.key}`
  const siblings = productGroupsOfDepartment(group.department).filter((item) => item.key !== group.key)

  /* Популярные значения главных характеристик — готовые подборки:
     «60 Ач», «5W-40», «R16». Ведут в поиск с выставленным фильтром. */
  const popular = summaryKeys.flatMap((key) => {
    const def = group.attributes.find((item) => item.key === key)
    if (!def) return []
    return values
      .filter((row) => row.key === key)
      .slice(0, 6)
      .map((row) => ({
        label: `${def.label}: ${formatAttributeValue(def, { num: row.num, text: row.text })}`,
        href: `${finderHref}&a_${key}=${encodeURIComponent(row.num !== null ? String(row.num) : row.text ?? "")}`,
        count: row._count._all,
      }))
  })

  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Автотовары", item: absoluteUrl("/avtotovary") },
      { "@type": "ListItem", position: 2, name: group.label, item: absoluteUrl(groupHref(group)) },
    ],
  }

  return (
    <main className={styles.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }} />
      <ShopBar />
      <nav className={styles.crumbs} aria-label="Навигация">
        <Link href="/">Главная</Link>
        <span aria-hidden="true">›</span>
        <Link href="/avtotovary">Автотовары</Link>
        {department && <><span aria-hidden="true">›</span><Link href={`/avtotovary#dept-${department.key}`}>{department.label}</Link></>}
        <span aria-hidden="true">›</span>
        <span aria-current="page">{group.label}</span>
      </nav>

      <header className={styles.pageHead}>
        <h1 className={styles.titleDark}>
          {group.label}{count > 0 && <> <span className={styles.titleCount}>{count} {plural(count, "предложение", "предложения", "предложений")}</span></>}
        </h1>
        {guide && <p className={styles.muted}>{guide}</p>}
        <div className={styles.groupActions}>
          <Link href={finderHref} className={styles.headerAction} prefetch={false}>
            {count > 0 ? "Подобрать по фильтрам" : "Открыть раздел и подписаться"}
          </Link>
          {count === 0 && <Link href="/sell" className={styles.groupSecondary}>Продаёте {group.label.toLocaleLowerCase("ru-RU")}? Откройте магазин</Link>}
        </div>
      </header>

      {parts.length > 0 && (
        <section aria-labelledby="group-offers">
          <div className={styles.sectionHead}>
            <h2 id="group-offers" className={styles.h2}>Предложения магазинов</h2>
            {count > parts.length && <Link href={finderHref} className={styles.sectionMeta}>Все {count} →</Link>}
          </div>
          <div className={styles.offerGrid}>
            {parts.map((part) => (
              <PartOfferCard
                key={part.id}
                offer={{
                  id: part.id, name: part.name, price: part.price,
                  image: parseMarketplaceImages(part.images, 1)?.[0] ?? null,
                  oemNumber: part.oemNumber, brandName: part.brandName, storeName: part.store?.name ?? null, location: part.location,
                  supplyMode: part.supplyMode, leadTimeDaysMin: part.leadTimeDaysMin, leadTimeDaysMax: part.leadTimeDaysMax,
                  summary: summarizeAttributes(part.productGroup, part.attributes), canBuy: Boolean(part.storeId),
                }}
              />
            ))}
          </div>
        </section>
      )}

      {(popular.length > 0 || brands.length > 0) && (
        <section aria-labelledby="group-shortcuts">
          <div className={styles.sectionHead}>
            <h2 id="group-shortcuts" className={styles.h2}>Быстрый подбор</h2>
          </div>
          <div className={styles.articleFits}>
            {brands.map((row) => (
              <Link key={row.brandName} href={`${finderHref}&brand=${encodeURIComponent(row.brandName as string)}`} prefetch={false}>
                {row.brandName} · {row._count._all}
              </Link>
            ))}
            {popular.map((item) => <Link key={item.href} href={item.href} prefetch={false}>{item.label} · {item.count}</Link>)}
          </div>
        </section>
      )}

      {notes.length > 0 && (
        <section className={styles.sellerBand} aria-labelledby="group-legal">
          <div>
            <h2 id="group-legal" className={styles.h2}>Что важно знать</h2>
            {notes.map((note) => <p key={note} className={styles.muted}>{note}</p>)}
          </div>
        </section>
      )}

      {siblings.length > 0 && (
        <section aria-labelledby="group-siblings">
          <div className={styles.sectionHead}>
            <h2 id="group-siblings" className={styles.h2}>Ещё в разделе «{department?.label}»</h2>
          </div>
          <div className={styles.modelGrid}>
            {siblings.map((item) => (
              <Link key={item.key} href={groupHref(item)} className={styles.groupTile} prefetch={false}>
                <span className={styles.modelName}>{item.label}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  )
}
