"use client"

import useSWRInfinite from "swr/infinite"
import { useDebouncedValue } from "@mantine/hooks"
import {
  Badge,
  Box,
  Button,
  Card,
  Group,
  Loader,
  Paper,
  Select,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
} from "@mantine/core"
import { IconChevronDown, IconHistory, IconSearch } from "@tabler/icons-react"
import { useEffect, useMemo, useState } from "react"
import { AsyncErrorState } from "@/components/ui/AsyncStates"
import { fetchJson } from "@/lib/api-client"
import classes from "./AdminAuditLog.module.css"

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

type AuditPage = {
  events: AuditEvent[]
  nextCursor: string | null
}

const ACTION_META: Record<string, { label: string; color: string }> = {
  AUCTION_LOT_HIDE: { label: "Лот скрыт", color: "orange" },
  AUCTION_LOT_RESTORE: { label: "Лот возвращён", color: "teal" },
  AUCTION_INQUIRY_ASSIGN: { label: "Заявка назначена", color: "cyan" },
  AUCTION_INQUIRY_UPDATE: { label: "Статус заявки", color: "blue" },
  USER_ROLE_CHANGE: { label: "Смена роли", color: "indigo" },
  USER_STATUS_CHANGE: { label: "Статус аккаунта", color: "red" },
  USER_NOTIFICATION_SEND: { label: "Уведомление", color: "blue" },
  LISTING_MODERATE: { label: "Модерация объявления", color: "grape" },
  LISTING_REMOVE: { label: "Объявление снято", color: "red" },
  LISTING_REPORT_RESOLVE: { label: "Решение по жалобе", color: "blue" },
  DELIVERY_ORGANIZATION_VERIFY: { label: "Проверка партнёра", color: "cyan" },
  SUPPORT_TICKET_UPDATE: { label: "Обращение обновлено", color: "gray" },
  SUPPORT_TICKET_REPLY: { label: "Ответ поддержки", color: "teal" },
  TELEGRAM_BROADCAST_SEND: { label: "Telegram-рассылка", color: "blue" },
  FUEL_PRICE_REPORT_REJECT: { label: "Отметка цены отклонена", color: "orange" },
  PART_STORE_STATUS_CHANGE: { label: "Статус магазина", color: "violet" },
  PART_STORE_LEGAL_CHANGE: { label: "Реквизиты магазина", color: "orange" },
  REFERRAL_PAYOUT: { label: "Выплата партнёру", color: "green" },
}

const ENTITY_LABELS: Record<string, string> = {
  AuctionListing: "Аукционный лот",
  AuctionInquiry: "Аукционная заявка",
  User: "Пользователь",
  Listing: "Объявление",
  ListingReport: "Жалоба",
  DeliveryOrganization: "Компания-партнёр",
  SupportTicket: "Обращение",
  TelegramBroadcast: "Telegram-рассылка",
  PartStore: "Магазин запчастей",
  ReferralPayout: "Партнёрская выплата",
}

const ACTION_FILTERS = [
  { value: "", label: "Все действия" },
  ...Object.entries(ACTION_META).map(([value, meta]) => ({ value, label: meta.label })),
]

const ENTITY_FILTERS = [
  { value: "", label: "Все разделы" },
  ...Object.entries(ENTITY_LABELS).map(([value, label]) => ({ value, label })),
]

function formatAuditTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "Asia/Yekaterinburg",
  }).format(new Date(value))
}

/**
 * Журнал решений администраторов: кто, что и когда изменил.
 * Только чтение — записи не редактируются и не удаляются.
 */
export default function AdminAuditLog() {
  const [action, setAction] = useState("")
  const [entityType, setEntityType] = useState("")
  const [query, setQuery] = useState("")
  const [debouncedQuery] = useDebouncedValue(query.trim(), 350)

  const getKey = (pageIndex: number, previousPageData: AuditPage | null) => {
    if (previousPageData && !previousPageData.nextCursor) return null
    const params = new URLSearchParams()
    if (action) params.set("action", action)
    if (entityType) params.set("entityType", entityType)
    if (debouncedQuery) params.set("q", debouncedQuery)
    if (pageIndex > 0 && previousPageData?.nextCursor) params.set("cursor", previousPageData.nextCursor)
    const suffix = params.toString()
    return `/api/admin/audit${suffix ? `?${suffix}` : ""}`
  }

  const { data, error, isLoading, isValidating, mutate, size, setSize } = useSWRInfinite<AuditPage>(
    getKey,
    fetchJson,
    { revalidateFirstPage: false, revalidateOnFocus: false },
  )

  useEffect(() => {
    void setSize(1)
  }, [action, entityType, debouncedQuery, setSize])

  const events = useMemo(() => data?.flatMap((page) => page.events) || [], [data])
  const hasMore = Boolean(data?.at(-1)?.nextCursor)
  const loadingMore = isValidating && size > 1 && data?.length !== size

  return (
    <Card withBorder radius="lg" p={{ base: "sm", sm: "lg" }} className={classes.card}>
      <Group justify="space-between" align="flex-start" gap="md" mb="md" wrap="wrap">
        <Group gap="sm" align="flex-start" className={classes.heading}>
          <ThemeIcon variant="light" color="indigo" size={40} radius="md"><IconHistory size={20} /></ThemeIcon>
          <Stack gap={2} className={classes.headingCopy}>
            <Text size="sm" fw={750}>Журнал действий администраторов</Text>
            <Text size="xs" c="dimmed">
              Неизменяемая история решений: инициатор, раздел и результат. Время указано по Екатеринбургу.
            </Text>
          </Stack>
        </Group>
        {events.length > 0 && <Badge variant="light" color="gray">Показано: {events.length}</Badge>}
      </Group>

      <Box className={classes.filters} mb="md">
        <TextInput
          size="sm"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          leftSection={<IconSearch size={16} />}
          rightSection={isValidating && size === 1 ? <Loader size={14} /> : undefined}
          placeholder="Администратор, результат или ID"
          aria-label="Поиск по журналу действий"
        />
        <Select
          size="sm"
          data={ACTION_FILTERS}
          value={action}
          onChange={(value) => setAction(value || "")}
          allowDeselect={false}
          aria-label="Фильтр по типу действия"
        />
        <Select
          size="sm"
          data={ENTITY_FILTERS}
          value={entityType}
          onChange={(value) => setEntityType(value || "")}
          allowDeselect={false}
          aria-label="Фильтр по разделу"
        />
      </Box>

      {error ? (
        <AsyncErrorState title="Журнал недоступен" description="Не удалось загрузить историю действий." onRetry={() => mutate()} />
      ) : isLoading ? (
        <Group justify="center" py="xl" role="status" aria-label="Загружаем журнал"><Loader size="sm" /></Group>
      ) : events.length ? (
        <Stack gap="xs" aria-live="polite">
          {events.map((event) => {
            const meta = ACTION_META[event.action] || { label: event.action, color: "gray" }
            const actor = event.actor?.name || event.actor?.email || event.actorEmail || "Удалённый аккаунт"
            return (
              <Paper key={event.id} withBorder radius="md" p="sm" className={classes.event}>
                <Group justify="space-between" gap="xs" wrap="wrap" mb={6}>
                  <Group gap={6} wrap="wrap">
                    <Badge size="sm" variant="light" color={meta.color}>{meta.label}</Badge>
                    <Badge size="sm" variant="outline" color="gray">
                      {ENTITY_LABELS[event.entityType] || event.entityType}
                    </Badge>
                  </Group>
                  <Text size="xs" c="dimmed">{formatAuditTime(event.createdAt)} ЕКБ</Text>
                </Group>
                <Text size="sm" fw={550}>{event.summary}</Text>
                <Group mt={6} gap="xs" justify="space-between" wrap="wrap">
                  <Text size="xs" c="dimmed">Инициатор: {actor}</Text>
                  {event.entityId && <Text size="xs" c="dimmed" className={classes.entityId}>ID: {event.entityId}</Text>}
                </Group>
              </Paper>
            )
          })}
          {hasMore && (
            <Button
              variant="subtle"
              color="gray"
              size="sm"
              rightSection={<IconChevronDown size={16} />}
              loading={loadingMore}
              onClick={() => void setSize(size + 1)}
              className={classes.moreButton}
            >
              Показать более ранние действия
            </Button>
          )}
        </Stack>
      ) : (
        <Paper withBorder radius="md" p="lg" className={classes.empty}>
          <Text size="sm" fw={650}>По заданным условиям действий нет</Text>
          <Text size="xs" c="dimmed" mt={3}>Измените поиск или фильтры. Новые административные решения появляются здесь автоматически.</Text>
        </Paper>
      )}
    </Card>
  )
}
