import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { brandLogoImage } from "@/lib/brand-logo-images"
import { parseMarketplaceImages } from "@/lib/media-url"
import { CATALOG_UNITS, catalogHref, catalogPartsHref, findCatalogBrand, findCatalogModel, regionOfBrand } from "@/lib/parts-catalog"
import { countBy, loadModelParts, loadOfferIndex } from "@/lib/parts-catalog-offers"
import CarSchematic from "@/components/catalogs/CarSchematic"
import ShopBar from "@/components/catalogs/ShopBar"
import PartOfferCard from "@/components/catalogs/PartOfferCard"
import PartRequestPrompt from "@/components/parts/PartRequestPrompt"
import styles from "@/components/catalogs/catalogs.module.css"

export const revalidate = 3600

type Props = { params: Promise<{ brand: string; model: string }> }

async function resolve(params: Props["params"]) {
  const { brand: brandSlug, model: modelSlug } = await params
  const brand = findCatalogBrand(brandSlug)
  const model = brand ? findCatalogModel(brand, modelSlug) : null
  return brand && model ? { brand, model } : null
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const found = await resolve(params)
  if (!found) return { title: "Модель не найдена", robots: { index: false, follow: false } }
  const name = `${found.brand.name} ${found.model}`
  return {
    title: `Запчасти ${name} — каталог по узлам`,
    description: `Каталог запчастей ${name}: двигатель, подвеска, тормоза, кузов, оптика и расходники. Предложения магазинов LeWheel.`,
    alternates: { canonical: catalogHref(found.brand.name, found.model) },
  }
}

export default async function CatalogModelPage({ params }: Props) {
  const found = await resolve(params)
  if (!found) notFound()
  const { brand, model } = found
  const name = `${brand.name} ${model}`
  const region = regionOfBrand(brand)

  const [index, parts, activeStores] = await Promise.all([
    loadOfferIndex().catch(() => []),
    loadModelParts(brand.name, model).catch(() => []),
    prisma.partStore.count({ where: { status: "ACTIVE" } }).catch(() => 0),
  ])
  const rows = index.filter((row) => row.brand === brand.name && row.model.toLowerCase() === model.toLowerCase())
  const byUnit = countBy(rows, (row) => row.partType)
  const bySub = countBy(rows, (row) => (row.subcategory ? `${row.partType}|${row.subcategory}` : null))
  const total = rows.reduce((sum, row) => sum + row.count, 0)
  const logo = brandLogoImage(brand.name)

  const schematicUnits = CATALOG_UNITS
    .filter((unit) => unit.spot)
    .map((unit) => ({ partType: unit.partType, label: unit.label, count: byUnit.get(unit.partType) ?? 0, spot: unit.spot! }))

  return (
    <main className={styles.page}>
      <ShopBar />
      <nav className={styles.crumbs} aria-label="Навигация">
        <Link href="/catalogs">Каталоги</Link>
        {region && <><span aria-hidden="true">›</span><Link href={`/catalogs#${region.slug}`}>{region.label}</Link></>}
        <span aria-hidden="true">›</span>
        <Link href={catalogHref(brand.name)}>{brand.name}</Link>
        <span aria-hidden="true">›</span>
        <span aria-current="page">{model}</span>
      </nav>

      <header className={styles.brandHeader}>
        <span className={styles.brandLogoLarge}>
          {logo ? <img src={logo} alt="" width={96} height={64} /> : <span className={styles.brandInitial}>{brand.name.slice(0, 2)}</span>}
        </span>
        <div>
          <h1 className={styles.titleDark}>
            Запчасти {name}{total > 0 && <> <span className={styles.titleCount}>{total} предложений</span></>}
          </h1>
          <p className={styles.muted}>
            {total > 0 ? `Предложения магазинов по ${byUnit.size} узлам` : "Магазины ещё не загрузили детали для этой модели — узлы и подбор уже работают"}
          </p>
        </div>
        <Link href={catalogPartsHref({ make: brand.name, model })} className={styles.headerAction} prefetch={false}>
          Все запчасти {model}
        </Link>
      </header>

      <div className={styles.shopLayout}>
        {/* Дерево узлов слева — как фильтр-колонка автомагазина. */}
        <aside className={styles.sidebar} aria-label="Узлы автомобиля">
          <p className={styles.sidebarTitle}>Узлы</p>
          <ul className={styles.sidebarList}>
            {CATALOG_UNITS.map((unit) => {
              const count = byUnit.get(unit.partType) ?? 0
              return (
                <li key={unit.partType}>
                  <a href={`#unit-${unit.partType}`}>
                    <span>{unit.label}</span>
                    {count > 0 && <b>{count}</b>}
                  </a>
                </li>
              )
            })}
          </ul>
        </aside>

        <div className={styles.shopMain}>
          <section className={styles.schematicCard} aria-label="Схема узлов">
            <CarSchematic units={schematicUnits} title={name} />
          </section>

          {parts.length > 0 && (
            <section aria-labelledby="fresh-title">
              <div className={styles.sectionHead}>
                <h2 id="fresh-title" className={styles.h2}>Предложения для {model}</h2>
              </div>
              <div className={styles.offerGrid}>
                {parts.map((part) => (
                  <PartOfferCard
                    key={part.id}
                    offer={{
                      id: part.id, name: part.name, price: part.price,
                      image: parseMarketplaceImages(part.images, 1)?.[0] ?? null,
                      oemNumber: part.oemNumber, brandName: part.brandName, storeName: part.store?.name ?? null,
                      supplyMode: part.supplyMode, leadTimeDaysMin: part.leadTimeDaysMin, leadTimeDaysMax: part.leadTimeDaysMax,
                    }}
                  />
                ))}
              </div>
            </section>
          )}

          <section aria-labelledby="units-title">
            <div className={styles.sectionHead}>
              <h2 id="units-title" className={styles.h2}>Группы деталей</h2>
              <span className={styles.sectionMeta}>Цифра — предложения для {model}</span>
            </div>
            <div className={styles.unitGrid}>
              {CATALOG_UNITS.map((unit) => {
                const unitCount = byUnit.get(unit.partType) ?? 0
                return (
                  <article key={unit.partType} id={`unit-${unit.partType}`} className={styles.unitCard}>
                    <Link href={catalogPartsHref({ make: brand.name, model, partType: unit.partType })} className={styles.unitHead} prefetch={false}>
                      <span>{unit.label}</span>
                      <span className={unitCount ? styles.modelCount : styles.modelEmpty}>{unitCount || "—"}</span>
                    </Link>
                    <ul className={styles.subList}>
                      {unit.subcategories.map((sub) => {
                        const count = bySub.get(`${unit.partType}|${sub}`) ?? 0
                        return (
                          <li key={sub}>
                            <Link href={catalogPartsHref({ make: brand.name, model, partType: unit.partType, subcategory: sub })} prefetch={false}>
                              <span>{sub}</span>
                              {count > 0 && <b>{count}</b>}
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                  </article>
                )
              })}
            </div>
          </section>

          {activeStores > 0 ? (
            <PartRequestPrompt activeStores={activeStores} />
          ) : (
            <section className={styles.sellerBand}>
              <div>
                <h2 className={styles.h2}>Продаёте запчасти для {brand.name}?</h2>
                <p className={styles.muted}>Позиции из вашего прайса с маркой и моделью появятся на этой странице в нужных узлах.</p>
              </div>
              <Link href="/sell" className={styles.sellerButton}>Открыть магазин</Link>
            </section>
          )}
        </div>
      </div>
    </main>
  )
}
