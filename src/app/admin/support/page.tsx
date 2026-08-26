"use client"

export const dynamic = "force-dynamic"

import { useEffect, useMemo, useState } from "react"
import useSWR from "swr"
import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Center,
  Divider,
  Grid,
  Group,
  Loader,
  Paper,
  ScrollArea,
  SegmentedControl,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Title,
  Tooltip,
  UnstyledButton,
} from "@mantine/core"
import { useDebouncedValue } from "@mantine/hooks"
import { notifications } from "@mantine/notifications"
import {
  IconArrowBackUp,
  IconCheck,
  IconHeadset,
  IconMessageCircle,
  IconRefresh,
  IconRobot,
  IconSearch,
  IconSend,
  IconUserCheck,
} from "@tabler/icons-react"
import { SUPPORT_TICKET_STATUS, toneColor } from "@/lib/admin-status-tone"
import { fetchJson, getApiClientErrorMessage } from "@/lib/api-client"
import { AsyncErrorState } from "@/components/ui/AsyncStates"
import { formatAdminDateTimeShort } from "@/lib/admin-datetime"

type TicketListItem = {
  id: string
  subject: string
  status: string
  mode: string
  priority: string
  guest: { name: string | null; email: string | null; phone: string | null }
  user: { id: string; name: string | null; email: string | null; phone: string | null; telegramUsername: string | null } | null
  assignedTo: { id: string; name: string | null; email: string | null } | null
  lastMessage: { authorType: string; content: string; createdAt: string } | null
  messagesCount: number
  lastMessageAt: string
  lastReadByStaffAt: string | null
  createdAt: string
}

type TicketListResponse = {
  tickets: TicketListItem[]
  pagination: { page: number; pageSize: number; total: number; pages: number }
  counters: {
    unread: number
    byStatus: Record<string, number>
    byPriority: Record<string, number>
  }
}

type TicketMessage = {
  id: string
  authorType: string
  content: string
  metadata: string | null
  createdAt: string
  authorUser: { id: string; name: string | null; email: string | null } | null
}

type TicketDetail = TicketListItem & {
  guestName: string | null
  guestEmail: string | null
  guestPhone: string | null
  messages: TicketMessage[]
}

type TicketDetailResponse = { ticket: TicketDetail }

const STATUS_OPTIONS = [
  { value: "ALL", label: "Все" },
  { value: "WAITING_OPERATOR", label: "Ждут ответа" },
  { value: "IN_PROGRESS", label: "В работе" },
  { value: "OPEN", label: "Помощник" },
  { value: "CLOSED", label: "Закрытые" },
]

const PRIORITY_OPTIONS = [
  { value: "ALL", label: "Любой приоритет" },
  { value: "LOW", label: "Низкий" },
  { value: "NORMAL", label: "Обычный" },
  { value: "HIGH", label: "Высокий" },
  { value: "URGENT", label: "Срочный" },
]

/* Цвета берутся из общего словаря состояний: прежде «в работе» здесь было
   бирюзовым — цветом успеха, и обращение выглядело решённым, пока им ещё
   занимались. */
const STATUS_META: Record<string, { label: string; color: string }> = Object.fromEntries(
  Object.entries(SUPPORT_TICKET_STATUS).map(([key, descriptor]) => [
    key,
    { label: descriptor.label, color: toneColor(descriptor.tone) },
  ]),
)

const PRIORITY_META: Record<string, { label: string; color: string }> = {
  LOW: { label: "Низкий", color: "gray" },
  NORMAL: { label: "Обычный", color: "blue" },
  HIGH: { label: "Высокий", color: "orange" },
  URGENT: { label: "Срочный", color: "red" },
}



function authorLabel(message: TicketMessage) {
  if (message.authorType === "OPERATOR") return message.authorUser?.name || "Оператор"
  if (message.authorType === "AI") return "Помощник LeWheel"
  if (message.authorType === "SYSTEM") return "Система"
  return "Пользователь"
}

function contactLabel(ticket: TicketListItem | TicketDetail) {
  return ticket.user?.name || ticket.user?.email || ticket.guest.name || ticket.guest.email || ticket.guest.phone || "Гость"
}

export default function AdminSupportPage() {
  const [status, setStatus] = useState("WAITING_OPERATOR")
  const [priority, setPriority] = useState("ALL")
  const [query, setQuery] = useState("")
  const [debouncedQuery] = useDebouncedValue(query, 350)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [reply, setReply] = useState("")
  const [saving, setSaving] = useState(false)

  const listUrl = useMemo(() => {
    const params = new URLSearchParams()
    if (status !== "ALL") params.set("status", status)
    if (priority !== "ALL") params.set("priority", priority)
    if (debouncedQuery) params.set("q", debouncedQuery)
    return `/api/admin/support?${params.toString()}`
  }, [status, priority, debouncedQuery])

  const list = useSWR<TicketListResponse>(listUrl, fetchJson, { refreshInterval: 8_000 })
  const detail = useSWR<TicketDetailResponse>(selectedId ? `/api/admin/support/${selectedId}` : null, fetchJson, {
    refreshInterval: 4_000,
  })

  useEffect(() => {
    if (selectedId && list.data?.tickets.some((ticket) => ticket.id === selectedId)) return
    setSelectedId(list.data?.tickets[0]?.id || null)
  }, [list.data?.tickets, selectedId])

  const runAction = async (action: string, extra: Record<string, unknown> = {}) => {
    if (!selectedId) return
    setSaving(true)
    try {
      await fetchJson(`/api/admin/support/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      })
      await Promise.all([detail.mutate(), list.mutate()])
    } catch (error) {
      notifications.show({ color: "red", title: "Действие не выполнено", message: getApiClientErrorMessage(error, "Не удалось обновить обращение") })
    } finally {
      setSaving(false)
    }
  }

  const sendReply = async () => {
    if (!selectedId || !reply.trim()) return
    setSaving(true)
    try {
      await fetchJson(`/api/admin/support/${selectedId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: reply.trim() }),
      })
      setReply("")
      await Promise.all([detail.mutate(), list.mutate()])
    } catch (error) {
      notifications.show({ color: "red", title: "Ответ не отправлен", message: getApiClientErrorMessage(error, "Не удалось отправить ответ") })
    } finally {
      setSaving(false)
    }
  }

  const ticket = detail.data?.ticket
  const counters = list.data?.counters

  return (
    <Box p={{ base: "xs", sm: "md" }}>
      <Stack gap="md">
        <Card className="admin-workspace__hero" radius="md" p={{ base: "md", sm: "lg" }}>
          <Group justify="space-between" align="center" gap="md" wrap="wrap">
            <Group gap="sm" wrap="nowrap">
              <ThemeIcon variant="white" color="dark" size={48} radius="md"><IconHeadset size={25} /></ThemeIcon>
              <Stack gap={2}>
                <Title order={2} c="white">Центр поддержки</Title>
                <Text size="sm" className="admin-workspace__hero-copy">Гостевые обращения, ответы помощника и живые операторы в одной очереди</Text>
              </Stack>
            </Group>
            <Group gap="xs">
              <Badge color="orange" variant="white" size="lg">Ждут: {counters?.byStatus.WAITING_OPERATOR || 0}</Badge>
              <Badge color="indigo" variant="white" size="lg">Непрочитано: {counters?.unread || 0}</Badge>
            </Group>
          </Group>
        </Card>

        <Paper withBorder radius="md" p="sm">
          <Stack gap="sm">
            <SegmentedControl value={status} onChange={setStatus} data={STATUS_OPTIONS} fullWidth />
            <Group align="end" grow>
              <TextInput
                label="Поиск обращений"
                placeholder="Имя, email, телефон или тема"
                leftSection={<IconSearch size={16} />}
                value={query}
                onChange={(event) => setQuery(event.currentTarget.value)}
              />
              <Select label="Приоритет" data={PRIORITY_OPTIONS} value={priority} onChange={(value) => setPriority(value || "ALL")} />
              <Button variant="light" leftSection={<IconRefresh size={16} />} onClick={() => void list.mutate()}>Обновить</Button>
            </Group>
          </Stack>
        </Paper>

        <Grid gutter="md" align="stretch">
          <Grid.Col span={{ base: 12, lg: 4 }}>
            <Paper withBorder radius="md" h={{ base: 430, lg: 720 }}>
              {list.isLoading ? (
                <Center h="100%"><Loader /></Center>
              ) : list.error ? (
                <AsyncErrorState title="Не удалось загрузить обращения" onRetry={() => void list.mutate()} />
              ) : list.data?.tickets.length ? (
                <ScrollArea h="100%" type="auto">
                  <Stack gap={0}>
                    {list.data.tickets.map((item, index) => {
                      const statusMeta = STATUS_META[item.status] || STATUS_META.OPEN
                      const priorityMeta = PRIORITY_META[item.priority] || PRIORITY_META.NORMAL
                      const isUnread = !item.lastReadByStaffAt || new Date(item.lastMessageAt) > new Date(item.lastReadByStaffAt)
                      return (
                        <UnstyledButton
                          key={item.id}
                          onClick={() => setSelectedId(item.id)}
                          bg={selectedId === item.id ? "var(--mantine-color-indigo-light)" : undefined}
                          p="md"
                          style={{ borderBottom: index < list.data!.tickets.length - 1 ? "1px solid var(--mantine-color-gray-2)" : undefined }}
                        >
                          <Stack gap={6}>
                            <Group justify="space-between" gap="xs" wrap="nowrap">
                              <Text fw={isUnread ? 800 : 650} lineClamp={1}>{contactLabel(item)}</Text>
                              <Text size="xs" c="dimmed" style={{ whiteSpace: "nowrap" }}>{formatAdminDateTimeShort(item.lastMessageAt)}</Text>
                            </Group>
                            <Text size="sm" fw={600} lineClamp={1}>{item.subject}</Text>
                            <Text size="xs" c="dimmed" lineClamp={2}>{item.lastMessage?.content || "Диалог ещё не начат"}</Text>
                            <Group gap={5}>
                              <Badge size="xs" color={statusMeta.color}>{statusMeta.label}</Badge>
                              <Badge size="xs" variant="light" color={priorityMeta.color}>{priorityMeta.label}</Badge>
                              <Badge size="xs" variant="outline" color="gray">{item.messagesCount}</Badge>
                            </Group>
                          </Stack>
                        </UnstyledButton>
                      )
                    })}
                  </Stack>
                </ScrollArea>
              ) : (
                <Center h="100%"><Stack align="center" gap="xs"><IconMessageCircle size={38} color="gray" /><Text fw={700}>Очередь пуста</Text><Text size="sm" c="dimmed">Измените фильтр или дождитесь нового обращения.</Text></Stack></Center>
              )}
            </Paper>
          </Grid.Col>

          <Grid.Col span={{ base: 12, lg: 8 }}>
            <Paper withBorder radius="md" h={{ base: 640, lg: 720 }} p="md">
              {!selectedId ? (
                <Center h="100%"><Text c="dimmed">Выберите обращение слева</Text></Center>
              ) : detail.isLoading ? (
                <Center h="100%"><Loader /></Center>
              ) : detail.error || !ticket ? (
                <AsyncErrorState title="Не удалось загрузить диалог" onRetry={() => void detail.mutate()} />
              ) : (
                <Stack h="100%" gap="sm">
                  <Group justify="space-between" align="flex-start" wrap="wrap">
                    <Stack gap={4}>
                      <Group gap="xs"><Title order={3}>{ticket.subject}</Title><Badge color={STATUS_META[ticket.status]?.color || "gray"}>{STATUS_META[ticket.status]?.label || ticket.status}</Badge></Group>
                      <Text size="sm" c="dimmed">
                        {ticket.user?.email || ticket.guestEmail || ticket.guestPhone || "Контакт ещё не указан"}
                        {ticket.user?.telegramUsername ? ` · @${ticket.user.telegramUsername}` : ""}
                      </Text>
                    </Stack>
                    <Group gap="xs">
                      <Select
                        size="xs"
                        w={140}
                        aria-label="Приоритет обращения"
                        data={PRIORITY_OPTIONS.filter((item) => item.value !== "ALL")}
                        value={ticket.priority}
                        onChange={(value) => value && void runAction("SET_PRIORITY", { priority: value })}
                      />
                      <Tooltip label="Обновить"><ActionIcon variant="light" size="lg" onClick={() => void detail.mutate()}><IconRefresh size={17} /></ActionIcon></Tooltip>
                    </Group>
                  </Group>

                  <Group gap="xs">
                    {ticket.status === "CLOSED" ? (
                      <Button size="xs" variant="light" leftSection={<IconArrowBackUp size={15} />} loading={saving} onClick={() => void runAction("REOPEN")}>Открыть снова</Button>
                    ) : (
                      <>
                        <Button size="xs" leftSection={<IconUserCheck size={15} />} loading={saving} onClick={() => void runAction("TAKE_OVER")}>Взять диалог</Button>
                        <Button size="xs" color="indigo" variant="light" leftSection={<IconRobot size={15} />} loading={saving} onClick={() => void runAction("RELEASE_TO_AI")}>Вернуть помощнику</Button>
                        <Button size="xs" color="gray" variant="light" leftSection={<IconCheck size={15} />} loading={saving} onClick={() => void runAction("CLOSE")}>Закрыть</Button>
                      </>
                    )}
                  </Group>
                  <Divider />

                  <ScrollArea style={{ flex: 1 }} type="auto" offsetScrollbars>
                    <Stack gap="sm" pr="xs">
                      {ticket.messages.map((message) => {
                        const staff = message.authorType === "OPERATOR" || message.authorType === "AI"
                        const system = message.authorType === "SYSTEM"
                        return (
                          <Box key={message.id} ml={staff ? "auto" : 0} mr={!staff && !system ? "auto" : 0} maw={system ? "100%" : "82%"} w={system ? "100%" : undefined}>
                            <Paper
                              withBorder={!system}
                              radius="md"
                              p="sm"
                              bg={system ? "var(--mantine-color-gray-1)" : staff ? "var(--mantine-color-indigo-light)" : "white"}
                            >
                              <Group justify="space-between" gap="md" mb={4}>
                                <Text size="xs" fw={700} c={system ? "dimmed" : staff ? "indigo" : "dark"}>{authorLabel(message)}</Text>
                                <Text size="xs" c="dimmed">{formatAdminDateTimeShort(message.createdAt)}</Text>
                              </Group>
                              <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>{message.content}</Text>
                            </Paper>
                          </Box>
                        )
                      })}
                    </Stack>
                  </ScrollArea>

                  {ticket.status === "CLOSED" ? (
                    <Alert color="gray" title="Обращение закрыто">Откройте его снова, чтобы продолжить переписку.</Alert>
                  ) : (
                    <Group align="flex-end" gap="xs" wrap="nowrap">
                      <Textarea
                        style={{ flex: 1 }}
                        autosize
                        minRows={2}
                        maxRows={5}
                        label="Ответ пользователю"
                        placeholder="Напишите понятный пошаговый ответ…"
                        value={reply}
                        onChange={(event) => setReply(event.currentTarget.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) void sendReply()
                        }}
                      />
                      <Button h={54} leftSection={<IconSend size={17} />} loading={saving} disabled={!reply.trim()} onClick={() => void sendReply()}>Отправить</Button>
                    </Group>
                  )}
                </Stack>
              )}
            </Paper>
          </Grid.Col>
        </Grid>
      </Stack>
    </Box>
  )
}
