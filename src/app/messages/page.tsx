"use client"
export const dynamic = "force-dynamic"

import { useEffect, useRef, useState } from "react"
import { useDebouncedValue } from "@mantine/hooks"
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
  ActionIcon,
} from "@mantine/core"
import { IconArrowRight, IconMessageCircleOff, IconSearch, IconShieldCheck, IconX } from "@tabler/icons-react"
import ServiceArtwork from "@/components/ui/ServiceArtwork"
import ScenicBanner from "@/components/ui/ScenicBanner"
import Link from "next/link"
import { formatRelativeDate, initialOf } from "@/lib/format"
import { fetchJson } from "@/lib/api-client"
import { AsyncErrorState } from "@/components/ui/AsyncStates"
import DashboardNav from "@/components/dashboard/DashboardNav"

interface Conversation {
  id: string
  otherUser: { id: string; name: string | null; image: string | null }
  lastMessage: { content: string; createdAt: string; attachmentCount: number } | null
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
  const [debouncedQuery] = useDebouncedValue(query, 250)
  const inputRef = useRef<HTMLInputElement>(null)
  const hasSearch = Boolean(debouncedQuery.trim())
  const { data, error, isLoading, isValidating, mutate } = useSWR<ConversationsResponse>(
    session ? `/api/messages?page=${page}&limit=20&q=${encodeURIComponent(debouncedQuery.trim())}` : null,
    fetchJson,
    { refreshInterval: 5000, keepPreviousData: true }
  )

  useEffect(() => {
    if (status === "loading") return
    /* callbackUrl возвращает в сообщения после входа. */
    if (!session) router.push("/auth/signin?callbackUrl=%2Fmessages")
  }, [session, status, router])

  const conversations = data?.conversations || []
  const pagination = data?.pagination
  const clearQuery = () => { setQuery(""); setPage(1); inputRef.current?.focus() }

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
        <ScenicBanner scene="messages" className="lw-messages-banner">
          <Stack gap={6} align="flex-start">
            <Title order={1} size="h2">Сообщения</Title>
            <Text size="sm">Диалоги по объявлениям и договорённостям с продавцами.</Text>
          <Button component={Link} href="/" variant="filled" color="indigo" rightSection={<IconArrowRight size={16} />}>
            Найти объявление
          </Button>
          </Stack>
        </ScenicBanner>

        <DashboardNav active="messages" />

        {isLoading && !data ? (
          <Paper withBorder radius="xl" p="xl"><Center py={56}><Loader color="indigo" /></Center></Paper>
        ) : error ? (
          <AsyncErrorState title="Не удалось загрузить сообщения" description="Диалоги временно недоступны. Повторите запрос." onRetry={() => mutate()} />
        ) : (
          <Paper withBorder radius="md" p={0} className="messages-workspace av-fade-in">
            <Box className="messages-workspace__list">
              <Box p="md" className="messages-workspace__search">
                <TextInput ref={inputRef} value={query} onChange={(event) => { setQuery(event.currentTarget.value); setPage(1) }} placeholder="Собеседник, объявление или текст" leftSection={<IconSearch size={16} aria-hidden="true" />} aria-label="Поиск по диалогам" aria-describedby="message-search-hint" type="search" autoComplete="off" spellCheck={false} maxLength={120}
                  rightSectionWidth={query ? 76 : 32} rightSection={<Group gap={2} wrap="nowrap">{isValidating && <Loader size={16} aria-hidden="true" />}{query && <ActionIcon size={44} variant="subtle" onClick={clearQuery} aria-label="Очистить поиск"><IconX size={16} aria-hidden="true" /></ActionIcon>}</Group>} />
                <Text id="message-search-hint" size="xs" c="var(--market-muted)" mt={6}>Поиск по всем диалогам и истории сообщений.</Text>
              </Box>
              {conversations.length === 0 ? (
                <Center className="messages-workspace__list-empty">
                  <Stack align="center" gap="xs" ta="center" px="md">
                    {hasSearch ? <ThemeIcon size={46} radius="xl" variant="light" color="indigo"><IconMessageCircleOff size={23} /></ThemeIcon> : <ServiceArtwork kind="messages" size={96} />}
                    <Text fw={700}>{hasSearch ? "Ничего не найдено" : "Пока нет диалогов"}</Text>
                    <Text size="xs" c="dimmed">{hasSearch ? "Измените запрос или очистите поиск." : "Переписка появится после сообщения продавцу."}</Text>
                    {hasSearch && <Button variant="subtle" size="sm" onClick={clearQuery}>Сбросить поиск</Button>}
                  </Stack>
                </Center>
              ) : (
                <Stack gap={0}>
                  {conversations.map((conv) => (
                    <Box
                key={conv.id}
                component={Link}
                href={`/messages/${conv.id}`}
                className="messages-conversation-row"
                data-unread={conv.unreadCount > 0 || undefined}
              >
                <Group gap="sm" align="flex-start">
                  <Avatar src={conv.otherUser.image} radius="xl" color="indigo" className="lw-user-avatar">
                    {initialOf(conv.otherUser.name)}
                  </Avatar>
                  <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                    <Group justify="space-between" gap="sm">
                      <Text size="sm" fw={600} c="var(--market-ink)">{conv.otherUser.name || "Пользователь"}</Text>
                      {conv.lastMessage && <Text size="xs" c="var(--market-muted)">{formatRelativeDate(conv.lastMessage.createdAt)}</Text>}
                    </Group>
                    {conv.listing?.title && (
                      <Text size="xs" fw={600} c="var(--market-primary)" className="line-clamp-1">{conv.listing.title}</Text>
                    )}
                    <Group gap="xs" align="center">
                      <Text size="sm" c="dimmed" className="line-clamp-1" style={{ flex: 1 }}>
                        {conv.lastMessage?.content || (conv.lastMessage?.attachmentCount ? `📷 Фото: ${conv.lastMessage.attachmentCount}` : "Нет сообщений")}
                      </Text>
                      {conv.unreadCount > 0 && (
                        <Badge color="indigo" size="sm" variant="filled" className="messages-unread-count" aria-label={`Непрочитанных: ${conv.unreadCount}`}>
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
                <ServiceArtwork kind="messages" size={176} />
                <Stack gap={4} align="center">
                  <Text fw={800} size="lg">{hasSearch ? "Поиск по переписке" : conversations.length ? "Выберите диалог" : "Сообщения по сделкам — в одном месте"}</Text>
                  <Text size="sm" c="dimmed">{hasSearch ? "Поиск учитывает имена собеседников, объявления и историю сообщений." : conversations.length ? "Откройте переписку слева, чтобы продолжить разговор." : "Откройте объявление и нажмите «Написать продавцу». Новый диалог сразу появится в этом списке."}</Text>
                </Stack>
                {!hasSearch && !conversations.length && <Button component={Link} href="/" color="indigo" leftSection={<IconArrowRight size={17} />}>Найти автомобиль</Button>}
                <Group gap={6} wrap="nowrap"><IconShieldCheck size={15} color="var(--mantine-color-teal-6)" /><Text size="xs" c="dimmed">Не переводите общение и оплату за пределы площадки.</Text></Group>
              </Stack>
            </Center>
          </Paper>
        )}
      </Stack>
    </Container>
  )
}
