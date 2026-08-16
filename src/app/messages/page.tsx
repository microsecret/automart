"use client"
export const dynamic = "force-dynamic"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import { useSession } from "next-auth/react"
import {
  Container,
  Stack,
  Text,
  Title,
  Center,
  Loader,
  Avatar,
  Group,
  Badge,
  Button,
  Paper,
  Pagination,
  ThemeIcon,
} from "@mantine/core"
import { IconArrowRight, IconMessageCircle2, IconMessageCircleOff } from "@tabler/icons-react"
import Link from "next/link"
import { formatRelativeDate } from "@/lib/format"
import { fetchJson } from "@/lib/api-client"
import { AsyncErrorState } from "@/components/ui/AsyncStates"

interface Conversation {
  id: string
  otherUser: { id: string; name: string | null; image: string | null }
  lastMessage: { content: string; createdAt: string } | null
  unreadCount: number
  listing: { title: string } | null
}

interface ConversationsResponse {
  conversations: Conversation[]
  pagination: {
    page: number
    pages: number
    total: number
  }
}

export default function MessagesPage() {
  const { data: session, status } = useSession() || { data: null, status: 'unauthenticated' }
  const router = useRouter()
  const [page, setPage] = useState(1)
  const { data, error, isLoading, mutate } = useSWR<ConversationsResponse>(
    session ? `/api/messages?page=${page}&limit=20` : null,
    fetchJson,
    { refreshInterval: 5000, keepPreviousData: true }
  )

  useEffect(() => {
    if (status === "loading") return
    if (!session) router.push("/auth/signin")
  }, [session, status, router])

  const conversations = data?.conversations || []
  const pagination = data?.pagination

  useEffect(() => {
    if (pagination && pagination.pages > 0 && page > pagination.pages) setPage(pagination.pages)
  }, [page, pagination])

  if (status === "loading" || !session) {
    return (
      <Container py={80}><Center><Loader color="indigo" /></Center></Container>
    )
  }

  return (
    <Container size="lg" py="xl">
      <Stack gap="lg">
        <Group justify="space-between" align="flex-end" gap="md">
          <Stack gap={3}>
            <Text size="xs" fw={800} tt="uppercase" c="indigo" style={{ letterSpacing: "0.08em" }}>Личный кабинет</Text>
            <Title order={1} size="h2">Сообщения</Title>
            <Text c="dimmed">Диалоги по объявлениям и договорённостям с продавцами.</Text>
          </Stack>
          <Button component={Link} href="/" variant="light" color="indigo" rightSection={<IconArrowRight size={16} />}>
            Найти объявление
          </Button>
        </Group>

        {isLoading ? (
          <Paper withBorder radius="xl" p="xl"><Center py={56}><Loader color="indigo" /></Center></Paper>
        ) : error ? (
          <AsyncErrorState title="Не удалось загрузить сообщения" description="Диалоги временно недоступны. Повторите запрос." onRetry={() => mutate()} />
        ) : conversations.length === 0 ? (
          <Paper withBorder radius="xl" p="xl">
          <Center py={44}>
            <Stack align="center" gap="md">
              <ThemeIcon size={64} radius="xl" variant="light" color="indigo">
                <IconMessageCircleOff size={31} />
              </ThemeIcon>
              <Stack gap={4} align="center">
                <Text fw={700} size="lg">Пока нет диалогов</Text>
                <Text size="sm" c="dimmed" ta="center" maw={410}>Откройте подходящее объявление и нажмите «Написать продавцу». Диалог сразу появится здесь.</Text>
              </Stack>
              <Button component={Link} href="/" color="indigo" leftSection={<IconMessageCircle2 size={18} />}>Перейти к объявлениям</Button>
            </Stack>
          </Center>
          </Paper>
        ) : (
          <Paper withBorder radius="xl" p="xs" className="av-fade-in">
          <Stack gap={4}>
            {conversations.map((conv) => (
              <Paper
                key={conv.id}
                component={Link}
                href={`/messages/${conv.id}`}
                withBorder
                radius="lg"
                p="md"
                style={{
                  display: "block",
                  textDecoration: "none",
                  transition: "border-color 150ms ease, background-color 150ms ease, transform 150ms ease",
                  borderColor: conv.unreadCount > 0 ? "var(--mantine-color-indigo-3)" : "var(--market-field-line)",
                  background: conv.unreadCount > 0 ? "var(--mantine-color-indigo-0)" : "var(--mantine-color-body)",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--mantine-color-indigo-5)"; e.currentTarget.style.transform = "translateY(-1px)" }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = conv.unreadCount > 0 ? "var(--mantine-color-indigo-3)" : "var(--market-field-line)"; e.currentTarget.style.transform = "translateY(0)" }}
              >
                <Group gap="sm" align="flex-start">
                  <Avatar src={conv.otherUser.image} radius="xl" color="indigo">
                    {conv.otherUser.name?.[0]?.toUpperCase()}
                  </Avatar>
                  <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                    <Group justify="space-between" gap="sm">
                      <Text size="sm" fw={600} c="dark.9">{conv.otherUser.name || "Пользователь"}</Text>
                      {conv.lastMessage && <Text size="xs" c="gray.4">{formatRelativeDate(conv.lastMessage.createdAt)}</Text>}
                    </Group>
                    {conv.listing?.title && (
                      <Text size="xs" c="#4f46e5" className="line-clamp-1">{conv.listing.title}</Text>
                    )}
                    <Group gap="xs" align="center">
                      <Text size="sm" c="dimmed" className="line-clamp-1" style={{ flex: 1 }}>
                        {conv.lastMessage?.content || "Нет сообщений"}
                      </Text>
                      {conv.unreadCount > 0 && (
                        <Badge color="indigo" size="xs" variant="filled" circle>
                          {conv.unreadCount}
                        </Badge>
                      )}
                    </Group>
                  </Stack>
                </Group>
              </Paper>
            ))}
          </Stack>
          {pagination && pagination.pages > 1 && (
            <Center py="sm">
              <Pagination
                total={pagination.pages}
                value={pagination.page}
                onChange={setPage}
                siblings={1}
                boundaries={1}
                color="indigo"
                radius="md"
                aria-label="Страницы диалогов"
              />
            </Center>
          )}
          </Paper>
        )}
      </Stack>
    </Container>
  )
}
