import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { brandLogoImage } from "@/lib/brand-logo-images"
import { catalogHref, findCatalogBrand, regionOfBrand } from "@/lib/parts-catalog"
import { countBy, loadModelPhotos, loadOfferIndex } from "@/lib/parts-catalog-offers"
import { auctionCardImageUrl } from "@/lib/media-url"
import { IconCar } from "@tabler/icons-react"
import { decodeVin } from "@/lib/vin-decode"
import ShopBar from "@/components/catalogs/ShopBar"
import styles from "@/components/catalogs/catalogs.module.css"

export const revalidate = 3600

type Props = { params: Promise<{ brand: string }>; searchParams: Promise<{ vin?: string; year?: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { brand: slug } = await params
  const brand = findCatalogBrand(slug)
  if (!brand) return { title: "Марка не найдена", robots: { index: false, follow: false } }
  return {
    title: `Запчасти ${brand.name} — каталог по моделям`,
    description: `Каталог запчастей ${brand.name}: ${brand.models.slice(0, 6).join(", ")} и другие модели. Узлы, предложения магазинов, подбор по VIN.`,
    alternates: { canonical: catalogHref(brand.name) },
  }
}

export default async function CatalogBrandPage({ params, searchParams }: Props) {
  const { brand: slug } = await params
  const { vin } = await searchParams
  const brand = findCatalogBrand(slug)
  if (!brand) notFound()

  const region = regionOfBrand(brand)
  const offers = (await loadOfferIndex().catch(() => [])).filter((row) => row.brand === brand.name)
  const byModel = countBy(offers, (row) => row.model.toLowerCase())
  const logo = brandLogoImage(brand.name)
  const decoded = vin ? decodeVin(vin) : null
  const total = offers.reduce((sum, row) => sum + row.count, 0)
  const photos = await loadModelPhotos(brand.name, brand.models).catch(() => new Map<string, string>())
  const modelsWord = brand.models.length % 10 === 1 && brand.models.length % 100 !== 11 ? "модель"
    : [2, 3, 4].includes(brand.models.length % 10) && ![12, 13, 14].includes(brand.models.length % 100) ? "модели" : "моделей"

  /* Модели с предложениями — первыми: человек пришёл за деталью, и
     пустые модели не должны прятать ту, где деталь уже есть. */
  const models = brand.models
    .map((model) => ({ model, count: byModel.get(model.toLowerCase()) ?? 0 }))
    .sort((a, b) => b.count - a.count)

  return (
    <main className={styles.page}>
      <ShopBar />
      <nav className={styles.crumbs} aria-label="Навигация">
        <Link href="/catalogs">Каталоги</Link>
        {region && <><span aria-hidden="true">›</span><Link href={`/catalogs#${region.slug}`}>{region.label}</Link></>}
        <span aria-hidden="true">›</span>
        <span aria-current="page">{brand.name}</span>
      </nav>

      <header className={styles.brandHeader}>
        <span className={styles.brandLogoLarge}>
          {logo ? <img src={logo} alt="" width={96} height={64} /> : <span className={styles.brandInitial}>{brand.name.slice(0, 2)}</span>}
        </span>
        <div>
          <h1 className={styles.titleDark}>
            Запчасти {brand.name} <span className={styles.titleCount}>{brand.models.length} {modelsWord}</span>
          </h1>
          <p className={styles.muted}>
            {total > 0 ? `${total} предложений магазинов` : "Предложений магазинов пока нет — выберите модель, узлы и подбор уже работают"}
          </p>
        </div>
      </header>

      {decoded?.valid && (
        <div className={styles.vinCard} role="status">
          <b>VIN {decoded.vin}</b>
          <span>
            {decoded.brand ? `Марка по коду завода: ${decoded.brand}` : "Марка по коду завода не определена"}
            {decoded.modelYear ? ` · модельный год ${decoded.modelYear}` : ""}
            {decoded.checkDigitOk === false ? " · контрольная цифра не сходится — проверьте VIN" : ""}
          </span>
          <small>Модель VIN не раскрывает без каталога производителя — выберите её ниже.</small>
        </div>
      )}

      <section aria-labelledby="models-title">
        <div className={styles.sectionHead}>
          <h2 id="models-title" className={styles.h2}>Модели</h2>
        </div>
        <div className={styles.modelGrid}>
          {models.map(({ model, count }) => (
            <Link key={model} href={catalogHref(brand.name, model)} className={styles.modelTile} prefetch={false}>
              {/* Фото — из нашего лота аукциона этой модели; нет лота —
                  нейтральный значок, а не чужая картинка. */}
              <span className={styles.modelThumb}>
                {photos.get(model)
                  ? <img src={auctionCardImageUrl(photos.get(model) as string)} alt="" loading="lazy" decoding="async" />
                  : <IconCar size={26} stroke={1.4} />}
              </span>
              <span className={styles.modelName}>{model}</span>
              <span className={count ? styles.modelCount : styles.modelEmpty}>{count ? `${count} предл.` : "узлы и заявка"}</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  )
}
