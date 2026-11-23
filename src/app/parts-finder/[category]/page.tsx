import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { absoluteUrl } from "@/lib/site-url"
import { buildSeoMetadata } from "@/lib/seo-metadata"
import { PART_SUBCATEGORIES } from "@/lib/constants"
import { partCategoriesWithPages, partCategoryLabel, partTypeFromSlug } from "@/lib/part-category-slug"
import PartCategoryArtwork from "@/components/parts/PartCategoryArtwork"
import Image from "next/image"
import { serializeJsonLd } from "@/lib/json-ld"
import { IconArrowUpRight, IconSearch } from "@tabler/icons-react"

const partArtwork: Readonly<Record<string, string>> = {
  ENGINE: "engine", BRAKES: "brakes", SUSPENSION: "suspension",
  ELECTRICAL: "electrical", LIGHTING: "lighting", TRANSMISSION: "transmission",
  WHEELS: "wheels", COOLING: "cooling", BODY: "body", EXHAUST: "exhaust",
  STEERING: "steering", INTERIOR: "interior", ACCESSORIES: "accessories",
  CONSUMABLES: "consumables", CHEMICALS: "chemicals", TOOLS: "tools",
}

const scenicParts = new Set(["engine", "brakes", "suspension", "electrical", "lighting"])
const queryPhotos: Readonly<Record<string, string>> = {
  "ГБЦ": "/images/ui/part-query-scenes-v2/cylinder-head-256.webp",
  "Поршневая группа": "/images/ui/part-query-scenes-v2/pistons-256.webp",
  "Коленвал": "/images/ui/part-query-scenes-v2/crankshaft-256.webp",
  "Турбина": "/images/ui/catalog-directions-v2/parts-384.webp",
  "Суппорты": "/images/ui/part-query-scenes-v2/brake-caliper-256.webp",
  "Рычаги подвески": "/images/ui/part-query-scenes-v2/control-arm-256.webp",
  "Генератор": "/images/ui/part-query-scenes-v2/alternator-256.webp",
  "Задний фонарь": "/images/ui/part-query-scenes-v2/rear-light-256.webp",
  "Колодки тормозные": "/images/ui/product-scenes-v2/brake-pads-384.webp",
  "Диски тормозные": "/images/ui/product-scenes-v2/brake-discs-384.webp",
  "Амортизаторы": "/images/ui/product-scenes-v2/shock-absorbers-384.webp",
  "Аккумулятор": "/images/ui/product-scenes-v2/battery-384.webp",
  "Свечи зажигания": "/images/ui/product-scenes-v2/spark-plugs-384.webp",
  "Ремень ГРМ": "/images/ui/product-scenes-v2/belts-384.webp",
  "Фильтр масляный": "/images/ui/product-scenes-v2/oil-filter-384.webp",
  "Фильтр воздушный": "/images/ui/product-scenes-v2/air-filter-384.webp",
  "Фильтр салонный": "/images/ui/product-scenes-v2/cabin-filter-384.webp",
  "Фильтр топливный": "/images/ui/product-scenes-v2/fuel-filter-384.webp",
}

/**
 * Страница категории запчастей.
 *
 * Категории жили только в query-параметрах — `/parts-finder?partType=ENGINE`,
 * а такие адреса поисковики отдельными страницами не считают. Запрос «купить
 * двигатель бу» вести было некуда: весь раздел представляла одна страница
 * поиска, не говорящая ни слова о том, что в нём можно найти.
 *
 * Страница отвечает на запрос сама, а не одной ссылкой на фильтр: список
 * подкатегорий с живыми названиями («ГБЦ», «Турбина», «Ремень ГРМ») — это
 * и содержимое для человека, и те самые слова, которые он набирает в поиске.
 *
 * Разметка без Mantine: библиотека клиентская, и страница с ней пришла бы
 * поисковику пустой — ровно то, ради чего страница и делается.
 */

/* Раз в час: каталог меняется медленно, а пересчитывать выборку на каждый
   заход поисковика незачем. */
export const revalidate = 3600

type CategorySummary = {
  partType: string
  label: string
  slug: string
  /* Сколько запчастей этой категории сейчас в продаже. Ноль — обычное
     состояние молодого раздела, и страница это честно говорит. */
  count: number
  subcategories: string[]
}

async function loadCategory(slug: string): Promise<CategorySummary | null> {
  const partType = partTypeFromSlug(slug)
  if (!partType) return null

  const label = partCategoryLabel(partType)
  if (!label) return null

  const count = await prisma.part.count({
    where: { partType, listings: { some: { status: "ACTIVE", deletedAt: null } } },
  })

  return {
    partType,
    label,
    slug,
    count,
    subcategories: PART_SUBCATEGORIES[partType] ?? [],
  }
}

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }): Promise<Metadata> {
  const { category: slug } = await params
  const summary = await loadCategory(slug)
  if (!summary) {
    return buildSeoMetadata({
      title: "Запчасти",
      description: "Поиск автозапчастей по марке, модели и категории.",
      canonical: "/parts-finder",
    })
  }

  const lower = summary.label.toLocaleLowerCase("ru-RU")
  /* Число в описании выдачи работает, только когда оно не ноль: «0
     предложений» отговаривает от перехода вернее любого текста. */
  const countHint = summary.count > 0 ? ` ${summary.count} предложений от продавцов и магазинов.` : ""

  return buildSeoMetadata({
    title: `Запчасти: ${lower} — купить новые и б/у`,
    description: `${summary.label}: новые и контрактные запчасти по марке, модели и году.${countHint} Подбор по OEM-номеру, доставка по России.`,
    canonical: `/parts-finder/${slug}`,
    keywords: [
      `${lower} купить`,
      `${lower} бу`,
      `запчасти ${lower}`,
      `контрактный ${lower}`,
      `${lower} на авто`,
    ],
  })
}

export default async function PartCategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category: slug } = await params
  const summary = await loadCategory(slug)
  if (!summary) notFound()

  const lower = summary.label.toLocaleLowerCase("ru-RU")
  const others = partCategoriesWithPages().filter((row) => row.slug !== summary.slug)
  const artworkKind = partArtwork[summary.partType]
  const scenicKind = scenicParts.has(artworkKind) ? artworkKind : null

  /* Хлебные крошки для выдачи: поисковик показывает путь под ссылкой, и
     человек видит, что попадёт в раздел запчастей, а не на случайную
     страницу. */
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      /* Адреса абсолютные: относительные Google в этой разметке
         игнорирует целиком, и крошки не показываются вовсе. */
      { "@type": "ListItem", position: 1, name: "Запчасти", item: absoluteUrl("/parts-finder") },
      { "@type": "ListItem", position: 2, name: summary.label, item: absoluteUrl(`/parts-finder/${slug}`) },
    ],
  }

  return (
    <div className="part-category">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }} />

      <nav className="part-category__crumbs" aria-label="Навигация по разделу">
        <Link href="/parts-finder">Запчасти</Link>
        <span aria-hidden="true"> / </span>
        <span>{summary.label}</span>
      </nav>

      <header data-part-scene={scenicKind || undefined} className={scenicKind ? "part-category__heading part-category__heading--scene" : artworkKind ? "part-category__heading part-category__heading--illustrated" : "part-category__heading"}>
        {scenicKind ? <picture>
          <source media="(max-width: 600px)" srcSet={`/images/ui/scenic-v1/part-${scenicKind}-960.webp`} />
          <Image src={`/images/ui/scenic-v1/part-${scenicKind}-1600.webp`} width={1600} height={534} alt="" aria-hidden="true"
            unoptimized loading="eager" fetchPriority="high" className="part-category__scene" />
        </picture> : artworkKind && <PartCategoryArtwork kind={artworkKind} />}
        <div className="part-category__hero-copy">
          <h1 className="part-category__title">{summary.label}</h1>
          <p>Новые и б/у запчасти</p>
        </div>
      </header>

      <p className="part-category__lead">
        {summary.count > 0
          ? `${summary.count} предложений в наличии. Подбор по марке, модели, году и OEM-номеру.`
          : `Раздел только наполняется. Оставьте заявку — продавцы и разборки ответят с ценой и сроком.`}
      </p>

      <p className="part-category__cta">
        <Link href={`/parts-finder?partType=${summary.partType}`}>
          Открыть поиск по категории «{lower}» →
        </Link>
      </p>

      {summary.subcategories.length > 0 && (
        <section>
          <h2 className="part-category__subtitle">Что ищут в этой категории</h2>
          {/* Подкатегории — и содержимое для человека, и те слова, которыми
              он ищет: «ГБЦ», «Турбина», «Ремень ГРМ» набирают в поиске
              чаще, чем «двигатель». */}
          <ul className="part-category__list part-category__list--queries">
            {summary.subcategories.map((name) => (
              <li key={name}>
                <Link href={`/parts-finder?partType=${summary.partType}&q=${encodeURIComponent(name)}`}>
                  <span className="part-category__nav-art" aria-hidden="true">
                    {queryPhotos[name]
                      ? <Image src={queryPhotos[name]} alt="" width={64} height={48} className="part-category__nav-photo" unoptimized loading="lazy" />
                      : <PartCategoryArtwork kind={artworkKind} compact />}
                  </span>
                  <span className="part-category__nav-copy">{name}</span>
                  <IconSearch size={17} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <nav aria-labelledby="part-category-nav">
        <h2 id="part-category-nav" className="part-category__subtitle">Другие категории запчастей</h2>
        <ul className="part-category__list part-category__list--navigation">
          {others.map((row) => {
            const labelId = `part-category-${row.slug}-label`
            const description = PART_SUBCATEGORIES[row.partType]?.slice(0, 2).join(" · ")
            const artwork = partArtwork[row.partType]
            return (
              <li key={row.slug}>
                <Link href={`/parts-finder/${row.slug}`} aria-labelledby={labelId} aria-describedby={description ? `${labelId}-description` : undefined}>
                  <span className="part-category__nav-art" aria-hidden="true">
                    {scenicParts.has(artwork)
                      ? <Image src={`/images/ui/part-query-scenes-v2/${artwork}-overview-256.webp`} alt="" width={64} height={48} className="part-category__nav-photo" unoptimized loading="lazy" />
                      : <PartCategoryArtwork kind={artwork} compact />}
                  </span>
                  <span className="part-category__nav-copy">
                    <span id={labelId}>{row.label}</span>
                    {description && <small id={`${labelId}-description`}>{description}</small>}
                  </span>
                  <IconArrowUpRight size={16} aria-hidden="true" />
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <p className="part-category__note">
        Не нашли нужную деталь? Оставьте заявку с маркой, моделью и номером —
        продавцы и разборки откликнутся сами.
      </p>
    </div>
  )
}
