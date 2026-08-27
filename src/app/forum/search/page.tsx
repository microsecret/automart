import type { Metadata } from "next"
import Link from "next/link"
import { Anchor, Badge, Box, Breadcrumbs, Card, Container, Group, Stack, Text, Title } from "@mantine/core"
import { IconEye, IconMessages } from "@tabler/icons-react"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { containsAnyCase } from "@/lib/search-terms"
import { pluralReplies, topicPrefixMeta } from "@/lib/forum"
import { formatAdminDateTimeShort } from "@/lib/admin-datetime"
import ForumSearchField from "@/components/forum/ForumSearchField"

export const dynamic = "force-dynamic"

const SEARCH_LIMIT = 20

type Props = { searchParams: Promise<{ q?: string; page?: string }> }

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q } = await searchParams
  const query = (q || "").trim()

  return {
    title: query ? `Поиск «${query}» — форум LeWheel` : "Поиск по форуму — LeWheel",
    /* Страницы поиска из выдачи не нужны: они плодят тысячи адресов с
       одинаковым содержимым и размывают вес настоящих тем. */
    robots: { index: false, follow: true },
  }
}

/**
 * Поиск по форуму.
 *
 * Без него форум с сотней тем превращается в свалку: человек с той же
 * поломкой заводит новую тему вместо того, чтобы найти разобранную год
 * назад, и одни и те же вопросы обсуждаются по пятому разу.
 *
 * Страница серверная: результаты приходят готовой разметкой, и ссылка на
 * поиск, отправленная другу, откроется сразу с ними.
 */
export default async function ForumSearchPage({ searchParams }: Props) {
  const { q, page: pageParam } = await searchParams
  const query = (q || "").trim()
  const page = Math.max(1, Math.min(50, Number.parseInt(pageParam || "1", 10) || 1))

  const tooShort = query.length > 0 && query.length < 3

  let topics: Awaited<ReturnType<typeof searchTopics>>["topics"] = []
  let total = 0

  if (query.length >= 3) {
    const result = await searchTopics(query, page)
    topics = result.topics
    total = result.total
  }

  const totalPages = Math.max(1, Math.ceil(total / SEARCH_LIMIT))

  return (
    <Container size="md" py={{ base: "md", md: "xl" }}>
      <Stack gap="md">
        <Breadcrumbs separator="›">
          <Anchor component={Link} href="/forum" size="xs" c="var(--market-muted)">Форум</Anchor>
          <Text size="xs" c="var(--market-muted)">Поиск</Text>
        </Breadcrumbs>

        <Box>
          <Title order={1} fz={{ base: 22, md: 28 }} ff="var(--font-display),sans-serif" c="var(--market-ink)">
            Поиск по форуму
          </Title>
          <Text size="sm" c="var(--market-muted)" mt={4}>
            Ищет и в заголовках тем, и в тексте сообщений.
          </Text>
        </Box>

        <ForumSearchField initialQuery={query} />

        {tooShort && (
          <Card withBorder radius="md" p="md">
            <Text size="sm" c="var(--market-muted)">
              Введите хотя бы три символа: по одной букве найдётся полфорума.
            </Text>
          </Card>
        )}

        {query.length >= 3 && (
          <>
            <Text size="sm" c="var(--market-muted)">
              {total === 0 ? "Ничего не нашлось" : `Найдено тем: ${total}`}
            </Text>

            {total === 0 ? (
              <Card withBorder radius="md" p="xl">
                <Stack align="center" gap={6} ta="center">
                  <Text fw={700} c="var(--market-ink)">По запросу «{query}» ничего нет</Text>
                  <Text size="sm" c="var(--market-muted)" maw={440}>
                    Попробуйте короче или другими словами. Если такого обсуждения ещё не было — задайте вопрос
                    в подходящем разделе, на форуме отвечают владельцы.
                  </Text>
                  <Anchor component={Link} href="/forum" size="sm" mt={4}>Выбрать раздел</Anchor>
                </Stack>
              </Card>
            ) : (
              <Stack gap={6}>
                {topics.map((topic) => {
                  const meta = topicPrefixMeta(topic.prefix, topic.hasBestAnswer)
                  return (
                    <Card
                      key={topic.slug}
                      component={Link}
                      href={`/forum/${topic.sectionSlug}/${topic.slug}`}
                      withBorder
                      radius="md"
                      p="sm"
                      className="forum-topic-row"
                    >
                      <Group justify="space-between" wrap="nowrap" gap="sm" align="flex-start">
                        <Box style={{ minWidth: 0 }}>
                          <Group gap={6} wrap="nowrap">
                            {meta && (
                              <Badge size="xs" variant="light" color={meta.color} style={{ flexShrink: 0 }}>
                                {meta.label}
                              </Badge>
                            )}
                            <Text fw={600} fz="sm" c="var(--market-ink)" lineClamp={2}>{topic.title}</Text>
                          </Group>
                          {/* Раздел в строке результата: один и тот же вопрос
                              в разделе «Toyota» и в разделе «Растаможка» —
                              это разные разговоры. */}
                          <Text size="xs" c="var(--market-muted)" mt={3}>
                            {topic.sectionTitle} · {topic.authorName || "Участник"} · {formatAdminDateTimeShort(topic.lastPostAt)}
                          </Text>
                        </Box>

                        <Group gap="sm" wrap="nowrap" style={{ flexShrink: 0 }}>
                          <Group gap={3}>
                            <IconMessages size={13} color="var(--market-muted)" />
                            <Text fz="xs" c="var(--market-muted)">{topic.replyCount}</Text>
                          </Group>
                          <Group gap={3}>
                            <IconEye size={13} color="var(--market-muted)" />
                            <Text fz="xs" c="var(--market-muted)">{topic.views}</Text>
                          </Group>
                        </Group>
                      </Group>
                    </Card>
                  )
                })}
              </Stack>
            )}

            {totalPages > 1 && (
              <Group justify="center" gap="xs">
                {page > 1 && (
                  <Anchor component={Link} href={`/forum/search?q=${encodeURIComponent(query)}&page=${page - 1}`} size="sm">
                    Назад
                  </Anchor>
                )}
                <Text size="sm" c="var(--market-muted)">Страница {page} из {totalPages}</Text>
                {page < totalPages && (
                  <Anchor component={Link} href={`/forum/search?q=${encodeURIComponent(query)}&page=${page + 1}`} size="sm">
                    Дальше
                  </Anchor>
                )}
              </Group>
            )}
          </>
        )}
      </Stack>
    </Container>
  )
}

/**
 * Ищет темы по заголовку и по тексту сообщений.
 *
 * Написания запроса разворачиваются через searchVariants: база SQLite, и
 * её LIKE не различает регистр только для латиницы — «камаз» не нашёл бы
 * «КАМАЗ». Подробности в src/lib/search-terms.ts.
 */
async function searchTopics(query: string, page: number) {
  const where: Prisma.ForumTopicWhereInput = {
    deletedAt: null,
    OR: [
      ...containsAnyCase("title", query).map((condition) => condition as Prisma.ForumTopicWhereInput),
      {
        posts: {
          some: {
            deletedAt: null,
            OR: containsAnyCase("content", query).map((condition) => condition as Prisma.ForumPostWhereInput),
          },
        },
      },
    ],
  }

  const [rows, total] = await Promise.all([
    prisma.forumTopic.findMany({
      where,
      /* По свежести последнего сообщения: живое обсуждение полезнее
         давно заглохшего, даже если совпадение там точнее. */
      orderBy: { lastPostAt: "desc" },
      skip: (page - 1) * SEARCH_LIMIT,
      take: SEARCH_LIMIT,
      select: {
        slug: true,
        title: true,
        prefix: true,
        replyCount: true,
        views: true,
        lastPostAt: true,
        author: { select: { name: true } },
        section: { select: { slug: true, title: true } },
        posts: { where: { isBestAnswer: true }, select: { id: true }, take: 1 },
      },
    }),
    prisma.forumTopic.count({ where }),
  ])

  return {
    total,
    topics: rows.map((topic) => ({
      slug: topic.slug,
      title: topic.title,
      prefix: topic.prefix,
      replyCount: topic.replyCount,
      views: topic.views,
      lastPostAt: topic.lastPostAt,
      authorName: topic.author.name,
      sectionSlug: topic.section.slug,
      sectionTitle: topic.section.title,
      hasBestAnswer: topic.posts.length > 0,
    })),
  }
}
