import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Anchor, Avatar, Badge, Box, Breadcrumbs, Card, Container, Group, Stack, Text, Title } from "@mantine/core"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { pluralReplies, POSTS_PER_PAGE } from "@/lib/forum"
import { renderForumMarkup, stripForumMarkup } from "@/lib/forum-markup"
import { formatAdminDateTimeShort } from "@/lib/admin-datetime"
import PostBody from "@/components/forum/PostBody"
import PollBlock from "@/components/forum/PollBlock"
import PostActions from "@/components/forum/PostActions"
import { canMarkBestAnswer, canReactToPost, pluralTimes, reputationRank } from "@/lib/forum-reputation"
import { canEditPost } from "@/lib/forum"
import { loadPostReactions } from "@/lib/forum-reputation-store"
import { canReportPost } from "@/lib/forum-reports"
import { isSubscribed } from "@/lib/forum-subscriptions"
import SubscribeButton from "@/components/forum/SubscribeButton"
import TopicModeration from "@/components/forum/TopicModeration"
import { isModerator } from "@/lib/permissions"
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
  const excerpt = stripForumMarkup(topic.posts[0]?.content || "").slice(0, 155)

  return {
    title: `${topic.title} — ${topic.section.title} — форум LeWheel`,
    description: excerpt || `Обсуждение «${topic.title}» на форуме автолюбителей LeWheel.`,
  }
}

export default async function ForumTopicPage({ params, searchParams }: Props) {
  const { section: sectionSlug, topic: topicSlugParam } = await params
  const { page: pageParam } = await searchParams
  const page = Math.max(1, Number.parseInt(pageParam || "1", 10) || 1)

  /* Сессия нужна ради опроса: показать человеку его собственный голос
     можно, только зная, кто он. Гостю опрос виден, но без голосования. */
  const session = await getServerSession(authOptions)
  const viewerId = session?.user?.id ?? null

  const topic = await prisma.forumTopic.findFirst({
    where: { slug: topicSlugParam, deletedAt: null },
    select: {
      id: true, title: true, isClosed: true, isPinned: true, replyCount: true, createdAt: true, authorId: true,
      author: { select: { name: true, image: true } },
      section: { select: { slug: true, title: true } },
      poll: {
        select: {
          id: true, question: true, multiple: true, closesAt: true,
          options: { select: { id: true, text: true, votes: true }, orderBy: { position: "asc" } },
          /* Только свои голоса: чужие здесь не нужны, а выбирать их все
             значит тянуть с базы список на тысячу строк ради одной
             галочки. */
          votes: viewerId
            ? { where: { userId: viewerId }, select: { optionId: true } }
            : false,
        },
      },
    },
  })
  if (!topic || topic.section.slug !== sectionSlug) notFound()

  const posts = await prisma.forumPost.findMany({
    where: { topicId: topic.id },
    orderBy: { createdAt: "asc" },
    skip: (page - 1) * POSTS_PER_PAGE,
    take: POSTS_PER_PAGE,
    select: {
      id: true, content: true, createdAt: true, deletedAt: true, authorId: true, isBestAnswer: true, editedAt: true,
      author: { select: { id: true, name: true, image: true, forumReputation: true, forumBestAnswers: true, forumPostCount: true, forumSignature: true } },
    },
  })

  /* Реакции всей страницы одним запросом: двадцать сообщений это
     двадцать обращений к базе там, где хватает одного. */
  const reactions = await loadPostReactions(posts.map((post) => post.id), viewerId)

  /* Состояние подписки: кнопка должна показывать, включены ли уже
     уведомления, иначе человек подписывается повторно и отписывается. */
  const subscribed = await isSubscribed(topic.id, viewerId)

  /* Разделы для переноса тянутся только модератору: сотня строк в
     выпадающем списке не нужна тем, кто просто читает тему. */
  const isModer = isModerator(session?.user?.role)
  const sections = isModer
    ? await prisma.forumSection.findMany({
        orderBy: [{ groupKey: "asc" }, { position: "asc" }],
        select: { slug: true, title: true },
      })
    : []

  /* Просмотр считается без ожидания ответа: задержка страницы ради
     счётчика не оправдана, а потеря одного просмотра при сбое не важна. */
  void prisma.forumTopic.update({ where: { id: topic.id }, data: { views: { increment: 1 } } }).catch(() => {})

  const totalPages = Math.max(1, Math.ceil((topic.replyCount + 1) / POSTS_PER_PAGE))

  /* Номер сообщения в теме, а не на странице: на него ссылаются в
     разговоре («смотри #12»), и нумерация, начинающаяся заново на каждой
     странице, такую ссылку сделала бы бессмысленной. */
  const firstPostNumber = (page - 1) * POSTS_PER_PAGE + 1

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

          {/* Подписка под заголовком: её включают, прочитав первое
              сообщение и решив, что тема стоит внимания. */}
          {viewerId && (
            <Box mt={8}>
              <SubscribeButton topicId={topic.id} initialSubscribed={subscribed} />
            </Box>
          )}

          {/* Действия модератора отдельной строкой под подпиской: они
              нужны редко, и мешать их с кнопкой читателя значит путать
              обоих. */}
          {isModer && (
            <Box mt={6}>
              <TopicModeration
                topicId={topic.id}
                isPinned={topic.isPinned}
                isClosed={topic.isClosed}
                sections={sections.map((item) => ({ value: item.slug, label: item.title }))}
              />
            </Box>
          )}
        </Box>

        {/* Опрос над обсуждением и только на первой странице: он относится
            к теме целиком, а не к сообщению, и на пятой странице ответов
            выглядел бы вставкой посреди разговора. */}
        {topic.poll && page === 1 && (
          <PollBlock
            canVote={Boolean(viewerId)}
            poll={{
              id: topic.poll.id,
              question: topic.poll.question,
              multiple: topic.poll.multiple,
              closesAt: topic.poll.closesAt ? topic.poll.closesAt.toISOString() : null,
              options: topic.poll.options,
              myVotes: (topic.poll.votes || []).map((vote) => vote.optionId),
            }}
          />
        )}

        <Stack gap="xs">
          {posts.map((post, index) => (
            /* Лучший ответ выделен рамкой: человек, пришедший из
               поиска, должен найти его, не читая сорок сообщений. */
            <Card key={post.id} withBorder radius="md" p="sm"
              id={`post-${post.id}`}
              className={post.isBestAnswer ? "forum-post-card forum-post-card--best" : "forum-post-card"}>
              <Group gap="sm" align="flex-start" wrap="nowrap">
                <Avatar src={post.author.image} size={34} radius="xl" color="indigo">
                  {(post.author.name || "У").slice(0, 1).toUpperCase()}
                </Avatar>
                <Box style={{ minWidth: 0, flex: 1 }}>
                  <Group gap={6} wrap="wrap">
                    {/* Имя ведёт на профиль: увидев дельный ответ, читатель
                        первым делом хочет понять, кто это написал. */}
                    {post.author.name ? (
                      <Anchor
                        component={Link}
                        href={`/forum/users/${encodeURIComponent(post.author.name)}`}
                        fw={700}
                        fz="xs"
                        c="var(--market-ink)"
                        underline="hover"
                      >
                        {post.author.name}
                      </Anchor>
                    ) : (
                      <Text fw={700} fz="xs" c="var(--market-ink)">Участник</Text>
                    )}
                    {/* Звание вместо голого числа очков: «Знаток» говорит
                        читателю больше, чем «240», а разбираться в шкале
                        ради чужого ответа никто не станет. Ниже десяти
                        очков подписи нет — новичок её не заслужил, а
                        «Новичок» читается хуже пустоты. */}
                    {reputationRank(post.author.forumReputation) && (
                      <Badge size="xs" variant="light" color="indigo">
                        {reputationRank(post.author.forumReputation)}
                      </Badge>
                    )}
                    {post.author.forumPostCount > 0 && (
                      <Text fz="xs" c="var(--market-muted)" title="Сообщений на форуме">
                        {post.author.forumPostCount} сообщ.
                      </Text>
                    )}
                    {post.author.forumBestAnswers > 0 && (
                      <Text fz="xs" c="var(--mantine-color-teal-7)" title="Ответов, решивших вопрос">
                        помог {pluralTimes(post.author.forumBestAnswers)}
                      </Text>
                    )}
                    <Text fz="xs" c="var(--market-muted)">{formatAdminDateTimeShort(post.createdAt)}</Text>
                    {/* Номер сообщения ссылкой на само сообщение: в длинной
                        ветке на ответ ссылаются («смотри #12»), и без
                        такой ссылки остаётся пересказывать своими словами. */}
                    <Anchor
                      href={`#post-${post.id}`}
                      fz="xs"
                      c="var(--market-muted)"
                      underline="hover"
                      title="Ссылка на это сообщение"
                    >
                      #{firstPostNumber + index}
                    </Anchor>
                  </Group>
                  {/* Удалённое сообщение оставляет пометку: без неё ответы на
                      него теряют смысл, а разговор — нить. */}
                  {post.deletedAt ? (
                    <Text size="sm" mt={4} c="var(--market-muted)" fs="italic">
                      Сообщение удалено модератором
                    </Text>
                  ) : (
                    /* Разметка собрана на сервере: всё постороннее
                       экранировано, наружу выходят только разрешённые
                       конструкции — см. lib/forum-markup.ts. Вывод
                       отдельным компонентом ради спойлеров: на телефоне
                       нет наведения, и без обработчика нажатия скрытый
                       ответ остался бы скрытым навсегда. */
                    <PostBody html={renderForumMarkup(post.content)} mt={4} />
                  )}

                  {/* Подпись автора: чем ездит, чем занимается. Ответ «у
                      меня так же было» значит разное от владельца той же
                      машины и от постороннего. Мельче текста и отделена
                      чертой — она справка, а не часть разговора. */}
                  {!post.deletedAt && post.author.forumSignature && (
                    <Text fz={11} c="var(--market-muted)" mt={6} className="forum-signature">
                      {post.author.forumSignature}
                    </Text>
                  )}

                  {/* Под удалённым сообщением реакций нет: оценивать
                      пометку «удалено модератором» нечего. */}
                  {!post.deletedAt && (
                    <PostActions
                      postId={post.id}
                      authorName={post.author.name || "Участник"}
                      rawContent={post.content}
                      plainContent={stripForumMarkup(post.content)}
                      counts={reactions.get(post.id)?.counts || {}}
                      mine={reactions.get(post.id)?.mine || []}
                      canReact={canReactToPost({
                        postAuthorId: post.authorId,
                        viewerId,
                        postDeleted: false,
                      })}
                      /* Цитировать может любой вошедший, включая автора
                         сообщения: уточнять собственный ответ ссылкой на
                         его же кусок — обычное дело в длинной ветке. */
                      canQuote={Boolean(viewerId) && !topic.isClosed}
                      canEdit={canEditPost({
                        postAuthorId: post.authorId,
                        postCreatedAt: post.createdAt,
                        postDeleted: false,
                        topicClosed: topic.isClosed,
                        viewerId,
                      }).allowed}
                      canReport={canReportPost({
                        postAuthorId: post.authorId,
                        viewerId,
                        postDeleted: false,
                      })}
                      editedAt={post.editedAt ? formatAdminDateTimeShort(post.editedAt) : null}
                      isBestAnswer={post.isBestAnswer}
                      canMarkBest={canMarkBestAnswer({
                        topicAuthorId: topic.authorId,
                        postAuthorId: post.authorId,
                        viewerId,
                        postDeleted: false,
                      })}
                    />
                  )}
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
