"use client"
export const dynamic = "force-dynamic"
import useSWR, { useSWRConfig } from "swr"
import { useState } from "react"
import { Alert, ActionIcon, Box, Stack, Group, Text, Paper, Center, Loader, ThemeIcon, Button, Badge, Tooltip } from "@mantine/core"
import { IconBell, IconBellRinging, IconCheck, IconCircleCheck, IconAlertTriangle, IconInfoCircle, IconAlertCircle } from "@tabler/icons-react"
import { AsyncErrorState } from "@/components/ui/AsyncStates"
import { fetchJson, getApiClientErrorMessage } from "@/lib/api-client"

type Notification = {
  id: string
  type: keyof typeof TYPE_CONFIG
  title: string
  content: string
  isRead: boolean
  createdAt: string
}

type NotificationsResponse = { notifications: Notification[] }

const TYPE_CONFIG = {
  SUCCESS: { icon: IconCircleCheck, color: "teal" },
  WARNING: { icon: IconAlertTriangle, color: "orange" },
  ERROR: { icon: IconAlertCircle, color: "red" },
  INFO: { icon: IconInfoCircle, color: "indigo" },
}

function formatNotificationTime(value: string) {
  const timestamp = new Date(value).getTime()
  if (Number.isNaN(timestamp)) return ""

  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60_000))
  if (minutes < 1) return "только что"
  if (minutes < 60) return `${minutes} мин. назад`

  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} ч. назад`
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(new Date(value))
}

export default function NotificationsPage() {
  const { data, error, isLoading } = useSWR<NotificationsResponse>("/api/notifications?limit=50", fetchJson)
  const { mutate } = useSWRConfig()
  const [isMarkingAll, setIsMarkingAll] = useState(false)
  const [markingId, setMarkingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const markAllRead = async () => {
    setIsMarkingAll(true)
    setActionError(null)
    try {
      await fetchJson("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      })
      mutate("/api/notifications?limit=50")
    } catch (requestError) {
      setActionError(getApiClientErrorMessage(requestError, "Не удалось обновить уведомления"))
    } finally {
      setIsMarkingAll(false)
    }
  }

  const markRead = async (id: string) => {
    setMarkingId(id)
    setActionError(null)
    try {
      await fetchJson("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      await mutate("/api/notifications?limit=50")
    } catch (requestError) {
      setActionError(getApiClientErrorMessage(requestError, "Не удалось обновить уведомление"))
    } finally {
      setMarkingId(null)
    }
  }

  const notifications = data?.notifications || []
  const unread = notifications.filter((notification) => !notification.isRead).length

  return (
    <Box p={{ base: "sm", md: "md" }} maw={980} mx="auto">
      <Stack gap="md">
        <Paper withBorder radius="md" p={{ base: "md", sm: "lg" }}>
          <Group justify="space-between" align="center" wrap="wrap" gap="md">
            <Group gap="sm" align="center">
              <ThemeIcon variant="light" color="indigo" size={42} radius="md"><IconBellRinging size={22} /></ThemeIcon>
              <Stack gap={2}>
                <Text component="h1" fw={800} fz={24} c="var(--market-ink)" ff="var(--font-display),sans-serif">Уведомления</Text>
                <Text size="sm" c="dimmed">Статусы объявлений, сделки и важные действия в одном месте</Text>
              </Stack>
              {unread > 0 && <Badge size="sm" color="indigo" variant="light">{unread} новых</Badge>}
            </Group>
            {unread > 0 && <Button variant="light" size="sm" color="indigo" onClick={markAllRead} loading={isMarkingAll}>Отметить все прочитанными</Button>}
          </Group>
        </Paper>

        {isLoading ? (
          <Center py={80}><Loader size="sm" color="indigo" /></Center>
        ) : error ? (
          <AsyncErrorState title="Не удалось загрузить уведомления" description="Проверьте подключение и повторите запрос." onRetry={() => mutate("/api/notifications?limit=50")} />
        ) : notifications.length === 0 ? (
          <Paper radius="md" p="xl" withBorder>
            <Center>
              <Stack align="center" gap="sm">
                <ThemeIcon variant="light" color="gray" size={56} radius="md"><IconBell size={28} /></ThemeIcon>
                <Text c="gray.5">Нет уведомлений</Text>
              </Stack>
            </Center>
          </Paper>
        ) : (
          <Stack gap="xs">
            {actionError && <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />}>{actionError}</Alert>}
            {notifications.map((n) => {
              const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.INFO
              const Icon = cfg.icon
              return (
                <Paper key={n.id} radius="md" p="md" withBorder style={{ opacity: n.isRead ? 0.72 : 1 }}>
                  <Group gap="sm" align="flex-start" wrap="nowrap">
                    <ThemeIcon size={40} radius="md" variant="light" color={cfg.color} style={{ flexShrink: 0 }}>
                      <Icon size={20} />
                    </ThemeIcon>
                    <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                      <Group gap="xs" align="center" wrap="wrap">
                        <Text fw={600} fz="sm" c="var(--market-ink)">{n.title}</Text>
                        {!n.isRead && <Badge size="xs" color="indigo" variant="light">Новое</Badge>}
                      </Group>
                      <Text fz="sm" c="dimmed">{n.content}</Text>
                      <Text fz="xs" c="gray.5" mt={2}>{formatNotificationTime(n.createdAt)}</Text>
                    </Stack>
                    {!n.isRead && (
                      <Tooltip label="Отметить прочитанным" withArrow>
                        <ActionIcon aria-label="Отметить уведомление прочитанным" variant="subtle" color="indigo" loading={markingId === n.id} onClick={() => void markRead(n.id)}>
                          <IconCheck size={18} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </Group>
                </Paper>
              )
            })}
          </Stack>
        )}
      </Stack>
    </Box>
  )
}
