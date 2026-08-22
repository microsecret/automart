"use client"

import useSWR from "swr"
import { Badge, Box, Card, Group, Loader, Paper, Select, Stack, Text, ThemeIcon } from "@mantine/core"
import { IconHistory } from "@tabler/icons-react"
import { useState } from "react"
import { AsyncErrorState } from "@/components/ui/AsyncStates"
import { fetchJson } from "@/lib/api-client"

type AuditEvent = {
  id: string
  action: string
  entityType: string
  entityId: string | null
  summary: string
  actorEmail: string | null
  createdAt: string
  actor: { id: string; name: string | null; email: string | null } | null
}

const ACTION_META: Record<string, { label: string; color: string }> = {
  AUCTION_LOT_HIDE: { label: "Лот скрыт", color: "orange" },
  AUCTION_LOT_RESTORE: { label: "Лот возвращён", color: "teal" },
  USER_ROLE_CHANGE: { label: "Смена роли", color: "indigo" },
  USER_STATUS_CHANGE: { label: "Статус аккаунта", color: "red" },
  LISTING_MODERATE: { label: "Модерация объявления", color: "grape" },
  LISTING_REPORT_RESOLVE: { label: "Жалоба закрыта", color: "blue" },
  DELIVERY_ORGANIZATION_VERIFY: { label: "Проверка партнёра", color: "cyan" },
  SUPPORT_TICKET_UPDATE: { label: "Обращение", color: "gray" },
  FUEL_PRICE_REPORT_REJECT: { label: "Отметка цены отклонена", color: "orange" },
  PART_STORE_STATUS_CHANGE: { label: "Статус магазина", color: "violet" },
}

const ACTION_FILTERS = [
  { value: "", label: "Все действия" },
  ...Object.entries(ACTION_META).map(([value, meta]) => ({ value, label: meta.label })),
]

/**
 * Журнал решений администраторов: кто, что и когда изменил.
 * Только чтение — записи не редактируются и не удаляются.
 */
export default function AdminAuditLog() {
  const [action, setAction] = useState("")
  const { data, error, isLoading, mutate } = useSWR<{ events: AuditEvent[] }>(
    `/api/admin/audit${action ? `?action=${encodeURIComponent(action)}` : ""}`,
    fetchJson,
    { revalidateOnFocus: false },
  )

  return (
    <Card withBorder radius="md" p="md">
      <Group justify="space-between" align="flex-start" gap="md" mb="sm" wrap="wrap">
        <Group gap="sm">
          <ThemeIcon variant="light" color="gray" size={36} radius="md"><IconHistory size={18} /></ThemeIcon>
          <Stack gap={1}>
            <Text size="sm" fw={750}>Журнал действий администраторов</Text>
            <Text size="xs" c="dimmed">Решения, меняющие видимость контента, роли и статусы аккаунтов. Запись не редактируется.</Text>
          </Stack>
        </Group>
        <Select
          size="xs"
          data={ACTION_FILTERS}
          value={action}
          onChange={(value) => setAction(value || "")}
          allowDeselect={false}
          w={220}
          aria-label="Фильтр по типу действия"
        />
      </Group>

      {error ? (
        <AsyncErrorState title="Журнал недоступен" description="Не удалось загрузить историю действий." onRetry={() => mutate()} />
      ) : isLoading ? (
        <Group justify="center" py="lg"><Loader size="sm" /></Group>
      ) : data?.events.length ? (
        <Stack gap={6}>
          {data.events.map((event) => {
            const meta = ACTION_META[event.action] || { label: event.action, color: "gray" }
            const actor = event.actor?.name || event.actor?.email || event.actorEmail || "аккаунт удалён"
            return (
              <Paper key={event.id} withBorder radius="md" p="xs">
                <Group justify="space-between" gap="xs" wrap="wrap" mb={4}>
                  <Group gap={6} wrap="wrap">
                    <Badge size="xs" variant="light" color={meta.color}>{meta.label}</Badge>
                    <Badge size="xs" variant="outline" color="gray">{event.entityType}</Badge>
                  </Group>
                  <Text size="xs" c="dimmed">{new Date(event.createdAt).toLocaleString("ru-RU")}</Text>
                </Group>
                <Text size="sm">{event.summary}</Text>
                <Box mt={3}>
                  <Text size="xs" c="dimmed">Администратор: {actor}</Text>
                </Box>
              </Paper>
            )
          })}
        </Stack>
      ) : (
        <Text size="sm" c="dimmed">
          {action ? "По выбранному фильтру записей нет." : "Записей пока нет. Журнал заполняется по мере решений администраторов."}
        </Text>
      )}
    </Card>
  )
}
