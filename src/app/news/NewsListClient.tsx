"use client"

import { useDeferredValue, useState } from "react"
import useSWR from "swr"
import { Badge, Box, Card, Group, Image, Pagination, SegmentedControl, SimpleGrid, Stack, Text, TextInput, ThemeIcon } from "@mantine/core"
import { IconArrowUpRight, IconEye, IconMessageCircle2, IconNews, IconSearch, IconSparkles } from "@tabler/icons-react"
import Link from "next/link"
import { formatRelativeDate } from "@/lib/format"
import { newsHref } from "@/lib/news"
import { fetchJson } from "@/lib/api-client"
import { AsyncErrorState, EmptyState, ResultsGridSkeleton } from "@/components/ui/AsyncStates"

type NewsArticle = {
  id: string
  slug: string | null
  title: string
  excerpt: string | null
  imageUrl: string | null
  sourceChannel: string | null
  tags: string[]
  publishedAt: string
  views: number
  _count?: { comments: number }
}

type NewsResponse = {
  news: NewsArticle[]
  pagination: { page: number; limit: number; total: number; pages: number }
}

function NewsCard({ article, featured }: { article: NewsArticle; featured: boolean }) {
  const source = article.sourceChannel ? `@${article.sourceChannel}` : "Новости рынка"
  // Картинки ведут на сайты источников, и часть из них закрыта от чужих
  // страниц: карточка оставалась с белым прямоугольником вместо обложки.
  // При ошибке загрузки показываем ту же оформленную заглушку.
  const [imageFailed, setImageFailed] = useState(false)

  return (
    <Link className="news-list-card-link" data-featured={featured || undefined} href={newsHref(article)} aria-label={`Открыть новость: ${article.title}`}>
      <Card className="news-list-card" data-featured={featured || undefined} radius="md" p={0} withBorder>
        {/* Подпись пустая намеренно: название новости уже озвучено в
             aria-label самой ссылки, и чтец объявил бы его дважды.

             Ленивая загрузка — обложки лежат ниже первого экрана, а замер
             показал файлы 1199×675 под контейнер 378×156: грузить их все
             разом при открытии ленты незачем. Главная новость грузится
             сразу — она на первом экране. */}
        {article.imageUrl && !imageFailed ? (
          <Image
            className="news-list-card__image"
            src={article.imageUrl}
            alt=""
            h={featured ? 230 : 156}
            fit="cover"
            loading={featured ? "eager" : "lazy"}
            decoding="async"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <Box className="news-list-card__cover" data-featured={featured || undefined} aria-hidden="true">
            <ThemeIcon className="news-list-card__cover-icon" color="indigo" variant="white" radius="xl" size={featured ? 54 : 42}>
              {featured ? <IconSparkles size={featured ? 27 : 21} /> : <IconNews size={21} />}
            </ThemeIcon>
            <Text className="news-list-card__cover-label" fw={800} size={featured ? "sm" : "xs"}>{featured ? "Главное сегодня" : "Новости авторынка"}</Text>
          </Box>
        )}
        <Stack className="news-list-card__content" gap="sm">
          <Group className="news-list-card__meta" justify="space-between" gap="xs" wrap="nowrap">
            <Badge className="news-list-card__source" size="xs" variant="light" color="indigo" radius="xl">{source}</Badge>
            <Text size="xs" c="dimmed" style={{ whiteSpace: "nowrap" }}>{formatRelativeDate(article.publishedAt)}</Text>
          </Group>

          <Text component="h2" className="news-list-card__title" fw={featured ? 800 : 750} fz={featured ? "xl" : "md"} lh={1.24}>
            {article.title}
          </Text>

          {article.excerpt && <Text className="news-list-card__excerpt" size="sm" c="dimmed" lh={1.5}>{article.excerpt}</Text>}

          {article.tags.length > 0 && (
            <Group gap={5} wrap="wrap">
              {article.tags.map((tag) => <Badge key={tag.toLocaleLowerCase("ru")} size="xs" variant="light" color="gray">#{tag}</Badge>)}
            </Group>
          )}

          <Group className="news-list-card__footer" justify="space-between" mt="auto" pt="xs">
            <Group gap="sm" c="dimmed">
              <Group gap={4} aria-label={`${article.views.toLocaleString("ru-RU")} просмотров`}><IconEye size={14} stroke={1.8} /><Text size="xs">{article.views.toLocaleString("ru-RU")}</Text></Group>
              {(article._count?.comments || 0) > 0 && <Group gap={4} aria-label={`${article._count?.comments || 0} комментариев`}><IconMessageCircle2 size={13} stroke={1.8} /><Text size="xs">{article._count?.comments}</Text></Group>}
            </Group>
            <Group gap={4} className="news-list-card__read"><Text size="xs" fw={700}>Читать</Text><IconArrowUpRight size={14} /></Group>
          </Group>
        </Stack>
      </Card>
    </Link>
  )
}

export default function NewsListClient({ initialData }: { initialData: NewsResponse }) {
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState<"recent" | "popular">("recent")
  const deferredQuery = useDeferredValue(query.trim())
  const isInitialFeed = page === 1 && !deferredQuery && sort === "recent"
  // Главная новость занимает две колонки из трёх, поэтому при 12 карточках
  // сетка получала 13 ячеек и последний ряд оставался с дырой. Там, где
  // главной нет, дыру давал бы уже нечётный остаток, поэтому лимит зависит
  // от неё: 11 карточек с главной и 12 без — оба варианта дают полные ряды.
  const newsUrl = `/api/news?page=${page}&limit=${isInitialFeed ? 11 : 12}&sort=${sort}${deferredQuery ? `&q=${encodeURIComponent(deferredQuery)}` : ""}`
  const { data: liveData, error, isLoading, mutate } = useSWR<NewsResponse>(newsUrl, fetchJson, {
    fallbackData: isInitialFeed ? initialData : undefined,
    keepPreviousData: true,
    revalidateOnMount: !isInitialFeed,
    revalidateOnFocus: false,
  })
  const data = liveData || (isInitialFeed ? initialData : undefined)
  const articles = data?.news || []

  return (
    <Box className="news-list-page" p={{ base: "sm", md: "md" }}>
      <Stack gap="md">
        <Group className="news-list-page__heading" gap="sm" align="center">
          <ThemeIcon variant="light" color="indigo" size={44} radius="lg"><IconNews size={22} /></ThemeIcon>
          <Stack gap={1}>
            <Text component="h1" ff="var(--font-display),sans-serif">Автомобильные новости</Text>
            <Text size="sm" c="dimmed">Свежие публикации редакции и рынка{data?.pagination.total ? ` · ${data.pagination.total}` : ""}</Text>
          </Stack>
        </Group>

        <Group gap="sm" align="stretch" wrap="wrap">
          <TextInput
            className="news-list-search"
            placeholder="Поиск по новостям"
            leftSection={<IconSearch size={17} />}
            value={query}
            onChange={(event) => { setQuery(event.currentTarget.value); setPage(1) }}
            size="md"
            radius="lg"
            aria-label="Поиск по новостям"
            style={{ flex: "1 1 320px" }}
          />
          <SegmentedControl
            size="md"
            radius="lg"
            value={sort}
            onChange={(value) => { setSort(value as "recent" | "popular"); setPage(1) }}
            data={[{ value: "recent", label: "Свежие" }, { value: "popular", label: "Популярные" }]}
            aria-label="Порядок новостей"
          />
        </Group>

        {error ? <AsyncErrorState title="Не удалось загрузить новости" description="Проверьте подключение и повторите попытку." onRetry={() => mutate()} /> : isLoading && !data ? (
          <ResultsGridSkeleton count={9} mediaHeight={156} />
        ) : articles.length ? (
          <SimpleGrid className="news-list-grid" cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
            {articles.map((article, index) => <NewsCard key={article.id} article={article} featured={index === 0 && page === 1 && !deferredQuery && sort === "recent"} />)}
          </SimpleGrid>
        ) : (
          <EmptyState title="Ничего не найдено" description="Попробуйте изменить запрос или посмотреть все новости." actionLabel="Сбросить поиск" onAction={() => { setQuery(""); setPage(1) }} />
        )}

        {data && data.pagination.pages > 1 && (
          <Group justify="center" mt="sm">
            <Pagination value={page} onChange={setPage} total={data.pagination.pages} color="indigo" radius="md" size="sm" />
          </Group>
        )}
      </Stack>
    </Box>
  )
}
