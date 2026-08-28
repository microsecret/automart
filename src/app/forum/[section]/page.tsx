import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Anchor, Badge, Box, Breadcrumbs, Card, Container, Group, Stack, Text, Title } from "@mantine/core"
import { IconEye, IconMessages, IconPin } from "@tabler/icons-react"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasNewSince, readAndMarkVisit } from "@/lib/forum-visit"
import { TOPICS_PER_PAGE, topicPrefixMeta } from "@/lib/forum"
import { formatAdminDateTimeShort } from "@/lib/admin-datetime"
import NewTopicForm from "./NewTopicForm"

type Props = { params: Promise<{ section: string }>; searchParams: Promise<{ page?: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { section: slug } = await params
  const section = await prisma.forumSection.findUnique({
    where: { slug },
    select: { title: true, description: true },
  })
  if (!section) return { title: "Раздел не найден — LeWheel" }

  return {
    title: `${section.title} — форум LeWheel`,
    description: section.description || `Обсуждения в разделе «${section.title}» на форуме автолюбителей LeWheel.`,
  }
}

/* Кэша здесь больше нет: страница показывает личное — подсветку тем, где
   писали с прошлого захода именно этого человека. С кэшем её увидели бы
   все одинаковой, из ответа первого зашедшего. */
export const dynamic = "force-dynamic"

export default async function ForumSectionPage({ params, searchParams }: Props) {
  const { section: slug } = await params
  const { page: pageParam } = await searchParams
  const page = Math.max(1, Number.parseInt(pageParam || "1", 10) || 1)

  const section = await prisma.forumSection.findUnique({
    where: { slug },
    select: {
      id: true, slug: true, title: true, description: true, topicCount: true,
      parent: { select: { slug: true, title: true } },
      children: {
        orderBy: { position: "asc" },
        select: { slug: true, title: true, description: true, topicCount: true, postCount: true },
      },
    },
  })
  if (!section) notFound()

  /* Прошлый заход читается до отметки нынешнего: запиши мы сначала —
     подсвечивать было бы нечего, «прошлый заход» стал бы этой самой
     секундой. */
  const session = await getServerSession(authOptions)
  const lastVisitAt = await readAndMarkVisit(session?.user?.id ?? null)

  const topics = await prisma.forumTopic.findMany({
    where: { sectionId: section.id, deletedAt: null },
    /* Закреплённые сверху, дальше — по свежести последнего сообщения:
       живое обсуждение важнее давно созданной темы. */
    orderBy: [{ isPinned: "desc" }, { lastPostAt: "desc" }],
    skip: (page - 1) * TOPICS_PER_PAGE,
    take: TOPICS_PER_PAGE,
    select: {
      slug: true, title: true, isPinned: true, isClosed: true, prefix: true,
      views: true, replyCount: true, lastPostAt: true,
      author: { select: { name: true } },
      /* Признак решённости: одно поле вместо полной выборки сообщений.
         Отметка одна на тему, поэтому хватает первого найденного. */
      posts: { where: { isBestAnswer: true }, select: { id: true }, take: 1 },
    },
  })

  const totalPages = Math.max(1, Math.ceil(section.topicCount / TOPICS_PER_PAGE))

  return (
    <Container size="lg" py={{ base: "md", md: "xl" }}>
      <Stack gap="md">
        <Breadcrumbs separator="›">
          <Anchor component={Link} href="/forum" size="xs" c="var(--market-muted)">Форум</Anchor>
          {/* Родитель в крошках: из подраздела «Toyota» нужен путь назад к
              «Японским автомобилям», а не только к корню форума. */}
          {section.parent && (
            <Anchor component={Link} href={`/forum/${section.parent.slug}`} size="xs" c="var(--market-muted)">
              {section.parent.title}
            </Anchor>
          )}
          <Text size="xs" c="var(--market-muted)">{section.title}</Text>
        </Breadcrumbs>

        <Box>
          <Title order={1} fz={{ base: 22, md: 30 }} ff="var(--font-display),sans-serif" c="var(--market-ink)">
            {section.title}
          </Title>
          {section.description && <Text size="sm" c="var(--market-muted)" mt={4}>{section.description}</Text>}
        </Box>

        {/* Подразделы идут первыми: у родительского раздела своих тем
            обычно нет, и человеку нужен переход глубже, а не форма. */}
        {section.children.length > 0 && (
          <Card withBorder radius="md" p={0} className="forum-group">
            <Box className="forum-group__head">
              <Text fw={800} fz="sm" c="var(--market-ink)">Подразделы</Text>
            </Box>
            <Stack gap={0}>
              {section.children.map((child) => (
                <Box key={child.slug} className="forum-row">
                  <Box className="forum-row__main">
                    <Anchor component={Link} href={`/forum/${child.slug}`} className="forum-row__title">
                      {child.title}
                    </Anchor>
                    {child.description && <Text className="forum-row__description">{child.description}</Text>}
                  </Box>
                  <Box className="forum-row__stats">
                    <Text className="forum-row__stat">
                      <span className="forum-row__stat-label">Тем: </span>{child.topicCount}
                    </Text>
                    <Text className="forum-row__stat forum-row__stat--muted">
                      <span className="forum-row__stat-label">Сообщений: </span>{child.postCount}
                    </Text>
                  </Box>
                </Box>
              ))}
            </Stack>
          </Card>
        )}

        <NewTopicForm sectionSlug={section.slug} />

        {topics.length === 0 ? (
          <Card withBorder radius="md" p="xl">
            <Stack align="center" gap={6} ta="center">
              <Text fw={700} c="var(--market-ink)">Здесь пока не обсуждали</Text>
              <Text size="sm" c="var(--market-muted)" maw={420}>
                Задайте вопрос — на форуме отвечают владельцы, которые уже прошли через это.
              </Text>
            </Stack>
          </Card>
        ) : (
          <Stack gap={6}>
            {topics.map((topic) => (
              <Card
                key={topic.slug}
                component={Link}
                href={`/forum/${section.slug}/${topic.slug}`}
                withBorder
                radius="md"
                p="sm"
                className="forum-topic-row"
              >
                <Group justify="space-between" wrap="nowrap" gap="sm" align="flex-start">
                  <Box style={{ minWidth: 0 }}>
                    <Group gap={6} wrap="nowrap">
                      {topic.isPinned && <IconPin size={13} color="var(--mantine-color-indigo-6)" />}
                      {/* Метка перед заголовком: в списке из двадцати тем
                          глаз ищет «Решено» и «Помогите», а не читает
                          заголовки подряд. Решённый вопрос перебивает
                          исходную метку — тому, кто ищет ответ, важнее
                          он, чем то, что когда-то просили помощи. */}
                      {(() => {
                        const meta = topicPrefixMeta(topic.prefix, topic.posts.length > 0)
                        return meta ? (
                          <Badge size="xs" variant="light" color={meta.color} style={{ flexShrink: 0 }}>
                            {meta.label}
                          </Badge>
                        ) : null
                      })()}
                      <Text fw={600} fz="sm" c="var(--market-ink)" lineClamp={2}>{topic.title}</Text>
                      {topic.isClosed && <Badge size="xs" variant="light" color="gray">закрыта</Badge>}
                      {/* Точка вместо слова «новое»: она читается краем
                          глаза при беге по списку, а подпись пришлось бы
                          прочитать у каждой из двадцати пяти строк. */}
                      {hasNewSince({ lastPostAt: topic.lastPostAt, lastVisitAt }) && (
                        <Box className="forum-topic-new" title="Есть новые сообщения" />
                      )}
                    </Group>
                    <Text size="xs" c="var(--market-muted)" mt={3}>
                      {topic.author.name || "Участник"} · {formatAdminDateTimeShort(topic.lastPostAt)}
                    </Text>
                  </Box>

                  <Group gap="sm" wrap="nowrap" style={{ flexShrink: 0 }}>
                    <Group gap={3}>
                      <IconMessages size={12} color="var(--market-muted)" />
                      <Text size="xs" c="var(--market-muted)" style={{ fontVariantNumeric: "tabular-nums" }}>
                        {topic.replyCount}
                      </Text>
                    </Group>
                    <Group gap={3}>
                      <IconEye size={12} color="var(--market-muted)" />
                      <Text size="xs" c="var(--market-muted)" style={{ fontVariantNumeric: "tabular-nums" }}>
                        {topic.views}
                      </Text>
                    </Group>
                  </Group>
                </Group>
              </Card>
            ))}
          </Stack>
        )}

        {totalPages > 1 && (
          <Group justify="center" gap="xs">
            {page > 1 && (
              <Anchor component={Link} href={`/forum/${section.slug}?page=${page - 1}`} size="sm">Назад</Anchor>
            )}
            <Text size="sm" c="var(--market-muted)">Страница {page} из {totalPages}</Text>
            {page < totalPages && (
              <Anchor component={Link} href={`/forum/${section.slug}?page=${page + 1}`} size="sm">Дальше</Anchor>
            )}
          </Group>
        )}
      </Stack>
    </Container>
  )
}
