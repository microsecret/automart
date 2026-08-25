import type { Metadata } from "next"
import Link from "next/link"
import { Badge, Container, Group, Text } from "@mantine/core"
import NewsListClient from "./NewsListClient"
import { getNewsPage } from "@/lib/news-feed"
import { formatTagLabel, listNewsTags } from "@/lib/news-tags"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Автомобильные новости России и мира",
  description: "Свежие автомобильные новости: модели, технологии, рынок, цены и транспорт. Отобранные редакцией публикации в удобном формате.",
  alternates: { canonical: "/news" },
  openGraph: {
    title: "Автомобильные новости России и мира",
    description: "Свежие новости автомобилей, транспорта и авторынка.",
    type: "website",
    images: [{
      url: "/images/home/automarket-hero.png",
      alt: "Автомобильные новости LeWheel",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Автомобильные новости России и мира",
    description: "Свежие новости автомобилей, транспорта и авторынка.",
    images: ["/images/home/automarket-hero.png"],
  },
}

export default async function NewsPage() {
  const [initialPage, tags] = await Promise.all([
    // Одиннадцать, а не двенадцать: главная новость занимает две колонки из
    // трёх, поэтому двенадцать карточек дают тринадцать ячеек и последний ряд
    // остаётся с дырой. Клиент запрашивает столько же — иначе до подгрузки
    // SWR показывались серверные двенадцать и ряд рвался.
    getNewsPage({ page: 1, limit: 11 }),
    listNewsTags().catch(() => []),
  ])

  return (
    <>
      {/* Темы дают читателю переход к подборке, а поисковой системе — путь к
          страницам, которые иначе доступны только из текста статей. */}
      {tags.length > 0 && (
        <Container size="xl" px={{ base: "sm", md: "md" }} pt="md">
          <Text size="xs" c="dimmed" mb={6}>Популярные темы</Text>
          <Group gap={6} wrap="wrap">
            {tags.slice(0, 14).map((tag) => (
              <Badge
                key={tag.slug}
                component={Link}
                href={`/news/tema/${tag.slug}`}
                size="lg"
                variant="light"
                color="indigo"
                style={{ cursor: "pointer" }}
              >
                {formatTagLabel(tag.tag)} · {tag.count}
              </Badge>
            ))}
          </Group>
        </Container>
      )}
      <NewsListClient
        initialData={{
          ...initialPage,
          news: initialPage.news.map((article) => ({
            ...article,
            publishedAt: article.publishedAt.toISOString(),
          })),
        }}
      />
    </>
  )
}
