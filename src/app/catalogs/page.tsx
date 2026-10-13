import type { Metadata } from "next"
import Link from "next/link"
import { brandLogoImage } from "@/lib/brand-logo-images"
import { CATALOG_REGIONS, catalogBrandsByRegion, catalogHref } from "@/lib/parts-catalog"
import { countBy, loadOfferIndex } from "@/lib/parts-catalog-offers"
import ShopBar from "@/components/catalogs/ShopBar"
import styles from "@/components/catalogs/catalogs.module.css"

export const revalidate = 3600

export const metadata: Metadata = {
  title: "Каталоги запчастей по маркам автомобилей",
  description: "Каталоги автозапчастей для европейских, японских, корейских, китайских, американских и российских автомобилей: марка, модель, узел — и предложения магазинов LeWheel.",
  alternates: { canonical: "/catalogs" },
}

const plural = (count: number, one: string, few: string, many: string) => {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

export default async function CatalogsPage() {
  const offers = await loadOfferIndex().catch(() => [])
  const byBrand = countBy(offers, (row) => row.brand)
  const totalBrands = CATALOG_REGIONS.reduce((sum, region) => sum + catalogBrandsByRegion(region).length, 0)

  return (
    <main className={styles.page}>
      <ShopBar />

      <nav className={styles.crumbs} aria-label="Навигация">
        <Link href="/">Главная</Link>
        <span aria-hidden="true">›</span>
        <span aria-current="page">Каталоги запчастей</span>
      </nav>

      <header className={styles.pageHead}>
        <h1 className={styles.titleDark}>
          Каталоги запчастей <span className={styles.titleCount}>{totalBrands} {plural(totalBrands, "марка", "марки", "марок")}</span>
        </h1>
        <p className={styles.muted}>
          Марка → модель → узел, как в каталогах производителей. VIN в строке поиска определит марку и модельный год.
        </p>
        <nav className={styles.regionTabs} aria-label="Регионы">
          {CATALOG_REGIONS.map((region) => (
            <a key={region.slug} href={`#${region.slug}`} className={styles.regionTab}>
              {region.adjective}
              <small>{catalogBrandsByRegion(region).length}</small>
            </a>
          ))}
        </nav>
      </header>

      {CATALOG_REGIONS.map((region) => {
        const brands = catalogBrandsByRegion(region)
        if (!brands.length) return null
        return (
          <section key={region.slug} id={region.slug} className={styles.regionSection} aria-labelledby={`region-${region.slug}`}>
            <div className={styles.sectionHead}>
              <h2 id={`region-${region.slug}`} className={styles.h2}>{region.adjective} автомобили</h2>
              <span className={styles.sectionMeta}>{brands.length} {plural(brands.length, "марка", "марки", "марок")}</span>
            </div>
            <div className={styles.brandGrid}>
              {brands.map((brand) => {
                const logo = brandLogoImage(brand.name)
                const count = byBrand.get(brand.name) ?? 0
                return (
                  /* Плитка как у chinaspare: логотип в сером квадрате, название и
                     первые модели — человек узнаёт марку по своей машине. */
                  <Link key={brand.name} href={catalogHref(brand.name)} className={styles.brandTile} prefetch={false}>
                    <span className={styles.brandLogo}>
                      {logo
                        ? <img src={logo} alt="" loading="lazy" decoding="async" width={56} height={36} />
                        : <span className={styles.brandInitial}>{brand.name.replace(/[^\p{L}\d]/gu, "").slice(0, 2)}</span>}
                    </span>
                    <span className={styles.brandText}>
                      <span className={styles.brandName}>{brand.name}</span>
                      <span className={styles.brandModels}>{brand.models.slice(0, 4).join(", ")}</span>
                      <span className={styles.brandMeta}>
                        {count > 0
                          ? <b>{count} {plural(count, "предложение", "предложения", "предложений")}</b>
                          : `${brand.models.length} ${plural(brand.models.length, "модель", "модели", "моделей")}`}
                      </span>
                    </span>
                  </Link>
                )
              })}
            </div>
          </section>
        )
      })}

      <section className={styles.sellerBand}>
        <div>
          <h2 className={styles.h2}>Продаёте запчасти?</h2>
          <p className={styles.muted}>
            Загрузите прайс с маркой и моделью — позиции сами встанут в каталог нужного автомобиля и узла.
          </p>
        </div>
        <Link href="/sell" className={styles.sellerButton}>Открыть магазин</Link>
      </section>
    </main>
  )
}
