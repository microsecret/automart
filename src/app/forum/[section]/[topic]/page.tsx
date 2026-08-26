import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Anchor, Avatar, Badge, Box, Breadcrumbs, Card, Container, Group, Stack, Text, Title } from "@mantine/core"
import { prisma } from "@/lib/prisma"
import { pluralReplies, POSTS_PER_PAGE } from "@/lib/forum"
import { formatAdminDateTimeShort } from "@/lib/admin-datetime"
import ReplyForm from "./ReplyForm"

type Props = { params: Promise<{ section: string; topic: string }>; searchParams: Promise<{ page?: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { topic: slug } = await params
  const topic = await prisma.forumTopic.findFirst({
    where: { slug, deletedAt: null },
    select: {
      title: true,
      section: { select: { title: true } },
      posts: { where: { deletedAt: null }, orderBy: { createdAt: "asc" }, take: 1, select: { content: true } },
    },
  })
  if (!topic) return { title: "Тема не найдена — LeWheel" }

  /* Описание из первого сообщения: поисковая выдача показывает именно
     его, и осмысленный отрывок приводит людей лучше шаблонной строки. */
  const excerpt = topic.posts[0]?.content.replace(/\s+/g, " ").slice(0, 155) || ""

  return {
    title: `${topic.title} — ${topic.section.title} — форум LeWheel`,
    description: excerpt || `Обсуждение «${topic.title}» на форуме автолюбителей LeWheel.`,
  }
}

export default async function ForumTopicPage({ params, searchParams }: Props) {
  const { section: sectionSlug, topic: topicSlugParam } = await params
  const { page: pageParam } = await searchParams
  const page = Math.max(1, Number.parseInt(pageParam || "1", 10) || 1)

  const topic = await prisma.forumTopic.findFirst({
    where: { slug: topicSlugParam, deletedAt: null },
    select: {
      id: true, title: true, isClosed: true, replyCount: true, createdAt: true,
      author: { select: { name: true, image: true } },
      section: { select: { slug: true, title: true } },
    },
  })
  if (!topic || topic.section.slug !== sectionSlug) notFound()

  const posts = await prisma.forumPost.findMany({
    where: { topicId: topic.id },
    orderBy: { createdAt: "asc" },
    skip: (page - 1) * POSTS_PER_PAGE,
    take: POSTS_PER_PAGE,
    select: {
      id: true, content: true, createdAt: true, deletedAt: true,
      author: { select: { name: true, image: true } },
    },
  })

  /* Просмотр считается без ожидания ответа: задержка страницы ради
     счётчика не оправдана, а потеря одного просмотра при сбое не важна. */
  void prisma.forumTopic.update({ where: { id: topic.id }, data: { views: { increment: 1 } } }).catch(() => {})

  const totalPages = Math.max(1, Math.ceil((topic.replyCount + 1) / POSTS_PER_PAGE))

  return (
    <Container size="md" py={{ base: "md", md: "xl" }}>
      <Stack gap="md">
        <Breadcrumbs separator="›">
          <Anchor component={Link} href="/forum" size="xs" c="var(--market-muted)">Форум</Anchor>
          <Anchor component={Link} href={`/forum/${topic.section.slug}`} size="xs" c="var(--market-muted)">
            {topic.section.title}
          </Anchor>
        </Breadcrumbs>

        <Box>
          <Title order={1} fz={{ base: 20, md: 26 }} ff="var(--font-display),sans-serif" c="var(--market-ink)" lh={1.25}>
            {topic.title}
          </Title>
          <Group gap={6} mt={5}>
            <Text size="xs" c="var(--market-muted)">
              {topic.author.name || "Участник"} · {formatAdminDateTimeShort(topic.createdAt)} · {topic.replyCount} {pluralReplies(topic.replyCount)}
            </Text>
            {topic.isClosed && <Badge size="xs" variant="light" color="gray">закрыта</Badge>}
          </Group>
        </Box>

        <Stack gap="xs">
          {posts.map((post) => (
            <Card key={post.id} withBorder radius="md" p="sm">
              <Group gap="sm" align="flex-start" wrap="nowrap">
                <Avatar src={post.author.image} size={34} radius="xl" color="indigo">
                  {(post.author.name || "У").slice(0, 1).toUpperCase()}
                </Avatar>
                <Box style={{ minWidth: 0, flex: 1 }}>
                  <Group gap={6}>
                    <Text fw={700} fz="xs" c="var(--market-ink)">{post.author.name || "Участник"}</Text>
                    <Text fz="xs" c="var(--market-muted)">{formatAdminDateTimeShort(post.createdAt)}</Text>
                  </Group>
                  {/* Удалённое сообщение оставляет пометку: без неё ответы на
                      него теряют смысл, а разговор — нить. */}
                  <Text
                    size="sm"
                    mt={4}
                    c={post.deletedAt ? "var(--market-muted)" : undefined}
                    fs={post.deletedAt ? "italic" : undefined}
                    style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
                  >
                    {post.deletedAt ? "Сообщение удалено модератором" : post.content}
                  </Text>
                </Box>
              </Group>
            </Card>
          ))}
        </Stack>

        {totalPages > 1 && (
          <Group justify="center" gap="xs">
            {page > 1 && (
              <Anchor component={Link} href={`/forum/${sectionSlug}/${topicSlugParam}?page=${page - 1}`} size="sm">Назад</Anchor>
            )}
            <Text size="sm" c="var(--market-muted)">Страница {page} из {totalPages}</Text>
            {page < totalPages && (
              <Anchor component={Link} href={`/forum/${sectionSlug}/${topicSlugParam}?page=${page + 1}`} size="sm">Дальше</Anchor>
            )}
          </Group>
        )}

        {topic.isClosed ? (
          <Card withBorder radius="md" p="sm">
            <Text size="sm" c="var(--market-muted)">Тема закрыта: читать можно, отвечать — нет.</Text>
          </Card>
        ) : (
          <ReplyForm topicId={topic.id} returnPath={`/forum/${sectionSlug}/${topicSlugParam}`} />
        )}
      </Stack>
    </Container>
  )
}
