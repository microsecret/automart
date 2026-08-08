"use client"
export const dynamic = "force-dynamic"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import useSWR, { mutate as globalMutate } from "swr"
import { useSession } from "next-auth/react"
import {
  Container,
  Stack,
  Text,
  Title,
  Center,
  Loader,
  Button,
  Group,
  Card,
  ThemeIcon,
  ActionIcon,
  Box,
  Badge,
} from "@mantine/core"
import {
  IconBell,
  IconBellOff,
  IconCheck,
  IconMessageCircle2,
  IconHeart,
  IconStar,
  IconTrash,
} from "@tabler/icons-react"
import { formatRelativeDate } from "@/lib/format"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface Notification {
  id: string
  title: string
  content: string | null
  isRead: boolean
  type: string | null
  createdAt: string
}

function getNotifIcon(type: string | null) {
  if (type === "MESSAGE") return <IconMessageCircle2 size={20} />
  if (type === "FAVORITE") return <IconHeart size={20} />
  if (type === "REVIEW") return <IconStar size={20} />
  return <IconBell size={20} />
}

export default function NotificationsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { data, isLoading } = useSWR<{ notifications: Notification[] }>(
    session ? "/api/notifications" : null,
    fetcher
  )
  const [markingAll, setMarkingAll] = useState(false)

  useEffect(() => {
    if (status === "loading") return
    if (!session) router.push("/auth/signin")
  }, [session, status, router])

  const markAllRead = async () => {
    setMarkingAll(true)
    try {
      await fetch("/api/notifications", { method: "POST" })
      globalMutate("/api/notifications")
    } finally {
      setMarkingAll(false)
    }
  }

  const markOneRead = async (id: string) => {
    await fetch(`/api/notifications?notificationId=${id}`, { method: "PUT" })
    globalMutate("/api/notifications")
  }

  if (status === "loading" || !session) {
    return (
      <Container py={80}>
        <Center><Loader color="indigo" /></Center>
      </Container>
    )
  }

  const notifs = data?.notifications || []
  const unreadCount = notifs.filter((n) => !n.isRead).length

  return (
    <Container size="md" py="lg">
      <Stack gap="lg">
        <Group justify="space-between">
          <Stack gap={2}>
            <Title order={1} size="h2">Уведомления</Title>
            <Text size="sm" c="#71717a">
              {unreadCount > 0 ? `${unreadCount} непрочитанных` : "Все прочитаны"}
            </Text>
          </Stack>
          {unreadCount > 0 && (
            <Button
              variant="light"
              color="indigo"
              size="sm"
              leftSection={<IconCheck size={16} />}
              loading={markingAll}
              onClick={markAllRead}
            >
              Отметить все
            </Button>
          )}
        </Group>

        {isLoading ? (
          <Center py={60}><Loader color="indigo" /></Center>
        ) : notifs.length === 0 ? (
          <Center py={80}>
            <Stack align="center" gap="md">
              <IconBellOff size={48} color="#d4d4d8" />
              <Stack gap={4} align="center">
                <Text fw={500} c="#52525b">Нет уведомлений</Text>
                <Text size="sm" c="#a1a1aa">Здесь появятся новые события</Text>
              </Stack>
            </Stack>
          </Center>
        ) : (
          <Stack gap="xs" className="av-fade-in">
            {notifs.map((n) => (
              <Card
                key={n.id}
                withBorder
                radius="md"
                p="md"
                style={{
                  borderColor: n.isRead ? "#e4e4e7" : "#c7d2fe",
                  background: n.isRead ? "#fff" : "#f5f3ff",
                  transition: "all 150ms ease",
                }}
              >
                <Group gap="sm" align="flex-start">
                  <ThemeIcon
                    variant={n.isRead ? "light" : "filled"}
                    color="indigo"
                    size={38}
                    radius="md"
                  >
                    {getNotifIcon(n.type)}
                  </ThemeIcon>
                  <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                    <Group gap={6} align="center">
                      <Text size="sm" fw={600} c="#18181b">{n.title}</Text>
                      {!n.isRead && <Badge color="indigo" size="xs" variant="filled">Новое</Badge>}
                    </Group>
                    {n.content && (
                      <Text size="xs" c="#71717a" className="line-clamp-2">{n.content}</Text>
                    )}
                    <Text size="xs" c="#a1a1aa">{formatRelativeDate(n.createdAt)}</Text>
                  </Stack>
                  {!n.isRead && (
                    <ActionIcon
                      variant="subtle"
                      color="indigo"
                      size="sm"
                      onClick={() => markOneRead(n.id)}
                      aria-label="Прочитать"
                    >
                      <IconCheck size={16} />
                    </ActionIcon>
                  )}
                </Group>
              </Card>
            ))}
          </Stack>
        )}
      </Stack>
    </Container>
  )
}
