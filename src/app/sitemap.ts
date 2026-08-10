import { MetadataRoute } from "next"
import { prisma } from "@/lib/prisma"
import { newsHref } from "@/lib/news"
import { getSiteUrl } from "@/lib/site-url"

export const dynamic = "force-dynamic"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getSiteUrl()
  const now = new Date()

  // Статические страницы
  const staticPages = [
    "", "/search", "/brands", "/compare", "/news",
    "/category/cars", "/category/moto", "/category/trucks", "/category/special",
    "/category/water", "/category/air", "/category/parts", "/category/services",
    "/services", "/services/valuation", "/services/history-check", "/services/smart-matching", "/services/safe-deal", "/services/fuel-map",
    "/help/sell", "/help/safety", "/help/rules", "/help/support",
    "/parts-finder", "/auctions",
  ]

  const pages: MetadataRoute.Sitemap = [
    ...staticPages.map((path) => ({
      url: `${baseUrl}${path}`,
      lastModified: now,
      changeFrequency: path === "" ? ("always" as const) : ("daily" as const),
      priority: path === "" ? 1 : path.startsWith("/category") ? 0.9 : 0.7,
    })),
  ]

  try {
    const [news, vehicles, parts, auctions] = await Promise.all([
      prisma.news.findMany({
        select: { id: true, slug: true, publishedAt: true, updatedAt: true },
        orderBy: { publishedAt: "desc" },
        take: 10_000,
      }),
      prisma.vehicle.findMany({
        select: { id: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: 10_000,
      }),
      prisma.part.findMany({
        select: { id: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: 10_000,
      }),
      prisma.auctionListing.findMany({
        where: { status: "ACTIVE" },
        select: { id: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: 10_000,
      }),
    ])

    return [
      ...pages,
      ...news.map((article) => ({
        url: `${baseUrl}${newsHref(article)}`,
        lastModified: article.updatedAt || article.publishedAt,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
      ...vehicles.map((vehicle) => ({
        url: `${baseUrl}/listings/vehicle/${vehicle.id}`,
        lastModified: vehicle.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
      ...parts.map((part) => ({
        url: `${baseUrl}/listings/part/${part.id}`,
        lastModified: part.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.75,
      })),
      ...auctions.map((auction) => ({
        url: `${baseUrl}/auctions/${auction.id}`,
        lastModified: auction.updatedAt,
        changeFrequency: "daily" as const,
        priority: 0.85,
      })),
    ]
  } catch (error) {
    console.error("Sitemap news query failed:", error)
    return pages
  }
}
