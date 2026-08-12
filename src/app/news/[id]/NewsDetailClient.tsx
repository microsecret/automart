"use client"

import { useState } from "react"
import useSWR, { mutate as globalMutate } from "swr"
import { useSession } from "next-auth/react"
import { Box, Stack, Text, Group, Center, Loader, Card, ThemeIcon, Avatar, Textarea, Button, Anchor, Breadcrumbs, Image, Badge } from "@mantine/core"
import { IconNews, IconClock, IconMessageCircle2, IconExternalLink, IconEye, IconSend, IconBrandTelegram } from "@tabler/icons-react"
import Link from "next/link"
import { formatRelativeDate, formatDate } from "@/lib/format"
import { newsHref } from "@/lib/news"
import { fetchJson, getApiClientErrorMessage } from "@/lib/api-client"
import { AsyncErrorState } from "@/components/ui/AsyncStates"
import { notifications } from "@mantine/notifications"
import styles from "./news-article.module.css"

type NewsComment = {
  id: string
  content: string
  createdAt: string
  user: { id: string; name: string | null; image: string | null } | null
}

type NewsArticle = {
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
  let normalized = content
    .replace(/\r\n/g, "\n")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/?(?:b|strong)>/gi, "**")
    .replace(/<[^>]+>/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()

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
    .flatMap(splitLongParagraph)

  return (
    <Stack className={styles.content} gap="md">
      {paragraphs.map((paragraph, index) => {
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

function readTags(value?: string | null) {
  if (!value) return []
  try {
    const tags = JSON.parse(value)
    return Array.isArray(tags) ? tags.filter((tag) => typeof tag === "string").slice(0, 8) : []
  } catch {
    return []
  }
}

export default function NewsDetailClient({ id }: { id: string }) {
  const { data: session } = useSession()
  const [comment, setComment] = useState("")
  const [sending, setSending] = useState(false)

  const { data: article, error: articleError, isLoading, mutate } = useSWR<NewsArticle>(`/api/news/${id}`, fetchJson, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  })
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

  if (isLoading) return <Center py={60}><Loader color="indigo" /></Center>
  if (articleError) return <Box p={{ base: "sm", md: "xl" }} maw={840} mx="auto"><AsyncErrorState title="Не удалось открыть новость" description="Материал временно недоступен. Повторите попытку." onRetry={() => void mutate()} backHref="/news" /></Box>
  if (!article) return <Center py={60}><Text c="gray.5">Новость не найдена</Text></Center>
  const tags = readTags(article.tags)

  return (
    <Box p={{ base: "sm", md: "xl" }} style={{ maxWidth: 840, margin: "0 auto" }}>
      <Stack gap="md">
        <Breadcrumbs separator="›">
          <Anchor component={Link} href="/" size="xs" c="gray.5">Главная</Anchor>
          <Anchor component={Link} href="/news" size="xs" c="gray.5">Новости</Anchor>
        </Breadcrumbs>

        <Stack gap="xs">
          {article.sourceChannel && <Badge w="fit-content" size="sm" variant="light" color="indigo">Редакция @{article.sourceChannel}</Badge>}
          <Text component="h1" ff="var(--font-display),sans-serif" fw={800} fz={{ base: 24, md: 32 }} lh={1.16} c="dark.9">
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
            <Group gap="xs" mt="lg">
              {tags.map((tag: string) => <Badge key={tag} variant="light" color="gray">#{tag.replace(/^#/, "")}</Badge>)}
            </Group>
          )}
          {(article.sourceUrl || article.telegramUrl) && (
            <Group gap="md" mt="md" pt="md" style={{ borderTop: "1px solid var(--mantine-color-border)" }}>
              {article.sourceUrl && <Anchor href={article.sourceUrl} target="_blank" rel="noreferrer" size="xs" c="#4f46e5"><IconExternalLink size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />Первоисточник</Anchor>}
              {article.telegramUrl && <Anchor href={article.telegramUrl} target="_blank" rel="noreferrer" size="xs" c="#4f46e5"><IconBrandTelegram size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />Открыть в Telegram</Anchor>}
            </Group>
          )}
        </Box>

        <Stack gap="sm">
          <Text size="sm" fw={600} c="dark.9">Комментарии ({article.comments?.length || 0})</Text>
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
                  <Group gap="xs"><Text size="xs" fw={600} c="dark.9">{commentItem.user?.name || "Аноним"}</Text><Text size="10px" c="gray.4">{formatRelativeDate(commentItem.createdAt)}</Text></Group>
                  <Text size="xs" c="gray.6" lh={1.5}>{commentItem.content}</Text>
                </Stack>
              </Group>
            </Card>
          ))}

          {relatedNews.length > 0 && (
            <Stack gap="sm" mt="sm">
              <Text size="sm" fw={600} c="dark.9">Читайте также</Text>
              {relatedNews.map((news) => (
                <Link key={news.id} href={newsHref(news)} style={{ textDecoration: "none" }}>
                  <Card withBorder radius="md" p="sm" style={{ borderColor: "var(--mantine-color-border)", transition: "all 150ms" }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#4f46e5" }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--mantine-color-border)" }}>
                    <Group gap="sm" align="flex-start">
                      <ThemeIcon variant="light" color="indigo" size={32} radius="md"><IconNews size={18} /></ThemeIcon>
                      <Stack gap={2} style={{ flex: 1 }}>
                        <Text size="sm" fw={600} c="dark.9" style={{ overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{news.title}</Text>
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
