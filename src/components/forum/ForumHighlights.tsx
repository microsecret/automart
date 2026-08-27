import Link from "next/link"
import { Anchor, Box, Card, Group, SimpleGrid, Text } from "@mantine/core"
import { IconMessages } from "@tabler/icons-react"
import { prisma } from "@/lib/prisma"
import { pluralReplies } from "@/lib/forum"

/**
 * Свежие обсуждения форума на главной.
 *
 * Форум построили ради поискового трафика, но с самого сайта на него не
 * вело ни одной ссылки, кроме пункта меню: двенадцать написанных тем
 * набрали ноль просмотров. Блок соединяет каталог с форумом — человек,
 * выбирающий машину, видит, что о ней уже спрашивали.
 *
 * Серверный компонент: один запрос при отрисовке страницы, без ожидания
 * на стороне браузера.
 */
export default async function ForumHighlights() {
  const topics = await prisma.forumTopic.findMany({
    where: { deletedAt: null, isPinned: false },
    orderBy: { lastPostAt: "desc" },
    take: 6,
    select: {
      slug: true,
      title: true,
      replyCount: true,
      section: { select: { slug: true, title: true } },
    },
  })

  /* Пустой форум блок не показывает: приглашение «обсудите первым» на
     главной выглядит как признак заброшенной площадки. */
  if (topics.length < 3) return null

  return (
    <Box component="section" mt="lg" aria-label="Обсуждения на форуме">
      <Group justify="space-between" align="flex-end" mb="xs" gap="sm" wrap="wrap">
        <Box>
          <Text fw={800} fz="lg" c="var(--market-ink)" ff="var(--font-display),sans-serif">
            Спрашивают на форуме
          </Text>
          <Text size="xs" c="var(--market-muted)">
            Владельцы отвечают на вопросы о выборе, ремонте и растаможке
          </Text>
        </Box>
        <Anchor component={Link} href="/forum" size="sm" fw={600}>
          Весь форум
        </Anchor>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
        {topics.map((topic) => (
          <Card
            key={topic.slug}
            component={Link}
            href={`/forum/${topic.section.slug}/${topic.slug}`}
            withBorder
            radius="md"
            p="sm"
            className="forum-highlight"
          >
            <Text fz="xs" c="var(--market-muted)" mb={3}>{topic.section.title}</Text>
            <Text fw={600} fz="sm" c="var(--market-ink)" lh={1.35} lineClamp={2}>
              {topic.title}
            </Text>
            <Group gap={4} mt={6}>
              <IconMessages size={12} color="var(--market-muted)" />
              <Text fz="xs" c="var(--market-muted)">
                {topic.replyCount} {pluralReplies(topic.replyCount)}
              </Text>
            </Group>
          </Card>
        ))}
      </SimpleGrid>
    </Box>
  )
}
