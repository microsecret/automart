import { MetadataRoute } from "next"
import { prisma } from "@/lib/prisma"
import { newsHref } from "@/lib/news"
import { getSiteUrl } from "@/lib/site-url"
import { buildPublicAuctionPolicy } from "@/lib/auction-public-catalog"
import { publicListingWhere } from "@/lib/listing-lifecycle"
import { listAuctionLandings } from "@/lib/auction-landing"
import { listNewsTags } from "@/lib/news-tags"
import { toCitySlug } from "@/lib/fuel-city-slug"
import { partCategorySlug } from "@/lib/part-category-slug"
import { CITY_COORDINATES } from "@/lib/cities"

export const dynamic = "force-dynamic"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getSiteUrl()
  const now = new Date()

  // Статические страницы
  const staticPages = [
    "", "/brands", "/compare", "/news", "/about", "/help",
    "/category/cars", "/category/moto", "/category/trucks", "/category/special",
    "/category/water", "/category/air",
    "/services", "/services/valuation", "/services/history-check", "/services/smart-matching", "/services/safe-deal", "/services/legal-documents", "/services/fuel-map",
    "/help/sell", "/help/safety", "/help/rules", "/help/support", "/legal/privacy", "/legal/terms",
    "/parts-finder", "/auctions", "/forum",
    /* Участники форума: страница отвечает на запрос «кто отвечает на
       форуме» и ведёт вглубь, к профилям и темам. Поиск по форуму и
       список отслеживаемых сюда не идут — они закрыты от индексации:
       первый плодит адреса с одинаковым содержимым, второй личный. */
    "/forum/users",
  ]

  const pages: MetadataRoute.Sitemap = [
    ...staticPages.map((path) => ({
      url: `${baseUrl}${path}`,
      lastModified: now,
      changeFrequency: path === "" ? ("always" as const) : ("daily" as const),
      priority: path === "" ? 1 : path.startsWith("/category") ? 0.9 : 0.7,
    })),
  ]

  /* Категории запчастей.

     Категории жили только в query-параметрах, и запрос «купить двигатель
     бу» вести было некуда. Страницы есть всегда — по ним ходят люди и
     внутренние ссылки, — но в карту сайта попадают лишь те, где есть хоть
     что-то в продаже.

     Причина та же, что у порога в пятнадцать заправок на городских
     страницах: четырнадцать пустых страниц, поданных поисковику как
     содержимое, он справедливо сочтёт мусорными и понизит весь сайт. Когда
     раздел наполнится, они появятся в карте сами. */
  try {
    const partCounts = await prisma.part.groupBy({
      by: ["partType"],
      _count: { _all: true },
      where: { listings: { some: { status: "ACTIVE", deletedAt: null } } },
    })
    for (const row of partCounts) {
      if (!row.partType || row._count._all < 1) continue
      const slug = partCategorySlug(row.partType)
      if (!slug) continue
      pages.push({
        url: `${baseUrl}/parts-finder/${slug}`,
        lastModified: now,
        changeFrequency: "daily" as const,
        priority: 0.8,
      })
    }
  } catch (error) {
    console.error("Sitemap: категории запчастей", error instanceof Error ? error.message : error)
  }

  /* Городские страницы карты АЗС.

     Карта жила по одному адресу на всю страну, и запрос «цены на бензин в
     Уфе» вести было некуда. Города с достаточным покрытием получают свою
     страницу — с ценами прямо в разметке, а не за скриптом.

     Порог тот же, что на самой странице: там, где заправок меньше
     пятнадцати, средняя цена по городу ничего не значит, а пустая страница
     справедливо считается мусорной. */
  try {
    const fuelCities = await prisma.fuelStationImport.groupBy({
      by: ["city"],
      _count: { _all: true },
      having: { city: { _count: { gte: 15 } } },
    })
    for (const row of fuelCities) {
      if (!row.city) continue
      const slug = toCitySlug(row.city)
      if (!slug || !CITY_COORDINATES[row.city]) continue
      pages.push({
        url: `${baseUrl}/services/fuel-map/${slug}`,
        lastModified: now,
        /* Цены меняются каждый день, и поисковику стоит заходить так же
           часто: устаревшая цена в выдаче хуже её отсутствия. */
        changeFrequency: "daily" as const,
        priority: 0.8,
      })
    }
  } catch (error) {
    console.error("Sitemap: города карты АЗС", error instanceof Error ? error.message : error)
  }

  try {
    const auctionPolicy = buildPublicAuctionPolicy(now)
    const [news, vehicleListings, partListings, auctions, forumSections, forumTopics] = await Promise.all([
      prisma.news.findMany({
        where: { publishedAt: { lte: now } },
        select: { id: true, slug: true, publishedAt: true, updatedAt: true },
        orderBy: { publishedAt: "desc" },
        take: 10_000,
      }),
      prisma.listing.findMany({
        where: { ...publicListingWhere, vehicleId: { not: null } },
        select: { vehicleId: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
        distinct: ["vehicleId"],
        take: 10_000,
      }),
      prisma.listing.findMany({
        where: { ...publicListingWhere, partId: { not: null } },
        select: { partId: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
        distinct: ["partId"],
        take: 10_000,
      }),
      prisma.auctionListing.findMany({
        where: auctionPolicy.where,
        select: { id: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: 10_000,
      }),
      prisma.forumSection.findMany({
        select: { slug: true, lastPostAt: true },
        orderBy: { position: "asc" },
      }),
      /* Темы форума — главный источник поискового трафика: человек ищет
         «стоит ли брать Haval Jolion» и попадает на площадку. */
      prisma.forumTopic.findMany({
        where: { deletedAt: null },
        select: { slug: true, section: { select: { slug: true } }, lastPostAt: true },
        orderBy: { lastPostAt: "desc" },
        take: 10_000,
      }),
    ])

    // Направления «марка + страна» и темы новостей строятся из тех же
    // данных, что и сами страницы, поэтому sitemap не может разойтись с тем,
    // что реально открывается.
    const [landings, newsTags, stores] = await Promise.all([
      listAuctionLandings().catch(() => []),
      listNewsTags().catch(() => []),
      // Витрина попадает в индекс только после проверки: черновик магазина
      // не должен появляться в поиске.
      prisma.partStore.findMany({
        where: { status: "ACTIVE" },
        select: { slug: true, updatedAt: true },
        take: 5_000,
      }).catch(() => []),
    ])

    return [
      ...pages,
      ...news.map((article) => ({
        url: `${baseUrl}${newsHref(article)}`,
        lastModified: article.updatedAt || article.publishedAt,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
      ...vehicleListings.flatMap((listing) => listing.vehicleId ? [{
        url: `${baseUrl}/listings/vehicle/${listing.vehicleId}`,
        lastModified: listing.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      }] : []),
      ...partListings.flatMap((listing) => listing.partId ? [{
        url: `${baseUrl}/listings/part/${listing.partId}`,
        lastModified: listing.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.75,
      }] : []),
      ...auctions.map((auction) => ({
        url: `${baseUrl}/auctions/${auction.id}`,
        lastModified: auction.updatedAt,
        changeFrequency: "daily" as const,
        priority: 0.85,
      })),
      // Приоритет выше карточки лота: лот исчезает вместе с продажей, а
      // направление остаётся и накапливает позиции в выдаче.
      ...landings.map((landing) => ({
        url: `${baseUrl}/auctions/iz/${landing.countrySlug}/${landing.makeSlug}`,
        lastModified: now,
        changeFrequency: "daily" as const,
        priority: 0.9,
      })),
      ...newsTags.map((tag) => ({
        url: `${baseUrl}/news/tema/${tag.slug}`,
        lastModified: now,
        changeFrequency: "daily" as const,
        priority: 0.7,
      })),
      ...stores.map((store) => ({
        url: `${baseUrl}/store/${store.slug}`,
        lastModified: store.updatedAt,
        changeFrequency: "daily" as const,
        priority: 0.8,
      })),
      ...forumSections.map((section) => ({
        url: `${baseUrl}/forum/${section.slug}`,
        lastModified: section.lastPostAt || now,
        changeFrequency: "daily" as const,
        priority: 0.8,
      })),
      ...forumTopics.map((topic) => ({
        url: `${baseUrl}/forum/${topic.section.slug}/${topic.slug}`,
        lastModified: topic.lastPostAt,
        changeFrequency: "weekly" as const,
        priority: 0.6,
      })),
    ]
  } catch (error) {
    console.error("Sitemap news query failed:", error)
    return pages
  }
}
