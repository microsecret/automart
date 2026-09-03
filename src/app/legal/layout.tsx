import { buildSeoMetadata } from "@/lib/seo-metadata"

/* Правовые страницы стояли в карте сайта, но приходили к поисковику без
   заголовка, описания и канонической ссылки. Их читают редко, но
   отсутствие таких страниц в выдаче поисковик считает признаком
   ненадёжной площадки. */
export const metadata = buildSeoMetadata({
  title: "Правовые документы",
  description: "Условия использования площадки и политика обработки персональных данных LeWheel.",
  canonical: "/legal",
})

export default function Layout({ children }: { children: React.ReactNode }) { return children }
