import type { Metadata } from "next"
import type { CSSProperties } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { absoluteUrl } from "@/lib/site-url"
import { buildSeoMetadata } from "@/lib/seo-metadata"
import { PART_SUBCATEGORIES } from "@/lib/constants"
import { partCategoriesWithPages, partCategoryLabel, partTypeFromSlug } from "@/lib/part-category-slug"
import PartCategoryArtwork from "@/components/parts/PartCategoryArtwork"
import PartWorkshopBanner from "@/components/parts/PartWorkshopBanner"
import { partIconSource } from "@/components/parts/part-icon-source"
import Image from "next/image"
import { serializeJsonLd } from "@/lib/json-ld"

function PartNavigationIcon({ kind, label }: { kind: string; label?: string }) {
  const src = partIconSource(kind, label)
  return (
    <span className="part-category__nav-art" aria-hidden="true">
      {src
        ? <>
          <Image src={src} alt="" width={144} height={144} unoptimized loading="lazy" draggable={false} />
          <span className="part-category__nav-shine" style={{ "--part-icon-mask": `url("${src}")` } as CSSProperties} />
        </>
        : <PartCategoryArtwork kind={kind} compact />}
    </span>
  )
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
  const artworkKind = summary.partType.toLowerCase()

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

      <PartWorkshopBanner scene={artworkKind} title={summary.label}>
        <p>Новые и б/у запчасти</p>
      </PartWorkshopBanner>

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
                  <PartNavigationIcon kind={artworkKind} label={name} />
                  <span className="part-category__nav-copy">{name}</span>
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
            const artwork = row.partType.toLowerCase()
            return (
              <li key={row.slug}>
                <Link href={`/parts-finder/${row.slug}`} aria-labelledby={labelId} aria-describedby={description ? `${labelId}-description` : undefined}>
                  <PartNavigationIcon kind={artwork} />
                  <span className="part-category__nav-copy">
                    <span id={labelId}>{row.label}</span>
                    {description && <small id={`${labelId}-description`}>{description}</small>}
                  </span>
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
