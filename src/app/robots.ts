import { MetadataRoute } from "next"
import { getSiteUrl } from "@/lib/site-url"

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getSiteUrl()
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      /* Личные и служебные разделы закрыты, потому что их содержимое
         зависит от того, кто смотрит, и в выдаче бесполезно.

         Формы создания и правки, сравнение и поиск по форуму добавлены
         следом: они порождают страницы-дубли на каждый набор параметров и
         съедали бюджет обхода, который нужен объявлениям и городам. */
      disallow: [
        "/api/", "/admin/", "/dashboard/", "/favorites/", "/notifications/", "/messages/", "/auth/",
        "/listings/create/", "/moderation/", "/compare", "/forum/search", "/forum/subscriptions",
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  }
}
