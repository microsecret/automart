import type { Metadata } from "next"
import Link from "next/link"
import { Badge, Box, Card, Container, Group, SimpleGrid, Stack, Text, Title } from "@mantine/core"
import { IconMessages } from "@tabler/icons-react"
import { prisma } from "@/lib/prisma"
import { FORUM_GROUPS, pluralTopics } from "@/lib/forum"
import { formatAdminDateTimeShort } from "@/lib/admin-datetime"

export const metadata: Metadata = {
  title: "Форум автолюбителей — LeWheel",
  description: "Обсуждения по регионам России, маркам автомобилей и темам: ремонт, растаможка, выбор машины, ПДД, тюнинг. Задайте вопрос владельцам.",
}

/* Раздел обновляется от каждого сообщения, но не ежесекундно: минута
   кэша снимает нагрузку с базы на списке, который открывают чаще всего. */
export const revalidate = 60

export default async function ForumPage() {
  const sections = await prisma.forumSection.findMany({
    orderBy: [{ groupKey: "asc" }, { position: "asc" }],
    select: {
      slug: true, title: true, description: true, groupKey: true,
      topicCount: true, postCount: true, lastPostAt: true,
    },
  })

  const totalTopics = sections.reduce((sum, section) => sum + section.topicCount, 0)

  return (
    <Container size="xl" py={{ base: "md", md: "xl" }}>
      <Stack gap="lg">
        <Box>
          <Title order={1} fz={{ base: 26, md: 34 }} ff="var(--font-display),sans-serif" c="var(--market-ink)">
            Форум автолюбителей
          </Title>
          <Text size="sm" c="var(--market-muted)" mt={6} maw={640}>
            {totalTopics > 0
              ? `${totalTopics} ${pluralTopics(totalTopics)} о выборе машины, ремонте, растаможке и жизни за рулём. Спросите тех, кто уже ездит.`
              : "Спросите владельцев о выборе машины, ремонте, растаможке и жизни за рулём. Отвечают такие же автолюбители."}
          </Text>
        </Box>

        {FORUM_GROUPS.map((group) => {
          const groupSections = sections.filter((section) => section.groupKey === group.key)
          if (!groupSections.length) return null

          return (
            <Stack key={group.key} gap="xs">
              <Box>
                <Text fw={800} fz="lg" c="var(--market-ink)" ff="var(--font-display),sans-serif">{group.title}</Text>
                <Text size="xs" c="var(--market-muted)">{group.hint}</Text>
              </Box>

              <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
                {groupSections.map((section) => (
                  <Card
                    key={section.slug}
                    component={Link}
                    href={`/forum/${section.slug}`}
                    withBorder
                    radius="md"
                    p="md"
                    className="forum-section-card"
                  >
                    <Group justify="space-between" align="flex-start" wrap="nowrap" gap="xs">
                      <Text fw={700} fz="sm" c="var(--market-ink)" lh={1.3}>{section.title}</Text>
                      {/* Пустой раздел не показывает ноль и не зовёт «напишите
                          первым»: строка приглашения в каждой карточке делает
                          форум похожим на заброшенный. */}
                      {section.topicCount > 0 && (
                        <Badge variant="light" color="indigo" size="sm" style={{ flexShrink: 0 }}>
                          {section.topicCount}
                        </Badge>
                      )}
                    </Group>

                    {section.description && (
                      <Text size="xs" c="var(--market-muted)" mt={4} lh={1.4}>{section.description}</Text>
                    )}

                    {section.lastPostAt && (
                      <Group gap={5} mt={8}>
                        <IconMessages size={12} color="var(--market-muted)" />
                        <Text size="xs" c="var(--market-muted)">
                          {section.postCount} · {formatAdminDateTimeShort(section.lastPostAt)}
                        </Text>
                      </Group>
                    )}
                  </Card>
                ))}
              </SimpleGrid>
            </Stack>
          )
        })}
      </Stack>
    </Container>
  )
}
