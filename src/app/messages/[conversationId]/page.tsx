"use client"
export const dynamic = "force-dynamic"

import { useEffect, useRef, useState, useCallback } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import useSWR, { mutate as globalMutate } from "swr"
import { useSession } from "next-auth/react"
import { notifications } from "@mantine/notifications"
import {
  Container,
  Stack,
  Group,
  Text,
  Center,
  Loader,
  TextInput,
  Button,
  Avatar,
  Box,
  Paper,
} from "@mantine/core"
import { IconArrowLeft, IconSend } from "@tabler/icons-react"
import Link from "next/link"
import { formatRelativeDate } from "@/lib/format"
import { fetchJson } from "@/lib/api-client"
import { AsyncErrorState } from "@/components/ui/AsyncStates"

interface Message {
  id: string
  content: string
  senderId: string
  createdAt: string
}

type ConversationResponse = {
  messages: Message[]
  otherUser: { id: string; name: string | null; image: string | null } | null
  listingId: string | null
}

export default function ConversationPage() {
  const { conversationId } = useParams<{ conversationId: string }>()
  const searchParams = useSearchParams()
  const { data: session, status } = useSession() || { data: null, status: 'unauthenticated' }
  const router = useRouter()
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const recipientId = searchParams.get("recipientId")
  const requestedListingId = searchParams.get("listingId")
  const isNewConversation = Boolean(recipientId)
  const { data, error, isLoading, mutate } = useSWR<ConversationResponse>(
    session && !isNewConversation ? `/api/messages/${conversationId}` : null,
    fetchJson,
    { refreshInterval: 5000 }
  )

  useEffect(() => { scrollToBottom() }, [data])

  useEffect(() => {
    if (status === "loading") return
    if (!session) router.push("/auth/signin")
  }, [session, status, router])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [data?.messages])

  const send = useCallback(async () => {
    if (!text.trim() || !session) return
    setSending(true)
    const content = text.trim()
    setText("")
    try {
      const receiverId = recipientId || data?.otherUser?.id
      if (!receiverId) throw new Error("Не удалось определить собеседника")
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, receiverId, listingId: requestedListingId || data?.listingId || null }),
      })
      const payload = await response.json().catch(() => null) as { error?: string; conversationId?: string } | null
      if (!response.ok) throw new Error(payload?.error || "Не удалось отправить сообщение")
      if (isNewConversation && payload?.conversationId) {
        router.replace(`/messages/${payload.conversationId}`)
      } else {
        globalMutate(`/api/messages/${conversationId}`)
      }
    } catch (error) {
      setText(content)
      notifications.show({
        title: "Сообщение не отправлено",
        message: error instanceof Error ? error.message : "Повторите попытку.",
        color: "red",
      })
    } finally {
      setSending(false)
    }
  }, [text, session, recipientId, data?.otherUser?.id, requestedListingId, data?.listingId, isNewConversation, conversationId, router])

  if (status === "loading" || !session) {
    return <Container py={80}><Center><Loader color="indigo" /></Center></Container>
  }

  const messages = data?.messages || []
  const userId = session.user.id

  return (
    <Container size="md" py="lg" style={{ height: "calc(100vh - 64px - 80px)" }}>
      <Stack gap="md" style={{ height: "100%" }}>
        {/* Шапка чата */}
        <Group gap="sm">
          <Button component={Link} href="/messages" variant="subtle" color="gray" p={6} aria-label="Назад">
            <IconArrowLeft size={20} />
          </Button>
          <Avatar src={data?.otherUser?.image} radius="xl" color="indigo" size="sm">
            {data?.otherUser?.name?.[0]?.toUpperCase()}
          </Avatar>
          <Stack gap={0}>
            <Text size="sm" fw={600}>{data?.otherUser?.name || (isNewConversation ? "Новый диалог" : "Диалог")}</Text>
            <Text size="xs" c="gray.4">ID: {conversationId.substring(0, 12)}...</Text>
          </Stack>
        </Group>

        {/* Лента сообщений */}
        <Box ref={scrollRef} style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
          {isLoading ? (
            <Center py={40}><Loader color="indigo" /></Center>
          ) : error ? (
            <AsyncErrorState title="Не удалось загрузить диалог" description="Сообщения временно недоступны. Повторите запрос." onRetry={() => mutate()} backHref="/messages" backLabel="К сообщениям" />
          ) : isNewConversation || messages.length === 0 ? (
            <Center py={40}>
              <Text size="sm" c="gray.4">Начните диалог — отправьте первое сообщение</Text>
            </Center>
          ) : (
            <Stack gap="xs" p="xs">
              {messages.map((msg) => {
                const isOwn = msg.senderId === userId
                return (
                  <Group key={msg.id} justify={isOwn ? "flex-end" : "flex-start"} gap="xs">
                    <Paper
                      px="md"
                      py="xs"
                      radius="lg"
                      style={{
                        maxWidth: "75%",
                        background: isOwn ? "#4f46e5" : "#f4f4f5",
                        color: isOwn ? "#fff" : "var(--mantine-color-text)",
                      }}
                    >
                      <Stack gap={2}>
                        <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>{msg.content}</Text>
                        <Text size="10px" c={isOwn ? "#c7d2fe" : "var(--mantine-color-dimmed)"}>{formatRelativeDate(msg.createdAt)}</Text>
                      </Stack>
                    </Paper>
                  </Group>
                )
              })}
            </Stack>
          )}
        </Box>

        {/* Поле ввода */}
        <Group gap="xs">
          <TextInput
            value={text}
            onChange={(e) => setText(e.currentTarget.value)}
            placeholder="Сообщение..."
            radius="md"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            style={{ flex: 1 }}
          />
          <Button
            onClick={send}
            loading={sending}
            disabled={!text.trim()}
            color="indigo"
            radius="md"
            aria-label="Отправить"
          >
            <IconSend size={18} />
          </Button>
        </Group>
      </Stack>
    </Container>
  )
}
