"use client"

export const dynamic = "force-dynamic"

import { useDeferredValue, useState } from "react"
import useSWR from "swr"
import { notifications } from "@mantine/notifications"
import { ActionIcon, Alert, Avatar, Badge, Box, Button, Group, Menu, Modal, Pagination, Paper, ScrollArea, Select, Skeleton, Stack, Table, Text, TextInput, ThemeIcon, Title, Tooltip } from "@mantine/core"
import { IconBrandTelegram, IconCircleCheck, IconDotsVertical, IconMail, IconMessageCircle2, IconSearch, IconShieldCheck, IconTag, IconUsers } from "@tabler/icons-react"
import { formatDate } from "@/lib/format"
import { fetchJson } from "@/lib/api-client"
import { AsyncErrorState, EmptyState } from "@/components/ui/AsyncStates"

type DirectoryUser = {
  id: string
  name: string | null
  email: string | null
  registrationChannel: "WEB" | "TELEGRAM"
  image: string | null
  telegramUsername: string | null
  telegramVerifiedAt: string | null
  emailVerified: string | null
  role: string
  createdAt: string
  _count: { listings: number; messagesSent: number }
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
  const [isRoleSaving, setIsRoleSaving] = useState(false)
  const [roleError, setRoleError] = useState("")

  const openRoleEditor = (user: DirectoryUser) => {
    setEditingUser(user)
    setNextRole(user.role)
    setRoleError("")
  }

  const saveRole = async () => {
    if (!editingUser || nextRole === editingUser.role) {
      setEditingUser(null)
      return
    }

    setIsRoleSaving(true)
    setRoleError("")
    try {
      await fetchJson(`/api/admin/users/${editingUser.id}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: nextRole }),
      })
      await mutate()
      setEditingUser(null)
      notifications.show({ title: "Роль обновлена", message: "Новые права пользователя вступили в силу сразу.", color: "teal" })
    } catch (updateError) {
      setRoleError(updateError instanceof Error ? updateError.message : "Не удалось изменить роль пользователя.")
    } finally {
      setIsRoleSaving(false)
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
                      <Table.Td><Badge size="sm" radius="xl" color={ROLE_META[user.role]?.color || "gray"} variant="light">{ROLE_META[user.role]?.label || user.role}</Badge></Table.Td>
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
                            <Menu.Item leftSection={<IconShieldCheck size={15} />} onClick={() => openRoleEditor(user)}>Изменить роль</Menu.Item>
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
      <Modal opened={Boolean(editingUser)} onClose={() => !isRoleSaving && setEditingUser(null)} title="Изменить роль" centered radius="lg">
        <Stack gap="sm">
          <Paper withBorder radius="md" p="sm" bg="gray.0">
            <Text fw={700} size="sm">{editingUser?.name || "Без имени"}</Text>
            <Text size="xs" c="dimmed">{editingUser?.email || "Регистрация через Telegram"}</Text>
          </Paper>
          <Select label="Роль на площадке" data={ROLE_OPTIONS} value={nextRole} onChange={(value) => setNextRole(value || "USER")} allowDeselect={false} />
          <Alert color="orange" variant="light" title="Изменение доступа">
            Новые полномочия начинают действовать на следующем запросе пользователя. Назначайте роль администратора только сотруднику, которому доверяете полный доступ.
          </Alert>
          {roleError && <Alert color="red" title="Роль не изменена">{roleError}</Alert>}
          <Group justify="flex-end">
            <Button variant="default" disabled={isRoleSaving} onClick={() => setEditingUser(null)}>Отмена</Button>
            <Button color="indigo" loading={isRoleSaving} onClick={() => void saveRole()}>Сохранить роль</Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  )
}
