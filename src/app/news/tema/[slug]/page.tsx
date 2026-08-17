import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Anchor, Badge, Box, Card, Container, Group, Stack, Text, Title } from "@mantine/core"
import StructuredData from "@/components/seo/StructuredData"
import { findNewsTag, formatTagLabel, listNewsByTag, listNewsTags } from "@/lib/news-tags"

type PageProps = { params: Promise<{ slug: string }> }

// Лента пополняется импортом несколько раз в сутки: почасовая пересборка
// держит подборку свежей, не перегенерируя раздел на каждую публикацию.
export const revalidate = 3600

/**
 * Маршруты берутся из фактической разметки новостей, поэтому новая тема
 * появляется сама, как только по ней накопились публикации.
 */
export async function generateStaticParams() {
  const tags = await listNewsTags()
  return tags.map((tag) => ({ slug: tag.slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const tag = await findNewsTag(slug)
  if (!tag) return { title: "Тема недоступна", robots: { index: false, follow: false } }

  const label = formatTagLabel(tag.tag)
  const title = `${label} — новости автомобильного рынка`
  const description = `${tag.count} публикаций по теме «${label}»: цены, новинки и изменения на авторынке России. Обновляется ежедневно.`
  const canonical = `/news/tema/${tag.slug}`

  return {
    title,
    description,
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: { type: "website", locale: "ru_RU", siteName: "LeWheel", title, description, url: canonical },
    twitter: { card: "summary_large_image", title, description },
  }
}

export default async function NewsTagPage({ params }: PageProps) {
  const { slug } = await params
  const { tag, articles } = await listNewsByTag(slug)
  if (!tag) notFound()

  const label = formatTagLabel(tag.tag)
  const related = (await listNewsTags()).filter((item) => item.slug !== tag.slug).slice(0, 12)

  return (
    <Container size="lg" py={{ base: "md", md: "xl" }}>
      <Stack gap="lg">
        <Box>
          <Group gap={6} mb="xs">
            <Anchor component={Link} href="/news" size="xs" c="dimmed">Новости</Anchor>
            <Text size="xs" c="dimmed">/</Text>
            <Text size="xs" c="dimmed">Темы</Text>
          </Group>
          <Title order={1} size="h2" ff="var(--font-display),sans-serif">{label}</Title>
          <Text c="dimmed" mt={6} maw={720}>
            {tag.count} публикаций по теме. Материалы обновляются по мере выхода новостей авторынка.
          </Text>
        </Box>

        <Stack gap="sm">
          {articles.map((article) => (
            <Card
              key={article.id}
              component={Link}
              href={`/news/${article.slug || article.id}`}
              withBorder
              radius="lg"
              p="md"
              className="admin-queue-card"
            >
              <Text fw={750}>{article.title}</Text>
              {article.excerpt && <Text size="sm" c="dimmed" mt={4} lineClamp={2}>{article.excerpt}</Text>}
              <Text size="xs" c="dimmed" mt={6}>
                {new Date(article.publishedAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
              </Text>
            </Card>
          ))}
        </Stack>

        {related.length > 0 && (
          <Box>
            <Text fw={750} size="sm" mb="xs">Другие темы</Text>
            <Group gap={6} wrap="wrap">
              {related.map((item) => (
                <Badge
                  key={item.slug}
                  component={Link}
                  href={`/news/tema/${item.slug}`}
                  size="lg"
                  variant="light"
                  color="indigo"
                  style={{ cursor: "pointer" }}
                >
                  {formatTagLabel(item.tag)} · {item.count}
                </Badge>
              ))}
            </Group>
          </Box>
        )}

        <StructuredData
          data={{
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: `${label} — новости автомобильного рынка`,
            description: `Публикации по теме «${label}» на LeWheel.`,
            url: `https://lewheel.ru/news/tema/${tag.slug}`,
            mainEntity: {
              "@type": "ItemList",
              numberOfItems: articles.length,
              itemListElement: articles.slice(0, 10).map((article, index) => ({
                "@type": "ListItem",
                position: index + 1,
                name: article.title,
                url: `https://lewheel.ru/news/${article.slug || article.id}`,
              })),
            },
          }}
        />
      </Stack>
    </Container>
  )
}
