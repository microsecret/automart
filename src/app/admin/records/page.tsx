"use client"

import { useDeferredValue, useState } from "react"
import useSWR from "swr"
import Link from "next/link"
import {
  ActionIcon, Badge, Box, Button, Container, Drawer, Group, Loader, Paper, ScrollArea, SegmentedControl,
  Stack, Text, TextInput, Title,
} from "@mantine/core"
import { notifications } from "@mantine/notifications"
import { IconDatabase, IconSearch, IconTrash } from "@tabler/icons-react"
import { fetchJson, getApiClientErrorMessage } from "@/lib/api-client"
import { formatRelativeDate } from "@/lib/format"
import { AsyncErrorState } from "@/components/ui/AsyncStates"

/**
 * «Данные» — всё, что раньше в админке было только счётчиками.
 *
 * Переписки пользователей, отзывы, уведомления, контакты бота и заявки на
 * запчасти. Каждый вид — последние записи страницами по тридцать и поиск.
 * Переписка открывается целиком сбоку; просмотр пишется в журнал действий.
 */

type Person = { id: string; name: string | null; email: string | null; telegramUsername?: string | null }
type Kind = "conversations" | "reviews" | "notifications" | "contacts" | "part-requests"

const KIND_TABS: { value: Kind; label: string }[] = [
  { value: "conversations", label: "Переписки" },
  { value: "reviews", label: "Отзывы" },
  { value: "notifications", label: "Уведомления" },
  { value: "contacts", label: "Бот" },
  { value: "part-requests", label: "Заявки на запчасти" },
]

const SEARCH_HINT: Record<Kind, string> = {
  conversations: "Имя, почта, @telegram или слово из сообщения",
  reviews: "Слово из отзыва",
  notifications: "Заголовок или текст",
  contacts: "@username, имя или Telegram ID",
  "part-requests": "Деталь, OEM, марка или город",
}

const who = (person: Person | null | undefined) => person ? (person.name || person.email || person.telegramUsername || "Без имени") : "—"

export default function AdminRecordsPage() {
  const [kind, setKind] = useState<Kind>("conversations")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [openConversation, setOpenConversation] = useState<string | null>(null)
  const q = useDeferredValue(search.trim())

  const key = `/api/admin/records?kind=${kind}&page=${page}${q.length > 1 ? `&q=${encodeURIComponent(q)}` : ""}`
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error, isLoading, mutate } = useSWR<{ items: any[]; pageSize: number }>(key, fetchJson, { keepPreviousData: true })
  const items = data?.items || []

  const switchKind = (value: string) => { setKind(value as Kind); setPage(1); setSearch("") }

  const deleteReview = async (id: string) => {
    if (!window.confirm("Удалить отзыв? Вернуть его будет нельзя.")) return
    try {
      await fetchJson(`/api/admin/records?reviewId=${encodeURIComponent(id)}`, { method: "DELETE" })
      notifications.show({ title: "Отзыв удалён", message: "Запись осталась в журнале действий.", color: "indigo" })
      void mutate()
    } catch (deleteError) {
      notifications.show({ title: "Не удалено", message: getApiClientErrorMessage(deleteError, "Не удалось удалить отзыв"), color: "red" })
    }
  }

  return (
    <Container size="lg" p={{ base: "sm", md: "md" }}>
      <Stack gap="md">
        <Group gap="sm" wrap="nowrap">
          <IconDatabase size={26} style={{ color: "var(--market-accent-button)", flexShrink: 0 }} />
          <Box>
            <Title order={1} size="h3">Данные</Title>
            <Text size="sm" c="dimmed">Переписки, отзывы, уведомления, контакты бота и заявки на запчасти</Text>
          </Box>
        </Group>

        <ScrollArea type="never">
          <SegmentedControl value={kind} onChange={switchKind} data={KIND_TABS} />
        </ScrollArea>

        <TextInput
          leftSection={<IconSearch size={16} />}
          placeholder={SEARCH_HINT[kind]}
          aria-label="Поиск"
          value={search}
          onChange={(event) => { setSearch(event.currentTarget.value); setPage(1) }}
        />

        {error ? (
          <AsyncErrorState title="Не удалось загрузить" description="Данные не изменены. Повторите запрос." onRetry={() => mutate()} />
        ) : isLoading && !data ? (
          <Group justify="center" py="xl"><Loader size="sm" /></Group>
        ) : !items.length ? (
          <Paper withBorder radius="md" p="lg"><Text c="dimmed" ta="center">{q ? "Ничего не нашлось" : "Записей пока нет"}</Text></Paper>
        ) : (
          <Stack gap={8}>
            {kind === "conversations" && items.map((item) => (
              <Paper key={item.conversationId} withBorder radius="md" p="sm" component="button" type="button" onClick={() => setOpenConversation(item.conversationId)} style={{ textAlign: "left", cursor: "pointer", width: "100%" }}>
                <Group justify="space-between" gap="xs" wrap="nowrap">
                  <Text fw={700} size="sm" lineClamp={1}>{who(item.participants[0])} ↔ {who(item.participants[1])}</Text>
                  <Text size="xs" c="dimmed" style={{ whiteSpace: "nowrap" }}>{formatRelativeDate(item.lastAt)}</Text>
                </Group>
                {item.listing && <Text size="xs" c="var(--market-accent-text)" lineClamp={1}>{item.listing.title}</Text>}
                <Group justify="space-between" gap="xs" wrap="nowrap" mt={2}>
                  <Text size="sm" c="dimmed" lineClamp={1}>{item.lastText}</Text>
                  <Badge variant="light" color="gray">{item.messages}</Badge>
                </Group>
              </Paper>
            ))}

            {kind === "reviews" && items.map((item) => (
              <Paper key={item.id} withBorder radius="md" p="sm">
                <Group justify="space-between" gap="xs" wrap="nowrap">
                  <Text fw={700} size="sm">{"★".repeat(item.rating)}<Text span c="dimmed">{"★".repeat(5 - item.rating)}</Text> · {who(item.user)}</Text>
                  <Group gap={6} wrap="nowrap">
                    <Text size="xs" c="dimmed">{formatRelativeDate(item.createdAt)}</Text>
                    <ActionIcon variant="subtle" color="red" aria-label="Удалить отзыв" onClick={() => void deleteReview(item.id)}><IconTrash size={16} /></ActionIcon>
                  </Group>
                </Group>
                {item.listing && <Text size="xs" c="var(--market-accent-text)" lineClamp={1}>{item.listing.title}</Text>}
                <Text size="sm" mt={4}>{item.comment || <Text span c="dimmed">Без текста</Text>}</Text>
              </Paper>
            ))}

            {kind === "notifications" && items.map((item) => (
              <Paper key={item.id} withBorder radius="md" p="sm">
                <Group justify="space-between" gap="xs" wrap="nowrap">
                  <Text fw={700} size="sm" lineClamp={1}>{item.title}</Text>
                  <Text size="xs" c="dimmed" style={{ whiteSpace: "nowrap" }}>{formatRelativeDate(item.createdAt)}</Text>
                </Group>
                <Text size="xs" c="dimmed">Кому: {who(item.user)} · {item.isRead ? "прочитано" : "не прочитано"}{item.relatedType ? ` · ${item.relatedType}` : ""}</Text>
                <Text size="sm" mt={4} style={{ whiteSpace: "pre-line" }} lineClamp={4}>{item.content}</Text>
              </Paper>
            ))}

            {kind === "contacts" && items.map((item) => (
              <Paper key={item.telegramId} withBorder radius="md" p="sm">
                <Group justify="space-between" gap="xs" wrap="nowrap">
                  <Text fw={700} size="sm" lineClamp={1}>
                    {[item.firstName, item.lastName].filter(Boolean).join(" ") || "Без имени"}
                    {item.username && <Text span c="dimmed" fw={500}> @{item.username}</Text>}
                  </Text>
                  <Text size="xs" c="dimmed" style={{ whiteSpace: "nowrap" }}>старт {formatRelativeDate(item.startedAt)}</Text>
                </Group>
                <Group gap={6} mt={6}>
                  {item.account
                    ? <Badge variant="light" color="indigo" component={Link} href={`/admin/users?q=${encodeURIComponent(item.account.name || item.username || "")}`} style={{ cursor: "pointer" }}>Аккаунт: {item.account.name || "есть"}</Badge>
                    : <Badge variant="light" color="gray">Без аккаунта</Badge>}
                  {item.blocked && <Badge variant="light" color="red">Заблокировал бота</Badge>}
                  {item.weeklyOptOut && <Badge variant="light" color="gray">Отписан от письма</Badge>}
                  {item.lastWeeklyAt && <Badge variant="light" color="gray">Письмо: {formatRelativeDate(item.lastWeeklyAt)}</Badge>}
                  <Badge variant="light" color="gray">Был: {formatRelativeDate(item.lastSeenAt)}</Badge>
                </Group>
              </Paper>
            ))}

            {kind === "part-requests" && items.map((item) => (
              <Paper key={item.id} withBorder radius="md" p="sm">
                <Group justify="space-between" gap="xs" wrap="nowrap">
                  <Text fw={700} size="sm" lineClamp={1}>{item.partName || item.oemNumber || "Деталь не указана"}</Text>
                  <Text size="xs" c="dimmed" style={{ whiteSpace: "nowrap" }}>{formatRelativeDate(item.createdAt)}</Text>
                </Group>
                <Text size="xs" c="dimmed">{[item.make, item.model, item.year].filter(Boolean).join(" ") || "Авто не указано"}{item.city ? ` · ${item.city}` : ""}</Text>
                <Group gap={6} mt={6}>
                  <Badge variant="light" color={item.status === "NEW" ? "orange" : "gray"}>{item.status === "NEW" ? "Новая" : item.status === "IN_PROGRESS" ? "В работе" : "Отвечена"}</Badge>
                  <Badge variant="light" color="gray">Предложений: {item._count.offers}</Badge>
                  <Badge variant="light" color="gray">{item.name}, {item.phone}</Badge>
                </Group>
              </Paper>
            ))}
          </Stack>
        )}

        {(page > 1 || items.length === data?.pageSize) && (
          <Group justify="center" gap="xs">
            <Button variant="default" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Назад</Button>
            <Text size="sm" c="dimmed">Страница {page}</Text>
            <Button variant="default" disabled={items.length < (data?.pageSize || 30)} onClick={() => setPage((value) => value + 1)}>Дальше</Button>
          </Group>
        )}
      </Stack>

      <ConversationDrawer id={openConversation} onClose={() => setOpenConversation(null)} />
    </Container>
  )
}

type ThreadMessage = {
  id: string
  content: string
  createdAt: string
  senderId: string
  sender: Person
  receiver: Person
  _count: { attachments: number }
}

function ConversationDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data, error, isLoading } = useSWR<{ messages: ThreadMessage[]; listing: { id: string; title: string } | null }>(
    id ? `/api/admin/records/conversation?id=${encodeURIComponent(id)}` : null,
    fetchJson,
  )
  const firstSender = data?.messages[0]?.senderId

  return (
    <Drawer opened={Boolean(id)} onClose={onClose} position="right" size="lg" title="Переписка">
      {error ? (
        <Text c="var(--market-danger-text)">Не удалось открыть переписку</Text>
      ) : isLoading || !data ? (
        <Group justify="center" py="xl"><Loader size="sm" /></Group>
      ) : (
        <Stack gap="xs">
          {data.listing && <Text size="sm" fw={700} c="var(--market-accent-text)">{data.listing.title}</Text>}
          <Text size="xs" c="dimmed">Просмотр записан в журнал действий.</Text>
          {data.messages.map((message) => {
            const mine = message.senderId === firstSender
            return (
              <Box key={message.id} style={{ alignSelf: mine ? "flex-start" : "flex-end", maxWidth: "85%" }}>
                <Paper radius="md" p="xs" withBorder style={{ background: mine ? "var(--market-surface)" : "var(--market-accent-soft)" }}>
                  <Text size="xs" fw={700}>{who(message.sender)}</Text>
                  <Text size="sm" style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{message.content}</Text>
                  {message._count.attachments > 0 && <Text size="xs" c="dimmed">Вложений: {message._count.attachments}</Text>}
                </Paper>
                <Text size="xs" c="dimmed" ta={mine ? "left" : "right"}>{formatRelativeDate(message.createdAt)}</Text>
              </Box>
            )
          })}
        </Stack>
      )}
    </Drawer>
  )
}
