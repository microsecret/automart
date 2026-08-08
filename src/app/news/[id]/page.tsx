"use client"

export const dynamic = "force-dynamic"

import { useState } from "react"
import useSWR, { mutate as globalMutate } from "swr"
import { useSession } from "next-auth/react"
import { Box, Stack, Text, Group, Center, Loader, Card, ThemeIcon, Avatar, Textarea, Button, Divider, Anchor, Breadcrumbs } from "@mantine/core"
import { IconNews, IconClock, IconMessageCircle2, IconExternalLink, IconEye, IconSend } from "@tabler/icons-react"
import Link from "next/link"
import { formatRelativeDate, formatDate } from "@/lib/format"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function NewsDetailPage({ params }: { params: { id: string } }) {
  const { data: session } = useSession()
  const [comment, setComment] = useState("")
  const [sending, setSending] = useState(false)

  const { data: article, isLoading } = useSWR<any>(`/api/news/${params.id}`, fetcher)

  const submitComment = async () => {
    if (!comment.trim() || !session) return
    setSending(true)
    try {
      await fetch(`/api/news/${params.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: comment.trim() }),
      })
      setComment("")
      globalMutate(`/api/news/${params.id}`)
    } finally { setSending(false) }
  }

  if (isLoading) return <Center py={60}><Loader color="indigo" /></Center>
  if (!article) return <Center py={60}><Text c="#71717a">Новость не найдена</Text></Center>

  return (
    <Box p={{ base: "sm", md: "md" }} style={{ maxWidth: 800, margin: "0 auto" }}>
      <Stack gap="md">
        {/* Хлебные крошки */}
        <Breadcrumbs separator="›">
          <Anchor component={Link} href="/" size="xs" c="#71717a">Главная</Anchor>
          <Anchor component={Link} href="/news" size="xs" c="#71717a">Новости</Anchor>
        </Breadcrumbs>

        {/* Заголовок */}
        <Stack gap="xs">
          <Text component="h1" ff="var(--font-display),sans-serif" fw={800} fz={{ base: 20, md: 26 }} lh={1.2} c="#18181b">
            {article.title}
          </Text>
          <Group gap="md">
            <Group gap={3}><IconClock size={13} color="#a1a1aa" /><Text size="xs" c="#71717a">{formatDate(article.publishedAt)}</Text></Group>
            <Group gap={3}><IconEye size={13} color="#a1a1aa" /><Text size="xs" c="#71717a">{article.views} просмотров</Text></Group>
            <Group gap={3}><IconMessageCircle2 size={13} color="#a1a1aa" /><Text size="xs" c="#71717a">{article.comments?.length || 0} комментариев</Text></Group>
          </Group>
        </Stack>

        {/* Контент */}
        <Card withBorder radius="md" p="lg" style={{ borderColor: "#f4f4f5" }}>
          <Text size="sm" c="#3f3f46" lh={1.7} style={{ whiteSpace: "pre-wrap" }}>
            {article.content}
          </Text>
          {article.sourceUrl && (
            <Group gap={4} mt="md" pt="md" style={{ borderTop: "1px solid #f4f4f5" }}>
              <IconExternalLink size={13} color="#a1a1aa" />
              <Anchor href={article.sourceUrl} target="_blank" size="xs" c="#4f46e5">Источник</Anchor>
            </Group>
          )}
        </Card>

        {/* Комментарии */}
        <Stack gap="sm">
          <Text size="sm" fw={600} c="#18181b">Комментарии ({article.comments?.length || 0})</Text>

          {/* Форма комментария */}
          {session ? (
            <Card withBorder radius="md" p="sm" style={{ borderColor: "#f4f4f5" }}>
              <Stack gap="xs">
                <Textarea
                  placeholder="Ваш комментарий..."
                  value={comment}
                  onChange={(e) => setComment(e.currentTarget.value)}
                  minRows={2}
                  size="sm"
                  radius="md"
                />
                <Group justify="flex-end">
                  <Button size="xs" color="indigo" radius="md" leftSection={<IconSend size={14} />} onClick={submitComment} loading={sending} disabled={!comment.trim()}>
                    Отправить
                  </Button>
                </Group>
              </Stack>
            </Card>
          ) : (
            <Card withBorder radius="md" p="sm" style={{ borderColor: "#f4f4f5", background: "#fcfcfd" }}>
              <Text size="xs" c="#71717a" ta="center">
                <Anchor component={Link} href="/auth/signin" size="xs" c="indigo">Войдите</Anchor> чтобы оставить комментарий
              </Text>
            </Card>
          )}

          {/* Список комментариев */}
          {(article.comments || []).map((c: any) => (
            <Card key={c.id} withBorder radius="md" p="sm" style={{ borderColor: "#f4f4f5" }}>
              <Group gap="sm" align="flex-start">
                <Avatar src={c.user?.image} size="sm" radius="xl" color="indigo">{c.user?.name?.[0]?.toUpperCase()}</Avatar>
                <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                  <Group gap="xs">
                    <Text size="xs" fw={600} c="#18181b">{c.user?.name || "Аноним"}</Text>
                    <Text size="10px" c="#a1a1aa">{formatRelativeDate(c.createdAt)}</Text>
                  </Group>
                  <Text size="xs" c="#52525b" lh={1.5}>{c.content}</Text>
                </Stack>
              </Group>
            </Card>
          ))}
        </Stack>
      </Stack>
    </Box>
  )
}
