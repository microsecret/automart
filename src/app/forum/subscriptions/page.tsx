import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { Anchor, Badge, Box, Breadcrumbs, Card, Container, Group, Stack, Text, Title } from "@mantine/core"
import { IconEye, IconMessages } from "@tabler/icons-react"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { topicPrefixMeta } from "@/lib/forum"
import { formatAdminDateTimeShort } from "@/lib/admin-datetime"
import UnsubscribeButton from "@/components/forum/UnsubscribeButton"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Мои темы на форуме — LeWheel",
  robots: { index: false, follow: false },
}

/**
 * Темы, за которыми человек следит.
 *
 * Подписался на десяток обсуждений — и без списка не помнит, на какие
 * именно: отписаться можно только зайдя в каждую тему по отдельности.
 *
 * Живёт на форуме, а не в кабинете: сюда приходят из уведомления о новом
 * ответе, и лишний переход через кабинет тут не нужен.
 */
export default async function ForumSubscriptionsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent("/forum/subscriptions")}`)
  }

  const subscriptions = await prisma.forumSubscription.findMany({
    where: { userId: session.user.id, topic: { deletedAt: null } },
    /* По свежести последнего сообщения, а не по дате подписки: человек
       ищет, где ответили, а не когда он подписался. */
    orderBy: { topic: { lastPostAt: "desc" } },
    take: 100,
    select: {
      topic: {
        select: {
          id: true,
          slug: true,
          title: true,
          prefix: true,
          replyCount: true,
          views: true,
          lastPostAt: true,
          isClosed: true,
          section: { select: { slug: true, title: true } },
          posts: { where: { isBestAnswer: true }, select: { id: true }, take: 1 },
        },
      },
    },
  })

  return (
    <Container size="md" py={{ base: "md", md: "xl" }}>
      <Stack gap="md">
        <Breadcrumbs separator="›">
          <Anchor component={Link} href="/forum" size="xs" c="var(--market-muted)">Форум</Anchor>
          <Text size="xs" c="var(--market-muted)">Мои темы</Text>
        </Breadcrumbs>

        <Box>
          <Title order={1} fz={{ base: 22, md: 28 }} ff="var(--font-display),sans-serif" c="var(--market-ink)">
            Темы, за которыми слежу
          </Title>
          <Text size="sm" c="var(--market-muted)" mt={4}>
            О новых ответах в них приходит уведомление.
          </Text>
        </Box>

        {subscriptions.length === 0 ? (
          <Card withBorder radius="md" p="xl">
            <Stack align="center" gap={6} ta="center">
              <Text fw={700} c="var(--market-ink)">Пока ни одной</Text>
              <Text size="sm" c="var(--market-muted)" maw={420}>
                Откройте тему и нажмите «Отслеживать» — и вы узнаете, когда в ней ответят.
                Свои темы отслеживаются сами.
              </Text>
              <Anchor component={Link} href="/forum" size="sm" mt={4}>К разделам</Anchor>
            </Stack>
          </Card>
        ) : (
          <Stack gap={6}>
            {subscriptions.map(({ topic }) => {
              const meta = topicPrefixMeta(topic.prefix, topic.posts.length > 0)
              return (
                <Card key={topic.id} withBorder radius="md" p="sm">
                  <Group justify="space-between" wrap="nowrap" gap="sm" align="flex-start">
                    <Box style={{ minWidth: 0, flex: 1 }}>
                      <Group gap={6} wrap="nowrap">
                        {meta && (
                          <Badge size="xs" variant="light" color={meta.color} style={{ flexShrink: 0 }}>
                            {meta.label}
                          </Badge>
                        )}
                        <Anchor
                          component={Link}
                          href={`/forum/${topic.section.slug}/${topic.slug}`}
                          fw={600}
                          fz="sm"
                          c="var(--market-ink)"
                          lineClamp={2}
                        >
                          {topic.title}
                        </Anchor>
                        {topic.isClosed && <Badge size="xs" variant="light" color="gray">закрыта</Badge>}
                      </Group>
                      <Text size="xs" c="var(--market-muted)" mt={3}>
                        {topic.section.title} · {formatAdminDateTimeShort(topic.lastPostAt)}
                      </Text>
                    </Box>

                    <Group gap="sm" wrap="nowrap" style={{ flexShrink: 0 }}>
                      <Group gap={3} visibleFrom="sm">
                        <IconMessages size={13} color="var(--market-muted)" />
                        <Text fz="xs" c="var(--market-muted)">{topic.replyCount}</Text>
                      </Group>
                      <Group gap={3} visibleFrom="sm">
                        <IconEye size={13} color="var(--market-muted)" />
                        <Text fz="xs" c="var(--market-muted)">{topic.views}</Text>
                      </Group>
                      <UnsubscribeButton topicId={topic.id} />
                    </Group>
                  </Group>
                </Card>
              )
            })}
          </Stack>
        )}
      </Stack>
    </Container>
  )
}
