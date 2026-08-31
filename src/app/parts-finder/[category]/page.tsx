import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { buildSeoMetadata } from "@/lib/seo-metadata"
import { PART_SUBCATEGORIES } from "@/lib/constants"
import { partCategoriesWithPages, partCategoryLabel, partTypeFromSlug } from "@/lib/part-category-slug"

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

  /* Хлебные крошки для выдачи: поисковик показывает путь под ссылкой, и
     человек видит, что попадёт в раздел запчастей, а не на случайную
     страницу. */
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Запчасти", item: "/parts-finder" },
      { "@type": "ListItem", position: 2, name: summary.label, item: `/parts-finder/${slug}` },
    ],
  }

  return (
    <main className="part-category">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />

      <nav className="part-category__crumbs" aria-label="Навигация по разделу">
        <Link href="/parts-finder">Запчасти</Link>
        <span aria-hidden="true"> / </span>
        <span>{summary.label}</span>
      </nav>

      <h1 className="part-category__title">{summary.label}: новые и б/у запчасти</h1>

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
          <ul className="part-category__list">
            {summary.subcategories.map((name) => (
              <li key={name}>
                <Link href={`/parts-finder?partType=${summary.partType}&q=${encodeURIComponent(name)}`}>
                  {name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="part-category__subtitle">Другие категории запчастей</h2>
        <ul className="part-category__list part-category__list--plain">
          {others.map((row) => (
            <li key={row.slug}>
              <Link href={`/parts-finder/${row.slug}`}>{row.label}</Link>
            </li>
          ))}
        </ul>
      </section>

      <p className="part-category__note">
        Не нашли нужную деталь? Оставьте заявку с маркой, моделью и номером —
        продавцы и разборки откликнутся сами.
      </p>
    </main>
  )
}
