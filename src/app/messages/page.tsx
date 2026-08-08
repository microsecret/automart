"use client"
export const dynamic = "force-dynamic"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import { useSession } from "next-auth/react"
import {
  Container,
  Stack,
  Text,
  Title,
  Center,
  Loader,
  Card,
  Avatar,
  Group,
  Box,
  Badge,
} from "@mantine/core"
import { IconMessageCircleOff } from "@tabler/icons-react"
import Link from "next/link"
import { formatRelativeDate } from "@/lib/format"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface Conversation {
  conversationId: string
  otherUserName: string
  otherUserImage: string | null
  lastMessage: string
  lastMessageAt: string
  unreadCount: number
  listingTitle?: string
}

export default function MessagesPage() {
  const { data: session, status } = useSession() || { data: null, status: 'unauthenticated' }
  const router = useRouter()
  const { data, isLoading } = useSWR<{ conversations: Conversation[] }>(
    session ? "/api/messages" : null,
    fetcher
  )

  useEffect(() => {
    if (status === "loading") return
    if (!session) router.push("/auth/signin")
  }, [session, status, router])

  if (status === "loading" || !session) {
    return (
      <Container py={80}><Center><Loader color="indigo" /></Center></Container>
    )
  }

  const conversations = data?.conversations || []

  return (
    <Container size="md" py="lg">
      <Stack gap="lg">
        <Title order={1} size="h2">Сообщения</Title>

        {isLoading ? (
          <Center py={60}><Loader color="indigo" /></Center>
        ) : conversations.length === 0 ? (
          <Center py={80}>
            <Stack align="center" gap="md">
              <IconMessageCircleOff size={48} color="#d4d4d8" />
              <Stack gap={4} align="center">
                <Text fw={500} c="#52525b">Нет диалогов</Text>
                <Text size="sm" c="#a1a1aa">Начните общение со страницы объявления</Text>
              </Stack>
            </Stack>
          </Center>
        ) : (
          <Stack gap="xs" className="av-fade-in">
            {conversations.map((conv) => (
              <Card
                key={conv.conversationId}
                component={Link}
                href={`/messages/${conv.conversationId}`}
                withBorder
                radius="md"
                p="md"
                style={{ transition: "all 150ms ease", borderColor: conv.unreadCount > 0 ? "#c7d2fe" : "#e4e4e7" }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#a5b4fc" }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = conv.unreadCount > 0 ? "#c7d2fe" : "#e4e4e7" }}
              >
                <Group gap="sm" align="flex-start">
                  <Avatar src={conv.otherUserImage} radius="xl" color="indigo">
                    {conv.otherUserName?.[0]?.toUpperCase()}
                  </Avatar>
                  <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                    <Group justify="space-between" gap="sm">
                      <Text size="sm" fw={600} c="#18181b">{conv.otherUserName || "Пользователь"}</Text>
                      <Text size="xs" c="#a1a1aa">{formatRelativeDate(conv.lastMessageAt)}</Text>
                    </Group>
                    {conv.listingTitle && (
                      <Text size="xs" c="#4f46e5" className="line-clamp-1">{conv.listingTitle}</Text>
                    )}
                    <Group gap="xs" align="center">
                      <Text size="sm" c="#71717a" className="line-clamp-1" style={{ flex: 1 }}>
                        {conv.lastMessage}
                      </Text>
                      {conv.unreadCount > 0 && (
                        <Badge color="indigo" size="xs" variant="filled" circle>
                          {conv.unreadCount}
                        </Badge>
                      )}
                    </Group>
                  </Stack>
                </Group>
              </Card>
            ))}
          </Stack>
        )}
      </Stack>
    </Container>
  )
}
