import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Anchor, Avatar, Badge, Box, Breadcrumbs, Button, Card, Container, Group, Stack, Text, Title } from "@mantine/core"
import { IconMessage, IconMessageCircle2, IconStar, IconTrophy } from "@tabler/icons-react"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { stripForumMarkup } from "@/lib/forum-markup"
import { pluralTimes, reputationRank } from "@/lib/forum-reputation"
import { formatAdminDateTimeShort } from "@/lib/admin-datetime"

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ name: string }> }

/**
 * Страница участника форума.
 *
 * Ответ «у меня так же было» значит разное от владельца той же машины и
 * от постороннего. Профиль показывает, кто отвечает: сколько написал,
 * сколько раз помог, с какого года здесь.
 *
 * Адрес — имя из @упоминания: разметка строит ссылку по нему, и заводить
 * отдельный опознаватель значит поддерживать два адреса одного человека.
 */

/** Ищет участника по имени из адреса. */
async function findMember(rawName: string) {
  const name = decodeURIComponent(rawName).trim()
  if (!name || name.length > 60) return null

  return prisma.user.findFirst({
    where: { name },
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
  })
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { name } = await params
  const member = await findMember(name)
  if (!member) return { title: "Участник не найден — форум LeWheel" }

  const rank = reputationRank(member.forumReputation)
  return {
    title: `${member.name} — участник форума LeWheel`,
    description: rank
      ? `${member.name}: ${rank}, ${member.forumPostCount} сообщений на форуме автолюбителей LeWheel.`
      : `${member.name} на форуме автолюбителей LeWheel.`,
  }
}

export default async function ForumMemberPage({ params }: Props) {
  const { name } = await params
  const member = await findMember(name)
  if (!member) notFound()

  /* Кнопка «написать» нужна вошедшему и не самому себе: писать себе
     некуда, а гостю кнопка предложила бы вход ради действия, которого он
     ещё не хотел. */
  const session = await getServerSession(authOptions)
  const canWrite = Boolean(session?.user?.id) && session?.user?.id !== member.id

  /* Последние ответы, а не все: страница участника нужна, чтобы понять,
     о чём человек говорит и насколько по делу, и десяти сообщений для
     этого достаточно. */
  const posts = await prisma.forumPost.findMany({
    where: { authorId: member.id, deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      content: true,
      createdAt: true,
      isBestAnswer: true,
      topic: { select: { title: true, slug: true, section: { select: { slug: true } } } },
    },
  })

  const rank = reputationRank(member.forumReputation)

  return (
    <Container size="md" py={{ base: "md", md: "xl" }}>
      <Stack gap="md">
        <Breadcrumbs separator="›">
          <Anchor component={Link} href="/forum" size="xs" c="var(--market-muted)">Форум</Anchor>
          <Text size="xs" c="var(--market-muted)">Участники</Text>
        </Breadcrumbs>

        <Card withBorder radius="md" p="md">
          <Group gap="md" align="flex-start" wrap="nowrap">
            <Avatar src={member.image} size={64} radius="xl" color="indigo">
              {(member.name || "У").slice(0, 1).toUpperCase()}
            </Avatar>

            <Box style={{ minWidth: 0, flex: 1 }}>
              <Group gap={8} wrap="wrap" align="center">
                <Title order={1} fz={{ base: 18, md: 22 }} ff="var(--font-display),sans-serif" c="var(--market-ink)">
                  {member.name || "Участник"}
                </Title>
                {rank && <Badge size="sm" variant="light" color="indigo">{rank}</Badge>}
              </Group>

              <Text size="xs" c="var(--market-muted)" mt={4}>
                На форуме с {formatAdminDateTimeShort(member.createdAt)}
              </Text>

              {/* Подпись — обычный текст: она видна под каждым сообщением,
                  и разметка со ссылкой в ней это реклама на всю площадку. */}
              {member.forumSignature && (
                <Text size="sm" mt={8} c="var(--market-ink)">{member.forumSignature}</Text>
              )}

              {/* Написать человеку — то, ради чего его и ищут на форуме:
                  дельный ответ рождает вопрос, который в теме задавать
                  незачем. */}
              {canWrite && (
                <Button
                  component={Link}
                  href={`/messages/new?recipientId=${encodeURIComponent(member.id)}`}
                  variant="light"
                  color="indigo"
                  size="compact-sm"
                  mt={10}
                  leftSection={<IconMessage size={14} />}
                >
                  Написать
                </Button>
              )}

              <Group gap="lg" mt={12} wrap="wrap">
                <Group gap={5}>
                  <IconMessageCircle2 size={15} color="var(--market-muted)" />
                  <Text size="sm" c="var(--market-ink)" fw={600}>{member.forumPostCount}</Text>
                  <Text size="xs" c="var(--market-muted)">сообщений</Text>
                </Group>

                {member.forumBestAnswers > 0 && (
                  <Group gap={5}>
                    <IconTrophy size={15} color="var(--mantine-color-teal-6)" />
                    <Text size="sm" c="var(--market-ink)" fw={600}>помог {pluralTimes(member.forumBestAnswers)}</Text>
                  </Group>
                )}

                {member.forumReputation > 0 && (
                  <Group gap={5}>
                    <IconStar size={15} color="var(--market-muted)" />
                    <Text size="sm" c="var(--market-ink)" fw={600}>{member.forumReputation}</Text>
                    <Text size="xs" c="var(--market-muted)">репутация</Text>
                  </Group>
                )}
              </Group>
            </Box>
          </Group>
        </Card>

        <Box>
          <Text fw={700} fz="sm" c="var(--market-ink)" mb="xs">Последние сообщения</Text>

          {posts.length === 0 ? (
            <Card withBorder radius="md" p="sm">
              <Text size="sm" c="var(--market-muted)">Пока ничего не написал.</Text>
            </Card>
          ) : (
            <Stack gap="xs">
              {posts.map((post) => (
                <Card key={post.id} withBorder radius="md" p="sm">
                  <Group gap={6} wrap="wrap" mb={4}>
                    <Anchor
                      component={Link}
                      href={`/forum/${post.topic.section.slug}/${post.topic.slug}`}
                      size="sm"
                      fw={600}
                    >
                      {post.topic.title}
                    </Anchor>
                    {post.isBestAnswer && (
                      <Badge size="xs" variant="light" color="teal">Решило вопрос</Badge>
                    )}
                    <Text fz="xs" c="var(--market-muted)">{formatAdminDateTimeShort(post.createdAt)}</Text>
                  </Group>

                  {/* Отрывок без разметки: пометки Markdown в списке
                      выглядят мусором, а картинки и таблицы здесь не к
                      месту — за ними человек идёт в саму тему. */}
                  <Text size="sm" c="var(--market-muted)" lineClamp={2}>
                    {stripForumMarkup(post.content)}
                  </Text>
                </Card>
              ))}
            </Stack>
          )}
        </Box>
      </Stack>
    </Container>
  )
}
