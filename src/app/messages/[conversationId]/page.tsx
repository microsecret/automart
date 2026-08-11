"use client"
export const dynamic = "force-dynamic"

import { Suspense, useEffect, useRef, useState, useCallback } from "react"
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
  Textarea,
  Button,
  Avatar,
  Box,
  Paper,
  ThemeIcon,
} from "@mantine/core"
import { IconArrowLeft, IconLock, IconMessageCircle2, IconSend } from "@tabler/icons-react"
import Link from "next/link"
import { formatRelativeDate } from "@/lib/format"
import { fetchJson, getApiClientErrorMessage } from "@/lib/api-client"
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

type SendMessageResponse = {
  conversationId?: string
}

export default function ConversationPage() {
  return (
    <Suspense fallback={<Center py={100}><Loader color="indigo" /></Center>}>
      <ConversationWorkspace />
    </Suspense>
  )
}

function ConversationWorkspace() {
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
      const payload = await fetchJson<SendMessageResponse>("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, receiverId, listingId: requestedListingId || data?.listingId || null }),
      })
      if (isNewConversation && payload.conversationId) {
        router.replace(`/messages/${payload.conversationId}`)
      } else {
        void globalMutate(`/api/messages/${conversationId}`)
      }
    } catch (requestError) {
      setText(content)
      notifications.show({
        title: "Сообщение не отправлено",
        message: getApiClientErrorMessage(requestError, "Повторите попытку."),
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
    <Container size="lg" py="xl" style={{ height: "calc(100vh - 72px - 80px)", minHeight: 620 }}>
      <Stack gap="md" style={{ height: "100%" }}>
        <Paper withBorder radius="xl" px="sm" py="xs">
        <Group gap="sm" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
          <Button component={Link} href="/messages" variant="default" color="gray" p={8} aria-label="К списку сообщений">
            <IconArrowLeft size={20} />
          </Button>
          <Avatar src={data?.otherUser?.image} radius="xl" color="indigo" size="md">
            {data?.otherUser?.name?.[0]?.toUpperCase()}
          </Avatar>
          <Stack gap={0}>
            <Text size="sm" fw={700}>{data?.otherUser?.name || (isNewConversation ? "Новый диалог" : "Диалог")}</Text>
            <Text size="xs" c="dimmed">Диалог по объявлению · отвечайте только внутри Авторынка</Text>
          </Stack>
          </Group>
          <ThemeIcon variant="light" color="green" radius="xl" size="lg" aria-label="Защищённый диалог">
            <IconLock size={16} />
          </ThemeIcon>
        </Group>
        </Paper>

        <Paper withBorder radius="xl" p="md" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <Box ref={scrollRef} style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
          {isLoading ? (
            <Center py={40}><Loader color="indigo" /></Center>
          ) : error ? (
            <AsyncErrorState title="Не удалось загрузить диалог" description="Сообщения временно недоступны. Повторите запрос." onRetry={() => mutate()} backHref="/messages" backLabel="К сообщениям" />
          ) : isNewConversation || messages.length === 0 ? (
            <Center py={40}>
              <Stack align="center" gap="sm">
                <ThemeIcon size={54} radius="xl" variant="light" color="indigo"><IconMessageCircle2 size={26} /></ThemeIcon>
                <Text fw={700}>Начните диалог</Text>
                <Text size="sm" c="dimmed" ta="center">Уточните состояние, документы или условия сделки. Не публикуйте личные данные в сообщениях.</Text>
              </Stack>
            </Center>
          ) : (
            <Stack gap="sm" p="xs">
              {messages.map((msg) => {
                const isOwn = msg.senderId === userId
                return (
                  <Group key={msg.id} justify={isOwn ? "flex-end" : "flex-start"} gap="xs">
                    <Paper
                      px="md"
                      py="xs"
                      radius="lg"
                      style={{
                        maxWidth: "78%",
                        background: isOwn ? "var(--mantine-color-indigo-6)" : "var(--mantine-color-gray-0)",
                        color: isOwn ? "#fff" : "var(--mantine-color-text)",
                        border: isOwn ? "1px solid transparent" : "1px solid var(--market-field-line)",
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
        <Box mt="sm" ref={messagesEndRef} />

        <Group gap="xs" align="flex-end">
          <Textarea
            value={text}
            onChange={(e) => setText(e.currentTarget.value)}
            placeholder="Напишите сообщение…"
            radius="md"
            autosize
            minRows={1}
            maxRows={4}
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
        </Paper>
      </Stack>
    </Container>
  )
}
