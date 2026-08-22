"use client"

import { useState } from "react"
import useSWR, { mutate as globalMutate } from "swr"
import { useSession } from "next-auth/react"
import { Box, Stack, Text, Group, Center, Loader, Card, ThemeIcon, Avatar, Textarea, Button, Anchor, Breadcrumbs, Image, Badge, Blockquote } from "@mantine/core"
import { IconNews, IconClock, IconMessageCircle2, IconEye, IconSend, IconBrandTelegram, IconQuote, IconShieldCheck } from "@tabler/icons-react"
import Link from "next/link"
import { formatRelativeDate, formatDate } from "@/lib/format"
import { newsHref } from "@/lib/news"
import { fetchJson, getApiClientErrorMessage } from "@/lib/api-client"
import { AsyncErrorState } from "@/components/ui/AsyncStates"
import { notifications } from "@mantine/notifications"
import { cleanNewsArticleContent, extractNewsHashtags, extractTelegramActions, LEGACY_VEHICLE_CHECK_TELEGRAM_URL, readNewsContentMetadata, safeTelegramUrl, type NewsTelegramAction } from "@/lib/news-content"
import styles from "./news-article.module.css"
import ShareButtons from "@/components/news/ShareButtons"

export type NewsComment = {
  id: string
  content: string
  createdAt: string
  user: { id: string; name: string | null; image: string | null } | null
}

export type NewsArticle = {
  id: string
  title: string
  content: string
  imageUrl: string | null
  sourceChannel: string | null
  sourceUrl: string | null
  telegramUrl: string | null
  tags: string | null
  publishedAt: string
  views: number
  comments: NewsComment[]
}

type RelatedNews = {
  id: string
  title: string
  slug: string | null
  publishedAt: string
}

type RelatedNewsResponse = { news: RelatedNews[] }

function renderInlineMarkdown(value: string) {
  return value.split(/(\*\*[^*]+\*\*)/g).map((fragment, index) => {
    if (fragment.startsWith("**") && fragment.endsWith("**")) {
      return <strong key={`${fragment}-${index}`}>{fragment.slice(2, -2)}</strong>
    }
    return fragment
  })
}

function normalizeNewsContent(content: string, title: string) {
  let normalized = cleanNewsArticleContent(content.replace(/<\/?(?:b|strong)>/gi, "**"))

  const escapedTitle = title.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  if (escapedTitle) normalized = normalized.replace(new RegExp(`^${escapedTitle}(?:[.!…—:-]+)?\\s*`, "i"), "")

  // Source widgets and subscription prompts do not form part of the article.
  normalized = normalized.replace(/\s*РЕСУРСНЫЙ ТЕСТ МОТОРНЫХ МАСЕЛ[\s\S]*?СМОТРЕТЬ РЕЗУЛЬТАТЫ ТЕСТА\s*/gi, " ")
  normalized = normalized.replace(/\s*Понравилась публикация\?[\s\S]*$/i, "")
  return normalized.trim()
}

function splitLongParagraph(value: string) {
  if (value.length <= 520 || /\n/.test(value)) return [value]
  const sentences = value.match(/[^.!?…]+(?:[.!?…]+[»”"]?\s*|$)/g)?.map((sentence) => sentence.trim()).filter(Boolean) || [value]
  const result: string[] = []
  let current = ""
  let sentenceCount = 0

  for (const sentence of sentences) {
    const shouldSplit = current && (current.length + sentence.length + 1 > 460 || sentenceCount >= 3)
    if (shouldSplit) {
      result.push(current)
      current = ""
      sentenceCount = 0
    }
    current = current ? `${current} ${sentence}` : sentence
    sentenceCount += 1
  }
  if (current) result.push(current)
  return result
}

function NewsBody({ content, title }: { content: string; title: string }) {
  const paragraphs = normalizeNewsContent(content, title)
    .split(/\n\s*\n/)
    .map((item) => item.trim())
    .filter(Boolean)
    .flatMap((item) => /^(?:🧠\s*)?мнение\s+редакции\s*[:—-]/i.test(item) ? [item] : splitLongParagraph(item))

  return (
    <Stack className={styles.content} gap="md">
      {paragraphs.map((paragraph, index) => {
        const editorialOpinion = paragraph.match(/^(?:🧠\s*)?мнение\s+редакции\s*[:—-]\s*([\s\S]+)$/i)
        if (editorialOpinion) {
          const quote = editorialOpinion[1].trim().replace(/^[«“"]+|[»”"]+$/g, "").trim()
          return (
            <Blockquote
              key={`editorial-opinion-${index}`}
              className={styles.editorialOpinion}
              color="indigo"
              icon={<IconQuote size={22} />}
              cite="Редакция Авторынка"
            >
              {renderInlineMarkdown(quote)}
            </Blockquote>
          )
        }
        const lines = paragraph.split("\n").map((line) => line.trim()).filter(Boolean)
        const isList = lines.length > 0 && lines.every((line) => /^(?:[-•*]|\d+[.)])\s+/.test(line))
        if (isList) {
          return <Box component="ul" className={styles.list} key={`${paragraph.slice(0, 24)}-${index}`}>{lines.map((line, lineIndex) => <li key={`${line}-${lineIndex}`}>{renderInlineMarkdown(line.replace(/^(?:[-•*]|\d+[.)])\s+/, ""))}</li>)}</Box>
        }
        return <Text component="p" className={index === 0 ? styles.lead : styles.paragraph} key={`${paragraph.slice(0, 24)}-${index}`}>{lines.map((line, lineIndex) => <span key={`${line}-${lineIndex}`}>{renderInlineMarkdown(line)}{lineIndex < lines.length - 1 && <br />}</span>)}</Text>
      })}
    </Stack>
  )
}

function telegramChannelUrl(sourceChannel?: string | null) {
  const channel = sourceChannel?.replace(/^@/, "").trim()
  return channel && /^[a-zA-Z0-9_]{5,64}$/.test(channel) ? `https://t.me/${channel}` : null
}

function articleTelegramActions(article: NewsArticle, storedActions: NewsTelegramAction[]) {
  const actions = [...storedActions, ...extractTelegramActions(article.content)]
  const channelUrl = telegramChannelUrl(article.sourceChannel)
  const isOneCarNews = article.sourceChannel?.replace(/^@/, "").toLowerCase() === "onecarnews"
  if (channelUrl && !actions.some((action) => action.kind === "channel")) {
    actions.unshift({ kind: "channel", label: "Подписаться на канал", url: channelUrl })
  }
  if ((isOneCarNews || /^(?:\s*)проверка\s+авто(?:мобиля)?\s*[.!…]*(?:\s*)$/im.test(article.content)) && !actions.some((action) => action.kind === "vehicle-check")) {
    actions.push({ kind: "vehicle-check", label: "Проверка авто", url: LEGACY_VEHICLE_CHECK_TELEGRAM_URL })
  }

  const seen = new Set<string>()
  return actions.filter((action) => {
    if (seen.has(action.url)) return false
    seen.add(action.url)
    return true
  }).slice(0, 4)
}

export default function NewsDetailClient({ id, initialArticle }: { id: string; initialArticle: NewsArticle }) {
  const { data: session } = useSession()
  const [comment, setComment] = useState("")
  const [sending, setSending] = useState(false)

  const { data: liveArticle, error: articleError, isLoading, mutate } = useSWR<NewsArticle>(`/api/news/${id}`, fetchJson, {
    fallbackData: initialArticle,
    revalidateOnMount: true,
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  })
  const article = liveArticle || initialArticle
  const { data: relatedData } = useSWR<RelatedNewsResponse>("/api/news?limit=4", fetchJson, { revalidateOnFocus: false })
  const relatedNews = (relatedData?.news || []).filter((news) => news.id !== article?.id).slice(0, 3)

  const submitComment = async () => {
    if (!comment.trim() || !session) return
    setSending(true)
    try {
      const createdComment = await fetchJson<NewsComment>(`/api/news/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: comment.trim() }),
      })
      setComment("")
      await globalMutate<NewsArticle>(`/api/news/${id}`, (current) => current ? {
        ...current,
        comments: [createdComment, ...current.comments],
      } : current, { revalidate: false })
      notifications.show({ title: "Комментарий опубликован", message: "Он уже виден под новостью.", color: "teal" })
    } catch (commentError) {
      notifications.show({ title: "Не удалось отправить", message: getApiClientErrorMessage(commentError, "Повторите попытку."), color: "red" })
    } finally { setSending(false) }
  }

  if (isLoading && !article) return <Center py={60}><Loader color="indigo" /></Center>
  if (articleError) return <Box p={{ base: "sm", md: "xl" }} maw={840} mx="auto"><AsyncErrorState title="Не удалось открыть новость" description="Материал временно недоступен. Повторите попытку." onRetry={() => void mutate()} backHref="/news" /></Box>
  if (!article) return <Center py={60}><Text c="gray.5">Новость не найдена</Text></Center>
  const metadata = readNewsContentMetadata(article.tags)
  const tags = extractNewsHashtags(article.content, metadata.tags)
  const telegramActions = articleTelegramActions(article, metadata.telegramActions)
  const telegramPostUrl = article.telegramUrl ? safeTelegramUrl(article.telegramUrl) : null

  return (
    <Box p={{ base: "sm", md: "xl" }} style={{ maxWidth: 840, margin: "0 auto" }}>
      <Stack gap="md">
        <Breadcrumbs separator="›">
          <Anchor component={Link} href="/" size="xs" c="gray.5">Главная</Anchor>
          <Anchor component={Link} href="/news" size="xs" c="gray.5">Новости</Anchor>
        </Breadcrumbs>

        <Stack gap="xs">
          {article.sourceChannel && <Badge w="fit-content" size="sm" variant="light" color="indigo">Редакция @{article.sourceChannel}</Badge>}
          <Text component="h1" ff="var(--font-display),sans-serif" c="var(--market-ink)">
            {article.title}
          </Text>
          <Group gap="md">
            <Group gap={3}><IconClock size={13} color="gray.4" /><Text size="xs" c="gray.5">{formatDate(article.publishedAt)}</Text></Group>
            <Group gap={3}><IconEye size={13} color="gray.4" /><Text size="xs" c="gray.5">{article.views} просмотров</Text></Group>
            <Group gap={3}><IconMessageCircle2 size={13} color="gray.4" /><Text size="xs" c="gray.5">{article.comments?.length || 0} комментариев</Text></Group>
          </Group>
        </Stack>

        <Box className={`${styles.body} news-article__body`}>
          {article.imageUrl && <Image src={article.imageUrl} alt={article.title} className="news-article__image" mb="lg" fit="cover" fallbackSrc="/images/home/hero-marketplace.png" />}
          <NewsBody content={article.content || ""} title={article.title} />
          {tags.length > 0 && (
            <Stack gap="xs" mt="xl">
              <Text size="xs" fw={700} tt="uppercase" c="dimmed" lts="0.05em">Темы материала</Text>
              <Group gap="xs">
                {tags.map((tag) => <Badge key={tag.toLocaleLowerCase("ru")} variant="light" color="indigo" radius="md" size="md">#{tag.replace(/^#/, "")}</Badge>)}
              </Group>
            </Stack>
          )}
          {(telegramActions.length > 0 || telegramPostUrl) && (
            <Stack className={styles.telegramPanel} gap="sm" mt="xl">
              <Group gap="sm" wrap="nowrap">
                <ThemeIcon size={38} radius="xl" color="blue"><IconBrandTelegram size={21} /></ThemeIcon>
                <Box>
                  <Text fw={750} size="sm">Продолжить в Telegram</Text>
                  <Text size="xs" c="dimmed">Канал редакции и сервисы для автомобилистов</Text>
                </Box>
              </Group>
              <Group gap="sm">
                {telegramActions.map((action) => (
                  <Button
                    component="a"
                    href={action.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    key={`${action.kind}-${action.url}`}
                    variant={action.kind === "channel" ? "filled" : "light"}
                    color={action.kind === "channel" ? "blue" : "indigo"}
                    leftSection={action.kind === "vehicle-check" ? <IconShieldCheck size={18} /> : <IconBrandTelegram size={18} />}
                    radius="md"
                  >
                    {action.kind === "vehicle-check" ? "Проверить автомобиль" : "Подписаться на канал"}
                  </Button>
                ))}
                {telegramPostUrl && !telegramActions.some((action) => action.url === telegramPostUrl) && (
                  <Button component="a" href={telegramPostUrl} target="_blank" rel="noopener noreferrer" variant="subtle" color="blue" leftSection={<IconBrandTelegram size={18} />} radius="md">
                    Открыть публикацию
                  </Button>
                )}
              </Group>
            </Stack>
          )}
        </Box>

        {/* Поделиться — перед комментариями: человек, дочитавший новость,
            скорее отправит её знакомому, чем напишет отзыв. */}
        <ShareButtons title={article.title} />

        <Stack gap="sm">
          <Text size="sm" fw={600} c="var(--market-ink)">Комментарии ({article.comments?.length || 0})</Text>
          {session ? (
            <Card withBorder radius="md" p="sm" style={{ borderColor: "var(--mantine-color-border)" }}>
              <Stack gap="xs">
                <Textarea placeholder="Ваш комментарий..." value={comment} onChange={(e) => setComment(e.currentTarget.value)} minRows={2} size="sm" radius="md" />
                <Group justify="flex-end"><Button size="xs" color="indigo" radius="md" leftSection={<IconSend size={14} />} onClick={submitComment} loading={sending} disabled={!comment.trim()}>Отправить</Button></Group>
              </Stack>
            </Card>
          ) : (
            <Card withBorder radius="md" p="sm" style={{ borderColor: "var(--mantine-color-border)" }}>
              <Text size="xs" c="gray.5" ta="center"><Anchor component={Link} href="/auth/signin" size="xs" c="indigo">Войдите</Anchor> чтобы оставить комментарий</Text>
            </Card>
          )}

          {article.comments.map((commentItem) => (
            <Card key={commentItem.id} withBorder radius="md" p="sm" style={{ borderColor: "var(--mantine-color-border)" }}>
              <Group gap="sm" align="flex-start">
                <Avatar src={commentItem.user?.image} size="sm" radius="xl" color="indigo">{commentItem.user?.name?.[0]?.toUpperCase()}</Avatar>
                <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                  <Group gap="xs"><Text size="xs" fw={600} c="var(--market-ink)">{commentItem.user?.name || "Аноним"}</Text><Text size="10px" c="gray.4">{formatRelativeDate(commentItem.createdAt)}</Text></Group>
                  <Text size="xs" c="gray.6" lh={1.5}>{commentItem.content}</Text>
                </Stack>
              </Group>
            </Card>
          ))}

          {relatedNews.length > 0 && (
            <Stack gap="sm" mt="sm">
              <Text size="sm" fw={600} c="var(--market-ink)">Читайте также</Text>
              {relatedNews.map((news) => (
                <Link key={news.id} href={newsHref(news)} style={{ textDecoration: "none" }}>
                  {/* Индиговая рамка при наведении описана в CSS: из JS она ставилась
                      фиксированным #1c4291 и в тёмной теме уходила в почти чёрный. */}
                  <Card withBorder radius="md" p="sm" className="market-linked-card market-linked-card--flat">
                    <Group gap="sm" align="flex-start">
                      <ThemeIcon variant="light" color="indigo" size={32} radius="md"><IconNews size={18} /></ThemeIcon>
                      <Stack gap={2} style={{ flex: 1 }}>
                        <Text size="sm" fw={600} c="var(--market-ink)" style={{ overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{news.title}</Text>
                        <Group gap={4}><IconClock size={11} color="gray.4" /><Text size="10px" c="gray.4">{formatRelativeDate(news.publishedAt)}</Text></Group>
                      </Stack>
                    </Group>
                  </Card>
                </Link>
              ))}
            </Stack>
          )}
        </Stack>
      </Stack>
    </Box>
  )
}
