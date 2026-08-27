import type { Metadata } from "next"
import Link from "next/link"
import { Anchor, Avatar, Badge, Box, Breadcrumbs, Card, Container, Group, Stack, Text, Title } from "@mantine/core"
import { prisma } from "@/lib/prisma"
import { pluralTimes, reputationRank } from "@/lib/forum-reputation"
import { formatAdminDateTimeShort } from "@/lib/admin-datetime"

export const dynamic = "force-dynamic"

const PER_PAGE = 30

export const metadata: Metadata = {
  title: "Участники форума — LeWheel",
  description: "Кто отвечает на форуме автолюбителей LeWheel: опытные владельцы, механики, те, кто уже прошёл через это.",
}

type Props = { searchParams: Promise<{ page?: string }> }

/**
 * Список участников форума.
 *
 * Показывает, кто здесь отвечает: на форуме о технике это решает, стоит
 * ли доверять совету. Пустая площадка без единого имени выглядит
 * заброшенной, даже когда на ней есть готовые разборы.
 *
 * Порядок по репутации, а не по дате регистрации: список нужен, чтобы
 * найти знающих, а не всех подряд.
 */
export default async function ForumMembersPage({ searchParams }: Props) {
  const { page: pageParam } = await searchParams
  const page = Math.max(1, Math.min(100, Number.parseInt(pageParam || "1", 10) || 1))

  /* Только писавшие: список из ста тысяч учётных записей, из которых на
     форуме были трое, не говорит ничего. */
  const where = { forumPostCount: { gt: 0 } }

  const [members, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: [{ forumReputation: "desc" }, { forumPostCount: "desc" }],
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: {
        id: true,
        name: true,
        image: true,
        createdAt: true,
        forumReputation: true,
        forumBestAnswers: true,
        forumPostCount: true,
        forumSignature: true,
      },
    }),
    prisma.user.count({ where }),
  ])

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))

  return (
    <Container size="md" py={{ base: "md", md: "xl" }}>
      <Stack gap="md">
        <Breadcrumbs separator="›">
          <Anchor component={Link} href="/forum" size="xs" c="var(--market-muted)">Форум</Anchor>
          <Text size="xs" c="var(--market-muted)">Участники</Text>
        </Breadcrumbs>

        <Box>
          <Title order={1} fz={{ base: 22, md: 28 }} ff="var(--font-display),sans-serif" c="var(--market-ink)">
            Участники форума
          </Title>
          <Text size="sm" c="var(--market-muted)" mt={4}>
            {total > 0
              ? `${total} человек уже отвечали на вопросы. Сначала те, кто помог больше всех.`
              : "Пока никто не писал. Задайте вопрос — и разговор начнётся."}
          </Text>
        </Box>

        {members.length > 0 && (
          <Stack gap={6}>
            {members.map((member) => {
              const rank = reputationRank(member.forumReputation)
              return (
                <Card
                  key={member.id}
                  component={Link}
                  href={`/forum/users/${encodeURIComponent(member.name || "")}`}
                  withBorder
                  radius="md"
                  p="sm"
                  className="forum-topic-row"
                >
                  <Group gap="sm" wrap="nowrap" align="center">
                    <Avatar src={member.image} size={38} radius="xl" color="indigo">
                      {(member.name || "У").slice(0, 1).toUpperCase()}
                    </Avatar>

                    <Box style={{ minWidth: 0, flex: 1 }}>
                      <Group gap={6} wrap="wrap">
                        <Text fw={700} fz="sm" c="var(--market-ink)">{member.name || "Участник"}</Text>
                        {rank && <Badge size="xs" variant="light" color="indigo">{rank}</Badge>}
                        {member.forumBestAnswers > 0 && (
                          <Text fz="xs" c="var(--mantine-color-teal-7)">
                            помог {pluralTimes(member.forumBestAnswers)}
                          </Text>
                        )}
                      </Group>

                      {/* Подпись вместо даты регистрации: «Haval Jolion
                          2023, Москва» говорит о человеке больше, чем то,
                          что он здесь с прошлого года. */}
                      <Text fz="xs" c="var(--market-muted)" mt={2} lineClamp={1}>
                        {member.forumSignature || `На форуме с ${formatAdminDateTimeShort(member.createdAt)}`}
                      </Text>
                    </Box>

                    <Box style={{ flexShrink: 0, textAlign: "right" }}>
                      <Text fz="sm" fw={600} c="var(--market-ink)">{member.forumPostCount}</Text>
                      <Text fz={11} c="var(--market-muted)">сообщений</Text>
                    </Box>
                  </Group>
                </Card>
              )
            })}
          </Stack>
        )}

        {totalPages > 1 && (
          <Group justify="center" gap="xs">
            {page > 1 && (
              <Anchor component={Link} href={`/forum/users?page=${page - 1}`} size="sm">Назад</Anchor>
            )}
            <Text size="sm" c="var(--market-muted)">Страница {page} из {totalPages}</Text>
            {page < totalPages && (
              <Anchor component={Link} href={`/forum/users?page=${page + 1}`} size="sm">Дальше</Anchor>
            )}
          </Group>
        )}
      </Stack>
    </Container>
  )
}
