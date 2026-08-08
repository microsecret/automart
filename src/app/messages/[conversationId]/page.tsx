"use client"
export const dynamic = "force-dynamic"

import { useEffect, useRef, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import useSWR, { mutate as globalMutate } from "swr"
import { useSession } from "next-auth/react"
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

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface Message {
  id: string
  content: string
  senderId: string
  createdAt: string
}

export default function ConversationPage({ params }: { params: { conversationId: string } }) {
  const { conversationId } = params
  const { data: session, status } = useSession()
  const router = useRouter()
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const { data, isLoading } = useSWR<{ messages: Message[]; otherUserName: string; otherUserImage: string | null }>(
    session ? `/api/messages/${conversationId}` : null,
    fetcher,
    { refreshInterval: 5000 }
  )

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
      await fetch(`/api/messages/${conversationId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      })
      globalMutate(`/api/messages/${conversationId}`)
    } catch {
      setText(content)
    } finally {
      setSending(false)
    }
  }, [text, session, conversationId])

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
          <Avatar src={data?.otherUserImage} radius="xl" color="indigo" size="sm">
            {data?.otherUserName?.[0]?.toUpperCase()}
          </Avatar>
          <Stack gap={0}>
            <Text size="sm" fw={600}>{data?.otherUserName || "Диалог"}</Text>
            <Text size="xs" c="#a1a1aa">ID: {conversationId.substring(0, 12)}...</Text>
          </Stack>
        </Group>

        {/* Лента сообщений */}
        <Box ref={scrollRef} style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
          {isLoading ? (
            <Center py={40}><Loader color="indigo" /></Center>
          ) : messages.length === 0 ? (
            <Center py={40}>
              <Text size="sm" c="#a1a1aa">Начните диалог — отправьте первое сообщение</Text>
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
                        color: isOwn ? "#fff" : "#18181b",
                      }}
                    >
                      <Stack gap={2}>
                        <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>{msg.content}</Text>
                        <Text size="10px" c={isOwn ? "#c7d2fe" : "#a1a1aa"}>{formatRelativeDate(msg.createdAt)}</Text>
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
