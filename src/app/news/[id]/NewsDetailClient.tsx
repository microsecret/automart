"use client"

import { useState } from "react"
import useSWR, { mutate as globalMutate } from "swr"
import { useSession } from "next-auth/react"
import { Box, Stack, Text, Group, Center, Loader, Card, ThemeIcon, Avatar, Textarea, Button, Anchor, Breadcrumbs, Image, Badge } from "@mantine/core"
import { IconNews, IconClock, IconMessageCircle2, IconExternalLink, IconEye, IconSend, IconBrandTelegram } from "@tabler/icons-react"
import Link from "next/link"
import { formatRelativeDate, formatDate } from "@/lib/format"
import { newsHref } from "@/lib/news"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

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

  const { data: article, isLoading } = useSWR<any>(`/api/news/${id}`, fetcher)
  const { data: relatedData } = useSWR<any>("/api/news?limit=4", fetcher)
  const relatedNews = (relatedData?.news || []).filter((n: any) => n.id !== article?.id).slice(0, 3)

  const submitComment = async () => {
    if (!comment.trim() || !session) return
    setSending(true)
    try {
      await fetch(`/api/news/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: comment.trim() }),
      })
      setComment("")
      globalMutate(`/api/news/${id}`)
    } finally { setSending(false) }
  }

  if (isLoading) return <Center py={60}><Loader color="indigo" /></Center>
  if (!article) return <Center py={60}><Text c="gray.5">Новость не найдена</Text></Center>
  const tags = readTags(article.tags)

  return (
    <Box p={{ base: "sm", md: "md" }} style={{ maxWidth: 800, margin: "0 auto" }}>
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

        <Card withBorder radius="md" p="lg" style={{ borderColor: "var(--mantine-color-border)" }}>
          {article.imageUrl && <Image src={article.imageUrl} alt={article.title} radius="sm" mb="lg" fit="cover" fallbackSrc="/images/home/hero-marketplace.png" />}
          <Text size="sm" c="dark.7" lh={1.75} style={{ whiteSpace: "pre-wrap" }}>
            {article.content}
          </Text>
          {tags.length > 0 && (
            <Group gap="xs" mt="lg">
              {tags.map((tag: string) => <Badge key={tag} variant="light" color="gray">#{tag.replace(/^#/, "")}</Badge>)}
            </Group>
          )}
          {(article.sourceUrl || article.telegramUrl) && (
            <Group gap="md" mt="md" pt="md" style={{ borderTop: "1px solid var(--mantine-color-border)" }}>
              {article.sourceUrl && <Anchor href={article.sourceUrl} target="_blank" rel="noreferrer" size="xs" c="#4f46e5" leftSection={<IconExternalLink size={13} />}>Первоисточник</Anchor>}
              {article.telegramUrl && <Anchor href={article.telegramUrl} target="_blank" rel="noreferrer" size="xs" c="#4f46e5" leftSection={<IconBrandTelegram size={13} />}>Открыть в Telegram</Anchor>}
            </Group>
          )}
        </Card>

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

          {(article.comments || []).map((commentItem: any) => (
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
              {relatedNews.map((news: any) => (
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
