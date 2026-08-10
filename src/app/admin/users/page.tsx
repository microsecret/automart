"use client"

export const dynamic = "force-dynamic"

import { useDeferredValue, useState } from "react"
import useSWR from "swr"
import { Avatar, Badge, Box, Center, Group, Pagination, Paper, ScrollArea, Skeleton, Stack, Table, Text, TextInput, ThemeIcon, Title, Tooltip } from "@mantine/core"
import { IconBrandTelegram, IconCircleCheck, IconMail, IconMessageCircle2, IconSearch, IconTag, IconUsers } from "@tabler/icons-react"
import { formatDate } from "@/lib/format"
import { fetchJson } from "@/lib/api-client"
import { AsyncErrorState, EmptyState } from "@/components/ui/AsyncStates"

type DirectoryUser = {
  id: string
  name: string | null
  email: string
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
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {users.map((user) => (
                    <Table.Tr key={user.id}>
                      <Table.Td>
                        <Group gap="sm" wrap="nowrap">
                          <Avatar src={user.image} size="md" radius="xl" color="indigo">{user.name?.[0]?.toUpperCase() || user.email[0]?.toUpperCase()}</Avatar>
                          <Stack gap={1} miw={180}>
                            <Text size="sm" fw={700} lineClamp={1}>{user.name || "Без имени"}</Text>
                            <Text size="xs" c="dimmed" lineClamp={1}>{user.email}</Text>
                          </Stack>
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Group gap={5} wrap="wrap">
                          <Tooltip label={user.emailVerified ? "Email подтверждён" : "Email не подтверждён"} withArrow>
                            <Badge size="sm" color={user.emailVerified ? "teal" : "gray"} variant="light" leftSection={<IconMail size={11} />}>Email</Badge>
                          </Tooltip>
                          <Tooltip label={user.telegramVerifiedAt ? "Telegram подтверждён" : "Telegram не подтверждён"} withArrow>
                            <Badge size="sm" color={user.telegramVerifiedAt ? "indigo" : "gray"} variant="light" leftSection={user.telegramVerifiedAt ? <IconCircleCheck size={11} /> : <IconBrandTelegram size={11} />}>Telegram</Badge>
                          </Tooltip>
                          {user.telegramUsername && <Text size="xs" c="dimmed">@{user.telegramUsername}</Text>}
                        </Group>
                      </Table.Td>
                      <Table.Td><Badge size="sm" radius="xl" color={user.role === "ADMIN" ? "violet" : user.role === "MODERATOR" ? "orange" : "indigo"} variant="light">{user.role}</Badge></Table.Td>
                      <Table.Td>
                        <Group gap="sm" wrap="nowrap">
                          <Tooltip label="Объявлений" withArrow><Group gap={4}><IconTag size={14} color="#6366f1" /><Text size="xs" fw={700}>{user._count.listings}</Text></Group></Tooltip>
                          <Tooltip label="Отправлено сообщений" withArrow><Group gap={4}><IconMessageCircle2 size={14} color="#0ea5e9" /><Text size="xs" fw={700}>{user._count.messagesSent}</Text></Group></Tooltip>
                        </Group>
                      </Table.Td>
                      <Table.Td><Text size="xs" c="dimmed">{formatDate(user.createdAt)}</Text></Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          </Paper>
        )}

        {data && data.pagination.pages > 1 && <Group justify="center"><Pagination value={page} onChange={setPage} total={data.pagination.pages} color="indigo" radius="md" size="sm" /></Group>}
      </Stack>
    </Box>
  )
}
