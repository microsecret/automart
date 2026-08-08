"use client"
export const dynamic = "force-dynamic"
import useSWR, { useSWRConfig } from "swr"
import Link from "next/link"
import { Box, Stack, Group, Text, Paper, Center, Loader, ThemeIcon, Button, Badge, SimpleGrid } from "@mantine/core"
import { IconBell, IconCircleCheck, IconAlertTriangle, IconInfoCircle, IconAlertCircle, IconTrash } from "@tabler/icons-react"

const fetcher = (url) => fetch(url).then((r) => r.json())

const TYPE_CONFIG = {
  SUCCESS: { icon: IconCircleCheck, color: "#059669", bg: "#ecfdf5" },
  WARNING: { icon: IconAlertTriangle, color: "#ea580c", bg: "#fff7ed" },
  ERROR: { icon: IconAlertCircle, color: "#e11d48", bg: "#fff1f2" },
  INFO: { icon: IconInfoCircle, color: "#4f46e5", bg: "#eef2ff" },
}

export default function NotificationsPage() {
  const { data, isLoading } = useSWR("/api/notifications?limit=50", fetcher)
  const { mutate } = useSWRConfig()

  const markAllRead = async () => {
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }) })
    mutate("/api/notifications?limit=50")
  }

  const notifications = data?.notifications || []
  const unread = notifications.filter((n) => !n.isRead).length

  return (
    <Box p={{ base: "sm", md: "md" }}>
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <Stack gap={0}>
            <Group gap="sm" align="center">
              <ThemeIcon variant="light" color="indigo" size={36} radius="md"><IconBell size={20} /></ThemeIcon>
              <Text component="h1" fw={800} fz={22} c="#18181b" ff="var(--font-display),sans-serif">Уведомления</Text>
              {unread > 0 && <Badge size="sm" color="red" variant="filled">{unread} новых</Badge>}
            </Group>
          </Stack>
          {unread > 0 && <Button variant="subtle" size="xs" color="indigo" onClick={markAllRead}>Отметить все прочитанными</Button>}
        </Group>

        {isLoading ? (
          <Center py={80}><Loader size="sm" color="indigo" /></Center>
        ) : notifications.length === 0 ? (
          <Paper radius="md" p="xl" withBorder>
            <Center>
              <Stack align="center" gap="sm">
                <ThemeIcon variant="light" color="gray" size={56} radius="md"><IconBell size={28} /></ThemeIcon>
                <Text c="#71717a">Нет уведомлений</Text>
              </Stack>
            </Center>
          </Paper>
        ) : (
          <Stack gap="xs">
            {notifications.map((n) => {
              const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.INFO
              const Icon = cfg.icon
              return (
                <Paper key={n.id} radius="md" p="sm" withBorder style={{
                  borderColor: n.isRead ? "#f4f4f5" : cfg.color + "40",
                  background: n.isRead ? "#fff" : cfg.bg + "60",
                  opacity: n.isRead ? 0.7 : 1,
                }}>
                  <Group gap="sm" align="flex-start" wrap="nowrap">
                    <Box style={{ width: 36, height: 36, borderRadius: 8, background: cfg.bg, display: "flex", alignItems: "center", justifyContent: "center", color: cfg.color, flexShrink: 0 }}>
                      <Icon size={20} />
                    </Box>
                    <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                      <Group gap="sm" align="center">
                        <Text fw={600} fz="sm" c="#18181b">{n.title}</Text>
                        {!n.isRead && <Badge size="xs" color="red" variant="filled" circle>p</Badge>}
                      </Group>
                      <Text fz="xs" c="#52525b">{n.content}</Text>
                    </Stack>
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
