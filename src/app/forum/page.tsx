import type { Metadata } from "next"
import Link from "next/link"
import { Anchor, Box, Card, Container, Group, Stack, Text, ThemeIcon, Title } from "@mantine/core"
import { IconMap2, IconMessages, IconCar, IconTool } from "@tabler/icons-react"
import { prisma } from "@/lib/prisma"
import { FORUM_GROUPS, pluralTopics } from "@/lib/forum"
import { formatAdminDateTimeShort } from "@/lib/admin-datetime"
import ForumSearchField from "@/components/forum/ForumSearchField"

export const metadata: Metadata = {
  title: "Форум автолюбителей — LeWheel",
  description: "Форумы по маркам автомобилей, регионам России и темам: ремонт, запчасти, растаможка, выбор машины, ПДД, тюнинг. Спросите владельцев.",
}

/* Счётчики меняются от каждого сообщения, но не ежесекундно: минута кэша
   снимает нагрузку со страницы, которую открывают чаще всего. */
export const revalidate = 60

const GROUP_ICONS: Record<string, React.ReactNode> = {
  ORIGIN: <IconCar size={17} />,
  REGION: <IconMap2 size={17} />,
  TOPIC: <IconTool size={17} />,
}

export default async function ForumPage() {
  const sections = await prisma.forumSection.findMany({
    orderBy: [{ groupKey: "asc" }, { position: "asc" }],
    select: {
      id: true, slug: true, title: true, description: true, groupKey: true,
      parentId: true, topicCount: true, postCount: true, lastPostAt: true,
    },
  })

  /* Дерево собирается в памяти: разделов сотня, отдельный запрос за
     детьми каждого стоил бы дороже самой страницы. */
  const roots = sections.filter((section) => !section.parentId)
  const childrenOf = new Map<string, typeof sections>()
  for (const section of sections) {
    if (!section.parentId) continue
    const list = childrenOf.get(section.parentId) || []
    list.push(section)
    childrenOf.set(section.parentId, list)
  }

  /* Счётчик раздела включает подразделы: у родителя своих тем обычно нет,
     и «0 тем» рядом с восемью живыми подфорумами вводит в заблуждение. */
  const totals = new Map<string, { topics: number; posts: number; lastPostAt: Date | null }>()
  for (const root of roots) {
    const kids = childrenOf.get(root.id) || []
    const topics = root.topicCount + kids.reduce((sum, kid) => sum + kid.topicCount, 0)
    const posts = root.postCount + kids.reduce((sum, kid) => sum + kid.postCount, 0)
    const dates = [root.lastPostAt, ...kids.map((kid) => kid.lastPostAt)].filter(Boolean) as Date[]
    const lastPostAt = dates.length ? new Date(Math.max(...dates.map((date) => date.getTime()))) : null
    totals.set(root.id, { topics, posts, lastPostAt })
  }

  const allTopics = roots.reduce((sum, root) => sum + (totals.get(root.id)?.topics || 0), 0)

  return (
    <Container size="xl" py={{ base: "md", md: "xl" }}>
      <Stack gap="lg">
        <Box>
          <Title order={1} fz={{ base: 24, md: 32 }} ff="var(--font-display),sans-serif" c="var(--market-ink)">
            Форум автолюбителей
          </Title>
          <Text size="sm" c="var(--market-muted)" mt={6} maw={680}>
            {allTopics > 0
              ? `${allTopics} ${pluralTopics(allTopics)} по маркам, регионам России и темам: ремонт, запчасти, растаможка, выбор машины. Отвечают владельцы.`
              : "Форумы по маркам, регионам России и темам: ремонт, запчасти, растаможка, выбор машины. Спросите тех, кто уже ездит."}
          </Text>
        </Box>

        {/* Поиск над разделами: человек с поломкой ищет готовый разбор, а
            не выбирает раздел. Без поиска он заведёт новую тему о том, что
            уже разобрали год назад. */}
        <ForumSearchField initialQuery="" />

        {/* Ссылка на участников: без неё страницу не найти, а она
            показывает, что на форуме есть кому отвечать. */}
        <Group gap="md">
          <Anchor component={Link} href="/forum/users" size="sm" c="var(--market-muted)">
            Участники форума
          </Anchor>
          {/* Ссылка видна всем: гость, нажав её, попадёт на вход — это
              честнее, чем прятать раздел, о существовании которого он не
              узнает. */}
          <Anchor component={Link} href="/forum/subscriptions" size="sm" c="var(--market-muted)">
            Мои темы
          </Anchor>
        </Group>

        {FORUM_GROUPS.map((group) => {
          const groupRoots = roots.filter((root) => root.groupKey === group.key)
          if (!groupRoots.length) return null

          return (
            <Card key={group.key} withBorder radius="md" p={0} className="forum-group">
              <Group className="forum-group__head" gap="sm" wrap="nowrap">
                <ThemeIcon variant="light" color="indigo" size={32} radius="md">
                  {GROUP_ICONS[group.key]}
                </ThemeIcon>
                <Box style={{ minWidth: 0, flex: 1 }}>
                  <Text fw={800} fz="sm" c="var(--market-ink)">{group.title}</Text>
                  <Text size="xs" c="var(--market-muted)">{group.hint}</Text>
                </Box>
                {/* Подписи столбцов только на широком экране: на телефоне
                    строка разворачивается вертикально, и шапка ни к чему. */}
                <Group gap={0} className="forum-group__columns" visibleFrom="md" wrap="nowrap">
                  <Text className="forum-row__stats-head">Тем / Сообщений</Text>
                  <Text className="forum-row__last-head">Последнее сообщение</Text>
                </Group>
              </Group>

              <Stack gap={0}>
                {groupRoots.map((root) => {
                  const kids = childrenOf.get(root.id) || []
                  const total = totals.get(root.id)

                  return (
                    <Box key={root.id} className="forum-row">
                      <Box className="forum-row__main">
                        <Anchor component={Link} href={`/forum/${root.slug}`} className="forum-row__title">
                          {root.title}
                        </Anchor>
                        {root.description && (
                          <Text className="forum-row__description">{root.description}</Text>
                        )}
                        {/* Подразделы перечислены прямо в строке: человек
                            попадает в нужный сразу, без промежуточного
                            перехода — так же устроен drom. */}
                        {kids.length > 0 && (
                          <Box className="forum-row__children">
                            <Text component="span" className="forum-row__children-label">Подразделы: </Text>
                            {kids.map((kid, index) => (
                              <span key={kid.id}>
                                <Anchor component={Link} href={`/forum/${kid.slug}`} className="forum-row__child">
                                  {kid.title}
                                </Anchor>
                                {index < kids.length - 1 && <span className="forum-row__child-sep">, </span>}
                              </span>
                            ))}
                          </Box>
                        )}
                      </Box>

                      <Box className="forum-row__stats">
                        <Text className="forum-row__stat">
                          <span className="forum-row__stat-label">Тем: </span>
                          {total?.topics || 0}
                        </Text>
                        <Text className="forum-row__stat forum-row__stat--muted">
                          <span className="forum-row__stat-label">Сообщений: </span>
                          {total?.posts || 0}
                        </Text>
                      </Box>

                      <Box className="forum-row__last">
                        {total?.lastPostAt ? (
                          <Group gap={4} wrap="nowrap">
                            <IconMessages size={12} color="var(--market-muted)" />
                            <Text className="forum-row__last-date">{formatAdminDateTimeShort(total.lastPostAt)}</Text>
                          </Group>
                        ) : (
                          /* Пустой раздел не зовёт «напишите первым»: строка
                             приглашения в каждой из сотни строк делает форум
                             похожим на заброшенный. */
                          <Text className="forum-row__last-date forum-row__last-date--empty">—</Text>
                        )}
                      </Box>
                    </Box>
                  )
                })}
              </Stack>
            </Card>
          )
        })}
      </Stack>
    </Container>
  )
}
