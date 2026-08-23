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
  Box,
  TextInput,
} from "@mantine/core"
import { IconArrowRight, IconMessageCircle2, IconMessageCircleOff, IconSearch, IconShieldCheck } from "@tabler/icons-react"
import Link from "next/link"
import { formatRelativeDate } from "@/lib/format"
import { fetchJson } from "@/lib/api-client"
import { AsyncErrorState } from "@/components/ui/AsyncStates"
import DashboardNav from "@/components/dashboard/DashboardNav"

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
  const [query, setQuery] = useState("")
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
  const normalizedQuery = query.trim().toLocaleLowerCase("ru-RU")
  const visibleConversations = normalizedQuery
    ? conversations.filter((conversation) => [conversation.otherUser.name, conversation.listing?.title, conversation.lastMessage?.content].filter(Boolean).join(" ").toLocaleLowerCase("ru-RU").includes(normalizedQuery))
    : conversations
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
            <Text size="xs" fw={800} tt="uppercase" c="indigo" style={{ letterSpacing: "var(--track-caps)" }}>Личный кабинет</Text>
            <Title order={1} size="h2">Сообщения</Title>
            <Text c="dimmed">Диалоги по объявлениям и договорённостям с продавцами.</Text>
          </Stack>
          <Button component={Link} href="/" variant="light" color="indigo" rightSection={<IconArrowRight size={16} />}>
            Найти объявление
          </Button>
        </Group>

        <DashboardNav active="messages" />

        {isLoading ? (
          <Paper withBorder radius="xl" p="xl"><Center py={56}><Loader color="indigo" /></Center></Paper>
        ) : error ? (
          <AsyncErrorState title="Не удалось загрузить сообщения" description="Диалоги временно недоступны. Повторите запрос." onRetry={() => mutate()} />
        ) : (
          <Paper withBorder radius="md" p={0} className="messages-workspace av-fade-in">
            <Box className="messages-workspace__list">
              <Box p="md" className="messages-workspace__search">
                <TextInput value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder="Поиск по диалогам" leftSection={<IconSearch size={16} />} aria-label="Поиск по диалогам" />
              </Box>
              {visibleConversations.length === 0 ? (
                <Center className="messages-workspace__list-empty">
                  <Stack align="center" gap="xs" ta="center" px="md">
                    <ThemeIcon size={46} radius="xl" variant="light" color="indigo"><IconMessageCircleOff size={23} /></ThemeIcon>
                    <Text fw={700}>{conversations.length ? "Ничего не найдено" : "Пока нет диалогов"}</Text>
                    <Text size="xs" c="dimmed">{conversations.length ? "Измените запрос." : "Переписка появится после сообщения продавцу."}</Text>
                  </Stack>
                </Center>
              ) : (
                <Stack gap={0}>
                  {visibleConversations.map((conv) => (
                    <Box
                key={conv.id}
                component={Link}
                href={`/messages/${conv.id}`}
                className="messages-conversation-row"
                data-unread={conv.unreadCount > 0 || undefined}
              >
                <Group gap="sm" align="flex-start">
                  <Avatar src={conv.otherUser.image} radius="xl" color="indigo">
                    {conv.otherUser.name?.[0]?.toUpperCase()}
                  </Avatar>
                  <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                    <Group justify="space-between" gap="sm">
                      <Text size="sm" fw={600} c="var(--market-ink)">{conv.otherUser.name || "Пользователь"}</Text>
                      {conv.lastMessage && <Text size="xs" c="gray.4">{formatRelativeDate(conv.lastMessage.createdAt)}</Text>}
                    </Group>
                    {conv.listing?.title && (
                      <Text size="xs" c="#1c4291" className="line-clamp-1">{conv.listing.title}</Text>
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
                    </Box>
                  ))}
                </Stack>
              )}
              {pagination && pagination.pages > 1 && (
                <Center py="sm"><Pagination total={pagination.pages} value={pagination.page} onChange={setPage} siblings={1} boundaries={1} color="indigo" radius="md" aria-label="Страницы диалогов" /></Center>
              )}
            </Box>
            <Center className="messages-workspace__preview">
              <Stack align="center" gap="md" ta="center" maw={430} px="lg">
                <ThemeIcon size={66} radius="xl" variant="light" color="indigo"><IconMessageCircle2 size={31} /></ThemeIcon>
                <Stack gap={4} align="center">
                  <Text fw={800} size="lg">{conversations.length ? "Выберите диалог" : "Сообщения по сделкам — в одном месте"}</Text>
                  <Text size="sm" c="dimmed">{conversations.length ? "Откройте переписку слева, чтобы продолжить разговор." : "Откройте объявление и нажмите «Написать продавцу». Новый диалог сразу появится в этом списке."}</Text>
                </Stack>
                {!conversations.length && <Button component={Link} href="/" color="indigo" leftSection={<IconArrowRight size={17} />}>Найти автомобиль</Button>}
                <Group gap={5} wrap="nowrap"><IconShieldCheck size={15} color="var(--mantine-color-teal-6)" /><Text size="xs" c="dimmed">Не переводите общение и оплату за пределы площадки.</Text></Group>
              </Stack>
            </Center>
          </Paper>
        )}
      </Stack>
    </Container>
  )
}
