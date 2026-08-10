"use client"

import { useState, useEffect, useRef } from "react"
import { Box, Paper, Stack, Group, Text, TextInput, Button, ActionIcon, ThemeIcon, Loader } from "@mantine/core"
import { IconMessageCircle2, IconX, IconSend, IconHeadset } from "@tabler/icons-react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { fetchJson, getApiClientErrorMessage } from "@/lib/api-client"

interface Msg {
  id: string
  content: string
  senderId: string
  createdAt: string
  isSupport?: boolean
}

interface SupportMessagesResponse {
  ticketId?: string
  messages?: Msg[]
}

interface SupportMessageResponse {
  ticketId?: string
  message?: Msg
}

export default function SupportChat() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Msg[]>([])
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)
  const [ticketId, setTicketId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const { data: session, status } = useSession()

  useEffect(() => {
    if (session?.user?.id) {
      setTicketId(session.user.id)
      void loadMessages(session.user.id)
    } else {
      setTicketId(null)
      setMessages([])
      setLoadError(null)
    }
  }, [session?.user?.id])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages])

  const loadMessages = async (tId: string) => {
    setIsLoadingMessages(true)
    setLoadError(null)
    try {
      const data = await fetchJson<SupportMessagesResponse>(`/api/support?ticketId=${encodeURIComponent(tId)}`)
      setMessages(Array.isArray(data.messages) ? data.messages : [])
      setTicketId(data.ticketId || tId)
    } catch (requestError) {
      setLoadError(getApiClientErrorMessage(requestError, "Не удалось загрузить переписку"))
    } finally {
      setIsLoadingMessages(false)
    }
  }

  const send = async () => {
    if (!session?.user?.id || !text.trim()) return
    setSending(true)
    setError(null)
    const content = text.trim()
    setText("")

    // Оптимистичное обновление
    const tempMsg: Msg = { id: `temp-${Date.now()}`, content, senderId: "me", createdAt: new Date().toISOString() }
    setMessages((p) => [...p, tempMsg])

    try {
      const data = await fetchJson<SupportMessageResponse>("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content, ticketId }),
      })
      if (data.ticketId) {
        setTicketId(data.ticketId)
      }
      if (data.message) {
        setMessages((items) => items.map((message) => message.id === tempMsg.id ? data.message : message))
      }
    } catch (requestError) {
      setMessages((items) => items.filter((message) => message.id !== tempMsg.id))
      setError(getApiClientErrorMessage(requestError, "Не удалось отправить сообщение"))
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      {/* Кнопка открытия — fixed в правом нижнем углу */}
      <Box className="support-chat__launcher" pos="fixed" bottom={20} right={20} style={{ zIndex: 500 }}>
        {!open && (
          <ActionIcon
            color="indigo"
            variant="filled"
            size={52}
            radius="xl"
            onClick={() => setOpen(true)}
            aria-label="Поддержка"
            style={{ boxShadow: "0 8px 24px rgba(79,70,229,0.3)" }}
          >
            <IconHeadset size={24} />
          </ActionIcon>
        )}
      </Box>

      {/* Окно чата */}
      {open && (
        <Box className="support-chat__panel" pos="fixed" bottom={20} right={20} style={{ zIndex: 500, width: 340, maxWidth: "calc(100vw - 40px)" }}>
          <Paper radius="md" withBorder shadow="lg" style={{ borderColor: "var(--mantine-color-border)", overflow: "hidden" }}>
            {/* Шапка */}
            <Group justify="space-between" p="sm" style={{ background: "var(--mantine-color-text)" }}>
              <Group gap="sm">
                <ThemeIcon variant="light" color="indigo" size={32} radius="md">
                  <IconHeadset size={18} />
                </ThemeIcon>
                <Stack gap={0}>
                  <Text size="sm" fw={600} c="white">Поддержка</Text>
                  <Text size="10px" c="gray.4">Обычно отвечает за минуты</Text>
                </Stack>
              </Group>
              <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => setOpen(false)} aria-label="Закрыть">
                <IconX size={16} color="white" />
              </ActionIcon>
            </Group>

            {/* Лента */}
            <Box ref={scrollRef} style={{ height: 320, overflowY: "auto", padding: 12, background: "var(--mantine-color-body)" }}>
              {!session?.user?.id && status !== "loading" ? (
                <Stack align="center" gap="sm" py={20}>
                  <IconHeadset size={32} stroke={1.5} color="#a5b4fc" />
                  <Text size="sm" c="gray.5" ta="center">Войдите, чтобы поддержка могла безопасно вести переписку по вашему обращению.</Text>
                  <Button component={Link} href="/auth/signin" size="xs" color="indigo">Войти в кабинет</Button>
                </Stack>
              ) : status === "loading" || isLoadingMessages ? (
                <Stack align="center" gap="sm" py={20}>
                  <Loader size="sm" color="indigo" />
                  <Text size="sm" c="dimmed" ta="center">Загружаем переписку…</Text>
                </Stack>
              ) : loadError ? (
                <Stack align="center" gap="sm" py={20}>
                  <IconMessageCircle2 size={32} stroke={1.5} color="#f87171" />
                  <Text size="sm" c="red" ta="center">{loadError}</Text>
                  {session?.user?.id && (
                    <Button size="xs" variant="light" color="indigo" onClick={() => void loadMessages(session.user.id)}>
                      Повторить
                    </Button>
                  )}
                </Stack>
              ) : messages.length === 0 ? (
                <Stack align="center" gap="sm" py={20}>
                  <IconMessageCircle2 size={32} stroke={1.5} color="#d4d4d8" />
                  <Text size="sm" c="gray.5" ta="center">Напишите нам — поможем с любым вопросом</Text>
                </Stack>
              ) : (
                <Stack gap="xs">
                  {messages.map((msg) => {
                    const isMe = msg.senderId === session?.user?.id
                    return (
                      <Box key={msg.id} style={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start" }}>
                        <Paper
                          px="sm"
                          py="xs"
                          radius="md"
                          style={{
                            maxWidth: "80%",
                            background: isMe ? "#4f46e5" : "#fff",
                            color: isMe ? "#fff" : "var(--mantine-color-text)",
                            border: isMe ? "none" : "1px solid #f4f4f5",
                          }}
                        >
                          <Text size="xs" style={{ whiteSpace: "pre-wrap", lineHeight: 1.4 }}>{msg.content}</Text>
                        </Paper>
                      </Box>
                    )
                  })}
                </Stack>
              )}
            </Box>

            {/* Поле ввода */}
            {error && <Text px="sm" pt="xs" size="xs" c="red">{error}</Text>}
            <Group gap="xs" p="sm" style={{ borderTop: "1px solid var(--mantine-color-border)", background: "var(--mantine-color-body)" }}>
              <TextInput
                value={text}
                onChange={(e) => setText(e.currentTarget.value)}
                placeholder="Сообщение..."
                disabled={!session?.user?.id}
                size="xs"
                radius="md"
                style={{ flex: 1 }}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send() } }}
              />
              <ActionIcon color="indigo" variant="filled" size="md" radius="md" onClick={send} loading={sending} disabled={!text.trim() || !session?.user?.id} aria-label="Отправить">
                <IconSend size={14} />
              </ActionIcon>
            </Group>
          </Paper>
        </Box>
      )}
    </>
  )
}
