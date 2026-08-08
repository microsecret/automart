"use client"
export const dynamic = "force-dynamic"


import useSWR from "swr"
import { Box, Stack, Text, Center, Loader, Table, Avatar, Badge, Group, Title } from "@mantine/core"
import { formatDate } from "@/lib/format"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function AdminUsersPage() {
  const { data, isLoading } = useSWR<{ users: any[] }>("/api/users?limit=50", fetcher)

  const users = data?.users || []

  return (
    <Box p={{ base: "sm", md: "md" }}>
      <Stack gap="md">
        <Stack gap={0}>
          <Title order={2} size="h3" ff="var(--font-display),sans-serif">Пользователи</Title>
          <Text size="xs" c="gray.5">{users.length} зарегистрировано</Text>
        </Stack>

        {isLoading ? (
          <Center py={40}><Loader size="sm" color="indigo" /></Center>
        ) : users.length === 0 ? (
          <Center py={40}><Text size="sm" c="gray.6">Нет пользователей</Text></Center>
        ) : (
          <Box style={{ overflowX: "auto" }}>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Пользователь</Table.Th>
                  <Table.Th>Email</Table.Th>
                  <Table.Th>Роль</Table.Th>
                  <Table.Th>Регистрация</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {users.map((u) => (
                  <Table.Tr key={u.id}>
                    <Table.Td>
                      <Group gap="sm">
                        <Avatar src={u.image} size="sm" radius="xl" color="indigo">{u.name?.[0]?.toUpperCase()}</Avatar>
                        <Text size="sm" fw={500}>{u.name || "Без имени"}</Text>
                      </Group>
                    </Table.Td>
                    <Table.Td><Text size="xs" c="gray.5">{u.email}</Text></Table.Td>
                    <Table.Td>
                      <Badge variant="light" color={u.role === "ADMIN" ? "red" : "indigo"} size="sm">{u.role}</Badge>
                    </Table.Td>
                    <Table.Td><Text size="xs" c="gray.4">{formatDate(u.createdAt)}</Text></Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Box>
        )}
      </Stack>
    </Box>
  )
}
