"use client"

export const dynamic = "force-dynamic"

import { useDeferredValue, useState } from "react"
import useSWR from "swr"
import { notifications } from "@mantine/notifications"
import { ActionIcon, Alert, Avatar, Badge, Box, Button, Divider, Group, Menu, Modal, Pagination, Paper, ScrollArea, Select, SimpleGrid, Skeleton, Stack, Table, Text, Textarea, TextInput, ThemeIcon, Title, Tooltip } from "@mantine/core"
import { IconBan, IconBrandTelegram, IconCircleCheck, IconDotsVertical, IconMail, IconMessageCircle2, IconSearch, IconSend, IconShieldCheck, IconTag, IconUsers } from "@tabler/icons-react"
import { formatDate } from "@/lib/format"
import { fetchJson } from "@/lib/api-client"
import { AsyncErrorState, EmptyState } from "@/components/ui/AsyncStates"

type DirectoryUser = {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  registrationChannel: "WEB" | "TELEGRAM"
  image: string | null
  telegramUsername: string | null
  telegramVerifiedAt: string | null
  emailVerified: string | null
  role: string
  accountStatus: "ACTIVE" | "RESTRICTED" | "BANNED"
  restrictionReason: string | null
  statusUpdatedAt: string | null
  createdAt: string
  _count: { listings: number; messagesSent: number }
}

type AdminUserDetail = DirectoryUser & {
  telegramId: string | null
  updatedAt: string
  listings: Array<{ id: string; title: string; price: number; status: string; updatedAt: string }>
  _count: DirectoryUser["_count"] & { notifications: number; deliveryOrdersAsBuyer: number }
}

type DirectoryResponse = {
  users: DirectoryUser[]
  pagination: { page: number; limit: number; total: number; pages: number }
}

const ROLE_META: Record<string, { label: string; color: string }> = {
  USER: { label: "Пользователь", color: "indigo" },
  VERIFIED_USER: { label: "Проверенный", color: "teal" },
  PARTNER: { label: "Партнёр", color: "cyan" },
  MODERATOR: { label: "Модератор", color: "orange" },
  ADMIN: { label: "Администратор", color: "grape" },
}

const ROLE_OPTIONS = Object.entries(ROLE_META).map(([value, meta]) => ({ value, label: meta.label }))
const STATUS_META = {
  ACTIVE: { label: "Активен", color: "teal" },
  RESTRICTED: { label: "Ограничен", color: "orange" },
  BANNED: { label: "Заблокирован", color: "red" },
} as const
const STATUS_OPTIONS = Object.entries(STATUS_META).map(([value, meta]) => ({ value, label: meta.label }))

function DirectorySkeleton() {
  return (
    <Paper className="admin-directory__table" radius="lg" p="md" withBorder>
      <Stack gap="sm">
        {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} h={42} radius="md" />)}
      </Stack>
    </Paper>
  )
}

export default function AdminUsersPage() {
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(1)
  const deferredQuery = useDeferredValue(query.trim())
  const url = `/api/users?scope=admin&page=${page}&limit=24${deferredQuery ? `&q=${encodeURIComponent(deferredQuery)}` : ""}`
  const { data, error, isLoading, mutate } = useSWR<DirectoryResponse>(url, fetchJson)
  const users = data?.users || []
  const total = data?.pagination.total || 0
  const [editingUser, setEditingUser] = useState<DirectoryUser | null>(null)
  const [nextRole, setNextRole] = useState("USER")
  const [nextStatus, setNextStatus] = useState<DirectoryUser["accountStatus"]>("ACTIVE")
  const [restrictionReason, setRestrictionReason] = useState("")
  const [userDetail, setUserDetail] = useState<AdminUserDetail | null>(null)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [isRoleSaving, setIsRoleSaving] = useState(false)
  const [roleError, setRoleError] = useState("")
  const [notificationTitle, setNotificationTitle] = useState("")
  const [notificationContent, setNotificationContent] = useState("")
  const [isNotificationSending, setIsNotificationSending] = useState(false)

  const openRoleEditor = (user: DirectoryUser) => {
    setEditingUser(user)
    setNextRole(user.role)
    setNextStatus(user.accountStatus)
    setRestrictionReason(user.restrictionReason || "")
    setNotificationTitle("")
    setNotificationContent("")
    setUserDetail(null)
    setRoleError("")
    setIsDetailLoading(true)
    void fetchJson<{ user: AdminUserDetail }>(`/api/admin/users/${user.id}`)
      .then((response) => setUserDetail(response.user))
      .catch((detailError) => setRoleError(detailError instanceof Error ? detailError.message : "Не удалось загрузить карточку пользователя."))
      .finally(() => setIsDetailLoading(false))
  }

  const saveRole = async () => {
    if (!editingUser) return

    setIsRoleSaving(true)
    setRoleError("")
    try {
      await fetchJson(`/api/admin/users/${editingUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: nextRole, accountStatus: nextStatus, restrictionReason }),
      })
      await mutate()
      setEditingUser(null)
      notifications.show({ title: "Доступ обновлён", message: "Роль и статус аккаунта вступили в силу сразу.", color: "teal" })
    } catch (updateError) {
      setRoleError(updateError instanceof Error ? updateError.message : "Не удалось изменить роль пользователя.")
    } finally {
      setIsRoleSaving(false)
    }
  }

  const sendNotification = async () => {
    if (!editingUser) return
    setIsNotificationSending(true)
    setRoleError("")
    try {
      const result = await fetchJson<{ telegramDelivered: boolean }>(`/api/admin/users/${editingUser.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: notificationTitle, content: notificationContent, deliverTelegram: true }),
      })
      setNotificationTitle("")
      setNotificationContent("")
      notifications.show({
        title: "Уведомление отправлено",
        message: result.telegramDelivered ? "Появилось в кабинете и доставлено в Telegram." : "Появилось в личном кабинете пользователя.",
        color: "teal",
      })
    } catch (notificationError) {
      setRoleError(notificationError instanceof Error ? notificationError.message : "Не удалось отправить уведомление.")
    } finally {
      setIsNotificationSending(false)
    }
  }

  return (
    <Box className="admin-workspace admin-directory" p={{ base: "sm", md: "md" }}>
      <Stack gap="md">
        <Group justify="space-between" align="flex-end" gap="md" wrap="wrap">
          <Group gap="sm" align="center">
            <ThemeIcon size={44} radius="lg" color="indigo" variant="light"><IconUsers size={22} /></ThemeIcon>
            <Stack gap={1}>
              <Title order={1} size="h3" ff="var(--font-display),sans-serif">Пользователи</Title>
              <Text size="sm" c="dimmed">Учетные записи, верификация и активность площадки{data ? ` · ${total}` : ""}</Text>
            </Stack>
          </Group>
          <TextInput
            className="admin-directory__search"
            value={query}
            onChange={(event) => { setQuery(event.currentTarget.value); setPage(1) }}
            placeholder="Имя, email, телефон или Telegram"
            leftSection={<IconSearch size={16} />}
            aria-label="Поиск пользователей"
            radius="md"
          />
        </Group>

        {error ? <AsyncErrorState title="Не удалось загрузить пользователей" description="Данные не изменены. Повторите запрос — это не означает, что список пуст." onRetry={() => void mutate()} /> : isLoading ? (
          <DirectorySkeleton />
        ) : users.length === 0 ? (
          <EmptyState title={deferredQuery ? "Никого не найдено" : "Пользователей пока нет"} description={deferredQuery ? "Проверьте запрос или сбросьте поиск." : "После регистрации здесь появятся учётные записи и статусы проверки."} actionLabel={deferredQuery ? "Сбросить поиск" : undefined} onAction={deferredQuery ? () => { setQuery(""); setPage(1) } : undefined} />
        ) : (
          <Paper className="admin-directory__table" radius="lg" p={0} withBorder>
            <ScrollArea type="auto">
              <Table verticalSpacing="sm" horizontalSpacing="md" highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Пользователь</Table.Th>
                    <Table.Th>Проверки</Table.Th>
                    <Table.Th>Роль</Table.Th>
                    <Table.Th>Активность</Table.Th>
                    <Table.Th>Регистрация</Table.Th>
                    <Table.Th aria-label="Действия" />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {users.map((user) => (
                    <Table.Tr key={user.id}>
                      <Table.Td>
                        <Group gap="sm" wrap="nowrap">
                          <Avatar src={user.image} size="md" radius="xl" color="indigo">{user.name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || "T"}</Avatar>
                          <Stack gap={1} miw={180}>
                            <Text size="sm" fw={700} lineClamp={1}>{user.name || "Без имени"}</Text>
                            <Text size="xs" c="dimmed" lineClamp={1}>{user.email || "Регистрация через Telegram"}</Text>
                            {user.phone && <Text size="xs" c="dimmed" lineClamp={1}>{user.phone}</Text>}
                          </Stack>
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Group gap={5} wrap="wrap">
                          {user.registrationChannel === "WEB" && <Tooltip label={user.emailVerified ? "Email подтверждён" : "Email не подтверждён"} withArrow>
                            <Badge size="sm" color={user.emailVerified ? "teal" : "gray"} variant="light" leftSection={<IconMail size={11} />}>Email</Badge>
                          </Tooltip>}
                          {user.registrationChannel === "TELEGRAM" && <Badge size="sm" color="blue" variant="light" leftSection={<IconBrandTelegram size={11} />}>Через Telegram</Badge>}
                          <Tooltip label={user.telegramVerifiedAt ? "Telegram подтверждён" : "Telegram не подтверждён"} withArrow>
                            <Badge size="sm" color={user.telegramVerifiedAt ? "indigo" : "gray"} variant="light" leftSection={user.telegramVerifiedAt ? <IconCircleCheck size={11} /> : <IconBrandTelegram size={11} />}>Telegram</Badge>
                          </Tooltip>
                          {user.telegramUsername && <Text size="xs" c="dimmed">@{user.telegramUsername}</Text>}
                        </Group>
                      </Table.Td>
                      <Table.Td><Stack gap={4}><Badge size="sm" radius="xl" color={ROLE_META[user.role]?.color || "gray"} variant="light">{ROLE_META[user.role]?.label || user.role}</Badge><Badge size="xs" radius="xl" color={STATUS_META[user.accountStatus]?.color || "gray"} variant="dot">{STATUS_META[user.accountStatus]?.label || user.accountStatus}</Badge></Stack></Table.Td>
                      <Table.Td>
                        <Group gap="sm" wrap="nowrap">
                          <Tooltip label="Объявлений" withArrow><Group gap={4}><IconTag size={14} color="#6366f1" /><Text size="xs" fw={700}>{user._count.listings}</Text></Group></Tooltip>
                          <Tooltip label="Отправлено сообщений" withArrow><Group gap={4}><IconMessageCircle2 size={14} color="#0ea5e9" /><Text size="xs" fw={700}>{user._count.messagesSent}</Text></Group></Tooltip>
                        </Group>
                      </Table.Td>
                      <Table.Td><Text size="xs" c="dimmed">{formatDate(user.createdAt)}</Text></Table.Td>
                      <Table.Td>
                        <Menu position="bottom-end" shadow="md" width={208} withinPortal>
                          <Menu.Target>
                            <ActionIcon variant="subtle" color="gray" aria-label={`Действия: ${user.name || user.email || "Telegram"}`}><IconDotsVertical size={17} /></ActionIcon>
                          </Menu.Target>
                          <Menu.Dropdown>
                            <Menu.Label>Управление пользователем</Menu.Label>
                            <Menu.Item leftSection={<IconShieldCheck size={15} />} onClick={() => openRoleEditor(user)}>Открыть карточку</Menu.Item>
                          </Menu.Dropdown>
                        </Menu>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          </Paper>
        )}

        {data && data.pagination.pages > 1 && <Group justify="center"><Pagination value={page} onChange={setPage} total={data.pagination.pages} color="indigo" radius="md" size="sm" /></Group>}
      </Stack>
      <Modal opened={Boolean(editingUser)} onClose={() => !isRoleSaving && !isNotificationSending && setEditingUser(null)} title="Управление пользователем" centered radius="lg" size="lg">
        <Stack gap="md">
          <Paper withBorder radius="md" p="sm" bg="gray.0">
            <Group justify="space-between" align="flex-start" gap="sm">
              <Box><Text fw={700} size="sm">{editingUser?.name || "Без имени"}</Text><Text size="xs" c="dimmed">{editingUser?.email || "Регистрация через Telegram"}{editingUser?.phone ? ` · ${editingUser.phone}` : ""}</Text></Box>
              <Badge color={STATUS_META[nextStatus]?.color || "gray"} variant="light">{STATUS_META[nextStatus]?.label || nextStatus}</Badge>
            </Group>
          </Paper>
          {isDetailLoading ? <Skeleton h={74} radius="md" /> : userDetail && <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xs">
            <Paper withBorder radius="md" p="sm"><Text fw={800}>{userDetail._count.listings}</Text><Text size="xs" c="dimmed">объявлений</Text></Paper>
            <Paper withBorder radius="md" p="sm"><Text fw={800}>{userDetail._count.messagesSent}</Text><Text size="xs" c="dimmed">сообщений</Text></Paper>
            <Paper withBorder radius="md" p="sm"><Text fw={800}>{userDetail._count.deliveryOrdersAsBuyer}</Text><Text size="xs" c="dimmed">доставок</Text></Paper>
            <Paper withBorder radius="md" p="sm"><Text fw={800}>{userDetail._count.notifications}</Text><Text size="xs" c="dimmed">уведомлений</Text></Paper>
          </SimpleGrid>}
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Select label="Роль на площадке" data={ROLE_OPTIONS} value={nextRole} onChange={(value) => setNextRole(value || "USER")} allowDeselect={false} />
            <Select label="Статус аккаунта" data={STATUS_OPTIONS} value={nextStatus} onChange={(value) => setNextStatus((value || "ACTIVE") as DirectoryUser["accountStatus"])} allowDeselect={false} />
          </SimpleGrid>
          {nextStatus !== "ACTIVE" && <Textarea label="Причина ограничения" description="Её видит только администрация." value={restrictionReason} onChange={(event) => setRestrictionReason(event.currentTarget.value)} minRows={2} maxLength={500} required />}
          <Alert color="orange" variant="light" title="Изменение доступа">
            Блокировка и ограничение прекращают действующую сессию на следующем запросе. Роль партнёра открывает только назначенные ему процессы доставки.
          </Alert>
          <Group justify="flex-end"><Button variant="default" disabled={isRoleSaving} onClick={() => setEditingUser(null)}>Отмена</Button><Button color={nextStatus === "BANNED" ? "red" : "indigo"} leftSection={nextStatus === "BANNED" ? <IconBan size={16} /> : <IconShieldCheck size={16} />} loading={isRoleSaving} onClick={() => void saveRole()}>Сохранить доступ</Button></Group>

          <Divider label="Сообщение пользователю" labelPosition="left" />
          <TextInput label="Заголовок" placeholder="Например: Требуется уточнение по объявлению" value={notificationTitle} onChange={(event) => setNotificationTitle(event.currentTarget.value)} maxLength={100} />
          <Textarea label="Текст" description="Уведомление появится в кабинете и, если Telegram подтверждён, придёт в бот." placeholder="Напишите, что нужно сделать пользователю" value={notificationContent} onChange={(event) => setNotificationContent(event.currentTarget.value)} minRows={3} maxLength={1500} />
          <Group justify="flex-end"><Button variant="light" color="indigo" leftSection={<IconSend size={16} />} loading={isNotificationSending} disabled={notificationTitle.trim().length < 3 || notificationContent.trim().length < 3} onClick={() => void sendNotification()}>Отправить уведомление</Button></Group>

          <Divider label="Последние объявления" labelPosition="left" />
          {isDetailLoading ? <Skeleton h={90} radius="md" /> : userDetail?.listings.length ? <Stack gap="xs">{userDetail.listings.map((listing) => <Paper key={listing.id} withBorder radius="md" p="sm"><Group justify="space-between" wrap="nowrap"><Box miw={0}><Text size="sm" fw={700} lineClamp={1}>{listing.title}</Text><Text size="xs" c="dimmed">{listing.price.toLocaleString("ru-RU")} ₽ · {listing.status}</Text></Box><Button component="a" href={`/listings/${listing.id}`} target="_blank" variant="subtle" size="compact-xs">Открыть</Button></Group></Paper>)}</Stack> : <Text size="sm" c="dimmed">У пользователя пока нет объявлений.</Text>}
          {roleError && <Alert color="red" title="Роль не изменена">{roleError}</Alert>}
        </Stack>
      </Modal>
    </Box>
  )
}
