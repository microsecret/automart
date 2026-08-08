import { MetadataRoute } from "next"

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://avtorynok.ru"
  const now = new Date()

  // Статические страницы
  const staticPages = [
    "", "/search", "/brands", "/compare", "/news",
    "/category/cars", "/category/moto", "/category/trucks", "/category/special",
    "/category/water", "/category/air", "/category/parts", "/category/services",
    "/services/valuation", "/services/history-check", "/services/smart-matching", "/services/safe-deal",
    "/help/sell", "/help/safety", "/help/rules", "/help/support",
    "/auth/signin", "/auth/signup",
  ]

  return [
    ...staticPages.map((path) => ({
      url: `${baseUrl}${path}`,
      lastModified: now,
      changeFrequency: path === "" ? ("always" as const) : ("daily" as const),
      priority: path === "" ? 1 : path.startsWith("/category") ? 0.9 : 0.7,
    })),
  ]
}
