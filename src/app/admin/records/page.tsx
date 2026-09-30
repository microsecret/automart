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
 * «Данные» — всё, что происходит в инструментах площадки, в одном месте.
 *
 * Счётчики в обзоре («Сообщения 10», «Уведомления 71») вели в личные
 * разделы администратора, и увидеть сами записи было негде. Здесь каждая
 * вкладка — последние записи одного инструмента страницами по тридцать с
 * поиском, а «Все диалоги» сводит переписку, поддержку, чаты доставок и
 * заявки в одну ленту по времени. Диалог открывается целиком сбоку;
 * просмотр пишется в журнал действий.
 */

type Person = { id: string; name: string | null; email: string | null; telegramUsername?: string | null }
type Kind =
  | "inbox" | "conversations" | "listings" | "reviews" | "notifications" | "contacts"
  | "part-requests" | "part-orders" | "payments" | "fuel-reports" | "fuel-subscriptions"

const KIND_TABS: { value: Kind; label: string }[] = [
  { value: "inbox", label: "Все диалоги" },
  { value: "conversations", label: "Переписки" },
  { value: "listings", label: "Объявления" },
  { value: "notifications", label: "Уведомления" },
  { value: "reviews", label: "Отзывы" },
  { value: "contacts", label: "Бот" },
  { value: "fuel-reports", label: "Отметки АЗС" },
  { value: "fuel-subscriptions", label: "Подписки на топливо" },
  { value: "part-requests", label: "Заявки на запчасти" },
  { value: "part-orders", label: "Заказы запчастей" },
  { value: "payments", label: "Оплаты" },
]

const SEARCH_HINT: Record<Kind, string> = {
  inbox: "Имя, тема, код заказа или слово из сообщения",
  conversations: "Имя, почта, @telegram или слово из сообщения",
  listings: "Название объявления",
  reviews: "Слово из отзыва",
  notifications: "Заголовок или текст",
  contacts: "@username, имя или Telegram ID",
  "fuel-reports": "Заправка, город или комментарий",
  "fuel-subscriptions": "Заправка или город",
  "part-requests": "Деталь, OEM, марка или город",
  "part-orders": "Товар, покупатель или город",
  payments: "",
}

const INBOX_TYPE: Record<string, { label: string; color: string }> = {
  message: { label: "Переписка", color: "indigo" },
  support: { label: "Поддержка", color: "grape" },
  delivery: { label: "Доставка", color: "teal" },
  "auction-inquiry": { label: "Заявка на импорт", color: "orange" },
  "part-request": { label: "Заявка на запчасть", color: "cyan" },
}

/* Статусы разных инструментов — по-русски, одним словарём. */
const STATUS_LABEL: Record<string, string> = {
  NEW: "Новая", OPEN: "Открыто", WAITING_OPERATOR: "Ждёт оператора", IN_PROGRESS: "В работе", ANSWERED: "Отвечена",
  CLOSED: "Закрыто", CONTACTED: "Связались", ACTIVE: "Активно", DRAFT: "Черновик", PENDING_MODERATION: "На проверке",
  ARCHIVED: "В архиве", PAUSED: "Приостановлено", REJECTED: "Отклонено", SOLD: "Продано", PENDING: "Ждёт оплаты",
  PAID: "Оплачено", FAILED: "Не прошла", CANCELLED: "Отменено", CONFIRMED: "Подтверждён", IN_DELIVERY: "В доставке",
  DONE: "Завершён", SUPERSEDED: "Заменена", REQUEST_CREATED: "Заявка создана",
}
const statusLabel = (value: string | null | undefined) => (value ? STATUS_LABEL[value] || value : "")

const FUEL_LABEL: Record<string, string> = { AI92: "АИ-92", AI95: "АИ-95", AI98: "АИ-98", AI100: "АИ-100", DT: "ДТ", GAS: "Газ" }
const who = (person: Person | null | undefined) => person ? (person.name || person.email || person.telegramUsername || "Без имени") : "—"
const rub = (value: number) => `${value.toLocaleString("ru-RU")} ₽`

function initialKind(): Kind {
  if (typeof window === "undefined") return "inbox"
  const value = new URLSearchParams(window.location.search).get("kind") as Kind | null
  return value && KIND_TABS.some((tab) => tab.value === value) ? value : "inbox"
}

function Row({ title, meta, at, children }: { title: React.ReactNode; meta?: React.ReactNode; at?: string | null; children?: React.ReactNode }) {
  return (
    <Paper withBorder radius="md" p="sm">
      <Group justify="space-between" gap="xs" wrap="nowrap">
        <Text fw={700} size="sm" lineClamp={1}>{title}</Text>
        {at && <Text size="xs" c="dimmed" style={{ whiteSpace: "nowrap" }}>{formatRelativeDate(at)}</Text>}
      </Group>
      {meta && <Text size="xs" c="dimmed" lineClamp={2}>{meta}</Text>}
      {children}
    </Paper>
  )
}

export default function AdminRecordsPage() {
  const [kind, setKind] = useState<Kind>(initialKind)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [openThread, setOpenThread] = useState<{ id: string; type: string } | null>(null)
  const q = useDeferredValue(search.trim())

  const key = `/api/admin/records?kind=${kind}&page=${page}${q.length > 1 ? `&q=${encodeURIComponent(q)}` : ""}`
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error, isLoading, mutate } = useSWR<{ items: any[]; pageSize: number }>(key, fetchJson, { keepPreviousData: true })
  const items = data?.items || []

  const switchKind = (value: string) => {
    setKind(value as Kind)
    setPage(1)
    setSearch("")
    // Адрес повторяет вкладку: ссылку можно переслать и обновить страницу.
    try { window.history.replaceState(null, "", `/admin/records?kind=${value}`) } catch { /* без адреса — не страшно */ }
  }

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
            <Text size="sm" c="dimmed">Диалоги, объявления, уведомления, отметки АЗС, заявки, заказы и оплаты — всё, что происходит на площадке</Text>
          </Box>
        </Group>

        <ScrollArea type="never">
          <SegmentedControl value={kind} onChange={switchKind} data={KIND_TABS} />
        </ScrollArea>

        {SEARCH_HINT[kind] && (
          <TextInput
            leftSection={<IconSearch size={16} />}
            placeholder={SEARCH_HINT[kind]}
            aria-label="Поиск"
            value={search}
            onChange={(event) => { setSearch(event.currentTarget.value); setPage(1) }}
          />
        )}

        {error ? (
          <AsyncErrorState title="Не удалось загрузить" description="Данные не изменены. Повторите запрос." onRetry={() => mutate()} />
        ) : isLoading && !data ? (
          <Group justify="center" py="xl"><Loader size="sm" /></Group>
        ) : !items.length ? (
          <Paper withBorder radius="md" p="lg"><Text c="dimmed" ta="center">{q ? "Ничего не нашлось" : "Записей пока нет"}</Text></Paper>
        ) : (
          <Stack gap={8}>
            {kind === "inbox" && items.map((item) => {
              const type = INBOX_TYPE[item.type] || { label: item.type, color: "gray" }
              const opensThread = item.type === "message" || item.type === "support" || item.type === "delivery"
              const body = (
                <>
                  <Group justify="space-between" gap="xs" wrap="nowrap">
                    <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
                      <Badge size="xs" variant="light" color={type.color} style={{ flexShrink: 0 }}>{type.label}</Badge>
                      <Text fw={700} size="sm" lineClamp={1}>{item.title}</Text>
                    </Group>
                    <Text size="xs" c="dimmed" style={{ whiteSpace: "nowrap" }}>{formatRelativeDate(item.at)}</Text>
                  </Group>
                  <Text size="xs" c="dimmed" lineClamp={1}>{item.who}{item.status ? ` · ${statusLabel(item.status)}` : ""}</Text>
                  {item.preview && <Text size="sm" c="dimmed" lineClamp={1} mt={2}>{item.preview}</Text>}
                </>
              )
              if (opensThread) {
                return (
                  <Paper key={`${item.type}-${item.id}`} withBorder radius="md" p="sm" component="button" type="button" style={{ textAlign: "left", cursor: "pointer", width: "100%" }} onClick={() => setOpenThread({ id: item.id, type: item.type })}>{body}</Paper>
                )
              }
              if (item.href) {
                return <Paper key={`${item.type}-${item.id}`} withBorder radius="md" p="sm" component={Link} href={item.href}>{body}</Paper>
              }
              return <Paper key={`${item.type}-${item.id}`} withBorder radius="md" p="sm">{body}</Paper>
            })}

            {kind === "conversations" && items.map((item) => (
              <Paper key={item.conversationId} withBorder radius="md" p="sm" component="button" type="button" style={{ textAlign: "left", cursor: "pointer", width: "100%" }} onClick={() => setOpenThread({ id: item.conversationId, type: "message" })}>
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

            {kind === "listings" && items.map((item) => (
              <Paper key={item.id} withBorder radius="md" p="sm" component={Link} href={item.vehicle ? `/listings/vehicle/${item.vehicle.id}` : item.part ? `/listings/part/${item.part.id}` : "/moderation"}>
                <Group justify="space-between" gap="xs" wrap="nowrap">
                  <Text fw={700} size="sm" lineClamp={1}>{item.title}</Text>
                  <Text size="xs" c="dimmed" style={{ whiteSpace: "nowrap" }}>{formatRelativeDate(item.createdAt)}</Text>
                </Group>
                <Group gap={6} mt={6}>
                  <Badge variant="light" color={item.status === "ACTIVE" ? "indigo" : "gray"}>{statusLabel(item.status)}</Badge>
                  <Badge variant="light" color="gray">{rub(item.price)}</Badge>
                  <Badge variant="light" color="gray">Просмотров: {item.views}</Badge>
                  <Badge variant="light" color="gray">{who(item.user)}</Badge>
                </Group>
                {item.statusReason && <Text size="xs" c="dimmed" mt={4} lineClamp={2}>{item.statusReason}</Text>}
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
              <Row key={item.id} title={item.title} at={item.createdAt} meta={`Кому: ${who(item.user)} · ${item.isRead ? "прочитано" : "не прочитано"}${item.relatedType ? ` · ${item.relatedType}` : ""}`}>
                <Text size="sm" mt={4} style={{ whiteSpace: "pre-line" }} lineClamp={4}>{item.content}</Text>
              </Row>
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

            {kind === "fuel-reports" && items.map((item) => (
              <Row
                key={`${item.kind}-${item.id}`}
                at={item.createdAt}
                title={item.kind === "price"
                  ? `Цена ${FUEL_LABEL[item.fuel] || item.fuel}: ${(item.priceRub / 100).toLocaleString("ru-RU", { minimumFractionDigits: 2 })} ₽`
                  : `${FUEL_LABEL[item.fuel] || item.fuel}: ${item.state === "YES" ? "есть" : "нет"}${item.queue && item.queue !== "NONE" ? `, очередь ${item.queue === "BIG" ? "большая" : "небольшая"}` : ""}`}
                meta={`${item.stationName || item.stationId}${item.city ? ` · ${item.city}` : ""} · ${who(item.user)}${item.status && item.status !== "ACTIVE" ? ` · ${statusLabel(item.status)}` : ""}`}
              >
                {item.comment && <Text size="sm" mt={4}>{item.comment}</Text>}
              </Row>
            ))}

            {kind === "fuel-subscriptions" && items.map((item) => (
              <Row
                key={item.id}
                at={item.createdAt}
                title={item.stationName || (item.city ? `Город: ${item.city}` : "Подписка")}
                meta={`${who(item.user)}${item.fuel ? ` · ${FUEL_LABEL[item.fuel] || item.fuel}` : ""}${item.lastNotifiedAt ? ` · последнее сообщение ${formatRelativeDate(item.lastNotifiedAt)}` : " · сообщений ещё не было"}`}
              />
            ))}

            {kind === "part-requests" && items.map((item) => (
              <Row key={item.id} at={item.createdAt} title={item.partName || item.oemNumber || "Деталь не указана"} meta={`${[item.make, item.model, item.year].filter(Boolean).join(" ") || "Авто не указано"}${item.city ? ` · ${item.city}` : ""}`}>
                <Group gap={6} mt={6}>
                  <Badge variant="light" color={item.status === "NEW" ? "orange" : "gray"}>{statusLabel(item.status)}</Badge>
                  <Badge variant="light" color="gray">Предложений: {item._count.offers}</Badge>
                  <Badge variant="light" color="gray">{item.name}, {item.phone}</Badge>
                </Group>
              </Row>
            ))}

            {kind === "part-orders" && items.map((item) => (
              <Row key={item.id} at={item.createdAt} title={`${item.itemName} × ${item.quantity}`} meta={`${item.store?.name || "Магазин"} · ${rub(item.itemPriceRub * item.quantity)}${item.city ? ` · ${item.city}` : ""}`}>
                <Group gap={6} mt={6}>
                  <Badge variant="light" color={item.status === "NEW" ? "orange" : "gray"}>{statusLabel(item.status)}</Badge>
                  <Badge variant="light" color="gray">{item.contactName}, {item.contactPhone}</Badge>
                </Group>
                {item.comment && <Text size="sm" mt={4}>{item.comment}</Text>}
              </Row>
            ))}

            {kind === "payments" && items.map((item) => (
              <Row key={item.id} at={item.createdAt} title={`${rub(item.amountRub)} · ${item.tariffId} на ${item.durationDays} дн.`} meta={`${who(item.user)}${item.listing ? ` · ${item.listing.title}` : ""} · ${item.provider}`}>
                <Group gap={6} mt={6}>
                  <Badge variant="light" color={item.status === "PAID" ? "teal" : item.status === "FAILED" ? "red" : "gray"}>{statusLabel(item.status)}</Badge>
                  {item.paidAt && <Badge variant="light" color="gray">Оплачено {formatRelativeDate(item.paidAt)}</Badge>}
                </Group>
              </Row>
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

      <ThreadDrawer thread={openThread} onClose={() => setOpenThread(null)} />
    </Container>
  )
}

type ThreadMessage = {
  id: string
  content: string
  createdAt: string
  senderId: string
  sender: Person
  _count: { attachments: number }
}

function ThreadDrawer({ thread, onClose }: { thread: { id: string; type: string } | null; onClose: () => void }) {
  const { data, error, isLoading } = useSWR<{ messages: ThreadMessage[]; listing: { id: string; title: string } | null }>(
    thread ? `/api/admin/records/conversation?id=${encodeURIComponent(thread.id)}&type=${thread.type}` : null,
    fetchJson,
  )
  const firstSender = data?.messages[0]?.senderId
  const title = thread?.type === "support" ? "Обращение в поддержку" : thread?.type === "delivery" ? "Чат доставки" : "Переписка"

  return (
    <Drawer opened={Boolean(thread)} onClose={onClose} position="right" size="lg" title={title}>
      {error ? (
        <Text c="var(--market-danger-text)">Не удалось открыть диалог</Text>
      ) : isLoading || !data ? (
        <Group justify="center" py="xl"><Loader size="sm" /></Group>
      ) : (
        <Stack gap="xs">
          {data.listing && <Text size="sm" fw={700} c="var(--market-accent-text)">{data.listing.title}</Text>}
          <Group justify="space-between" gap="xs">
            <Text size="xs" c="dimmed">Просмотр записан в журнал действий.</Text>
            {thread?.type === "support" && <Button component={Link} href="/admin/support" size="compact-xs" variant="light">Ответить в «Поддержке»</Button>}
          </Group>
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
