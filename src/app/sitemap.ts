import { MetadataRoute } from "next"
import { prisma } from "@/lib/prisma"
import { newsHref } from "@/lib/news"
import { getSiteUrl } from "@/lib/site-url"
import { buildPublicAuctionPolicy } from "@/lib/auction-public-catalog"
import { publicListingWhere } from "@/lib/listing-lifecycle"

export const dynamic = "force-dynamic"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getSiteUrl()
  const now = new Date()

  // Статические страницы
  const staticPages = [
    "", "/search", "/brands", "/compare", "/news", "/about", "/help",
    "/category/cars", "/category/moto", "/category/trucks", "/category/special",
    "/category/water", "/category/air",
    "/services", "/services/valuation", "/services/history-check", "/services/smart-matching", "/services/safe-deal", "/services/legal-documents", "/services/fuel-map",
    "/help/sell", "/help/safety", "/help/rules", "/help/support", "/legal/privacy", "/legal/terms",
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
    const auctionPolicy = buildPublicAuctionPolicy(now)
    const [news, vehicleListings, partListings, auctions] = await Promise.all([
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
    ]
  } catch (error) {
    console.error("Sitemap news query failed:", error)
    return pages
  }
}
