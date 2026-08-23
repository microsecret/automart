"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import useSWR from "swr"
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Collapse,
  Divider,
  Group,
  Loader,
  Paper,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Tooltip,
} from "@mantine/core"
import {
  IconCheck,
  IconChevronDown,
  IconHeadset,
  IconMessageCircle2,
  IconRobot,
  IconSend,
  IconUser,
  IconX,
} from "@tabler/icons-react"
import { fetchJson, getApiClientErrorMessage } from "@/lib/api-client"

type SupportArticle = {
  id: string
  title: string
  actionLabel: string | null
  actionUrl: string | null
}

type SupportMessage = {
  id: string
  authorType: "GUEST" | "USER" | "AI" | "OPERATOR" | "SYSTEM" | string
  content: string
  metadata: { article?: SupportArticle } | null
  createdAt: string
}

type SupportChatResponse = {
  ticket: {
    id: string
    subject: string
    status: string
    mode: string
    priority: string
    operatorName: string | null
    createdAt: string
    updatedAt: string
  } | null
  messages: SupportMessage[]
  quickReplies: string[]
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  OPEN: { label: "Автопомощник", color: "indigo" },
  WAITING_OPERATOR: { label: "В очереди", color: "orange" },
  IN_PROGRESS: { label: "Оператор в диалоге", color: "teal" },
  CLOSED: { label: "Обращение закрыто", color: "gray" },
}

function safeArticleUrl(value: string | null | undefined) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : null
}

export default function SupportChat() {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [contactOpen, setContactOpen] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const scrollViewport = useRef<HTMLDivElement>(null)
  const { data: session } = useSession()
  const chat = useSWR<SupportChatResponse>(open ? "/api/support/chat" : null, fetchJson, {
    refreshInterval: open ? 5_000 : 0,
    revalidateOnFocus: true,
  })

  useEffect(() => {
    if (!open) return
    requestAnimationFrame(() => {
      scrollViewport.current?.scrollTo({ top: scrollViewport.current.scrollHeight, behavior: "smooth" })
    })
  }, [open, chat.data?.messages.length])

  useEffect(() => {
    const openSupport = () => setOpen(true)
    window.addEventListener("lewheel:open-support", openSupport)
    return () => window.removeEventListener("lewheel:open-support", openSupport)
  }, [])

  const post = async (payload: Record<string, unknown>) => {
    setSending(true)
    setError(null)
    try {
      const data = await fetchJson<SupportChatResponse>("/api/support/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      await chat.mutate(data, { revalidate: false })
      return true
    } catch (requestError) {
      setError(getApiClientErrorMessage(requestError, "Не удалось сохранить сообщение"))
      return false
    } finally {
      setSending(false)
    }
  }

  const send = async (message = text) => {
    const content = message.trim()
    if (!content || sending) return
    if (message === text) setText("")
    const sent = await post({ action: "MESSAGE", message: content })
    if (!sent && message === text) setText(content)
  }

  const saveContact = async () => {
    const saved = await post({ action: "UPDATE_CONTACT", name, email, phone })
    if (saved) setContactOpen(false)
  }

  const ticket = chat.data?.ticket
  const messages = chat.data?.messages || []
  const quickReplies = chat.data?.quickReplies || []
  const statusMeta = STATUS_META[ticket?.status || "OPEN"] || STATUS_META.OPEN

  return (
    <>
      <Box className="support-chat__launcher" pos="fixed" bottom={20} right={20} style={{ zIndex: 500 }}>
        {!open && (
          <Tooltip label="Задать вопрос" position="left">
            <ActionIcon
              color="indigo"
              variant="filled"
              size={54}
              radius="xl"
              onClick={() => setOpen(true)}
              aria-label="Открыть поддержку"
              style={{ boxShadow: "0 12px 30px -12px rgba(79,70,229,0.72)" }}
            >
              <IconHeadset size={25} />
            </ActionIcon>
          </Tooltip>
        )}
      </Box>

      {open && (
        <Box className="support-chat__panel" pos="fixed" bottom={20} right={20} style={{ zIndex: 500, width: 390, maxWidth: "calc(100vw - 40px)" }}>
          <Paper radius="xl" withBorder shadow="xl" style={{ overflow: "hidden" }}>
            <Group justify="space-between" p="md" bg="indigo.9">
              <Group gap="sm" wrap="nowrap">
                <ThemeIcon variant="white" color="indigo" size={38} radius="xl"><IconHeadset size={20} /></ThemeIcon>
                <Stack gap={2}>
                  <Text size="sm" fw={800} c="white">Поддержка LeWheel</Text>
                  <Group gap={5}>
                    <Badge size="xs" variant="light" color={statusMeta.color}>{statusMeta.label}</Badge>
                    {ticket?.operatorName && <Text size="10px" c="indigo.1">{ticket.operatorName}</Text>}
                  </Group>
                </Stack>
              </Group>
              <ActionIcon variant="subtle" color="gray" onClick={() => setOpen(false)} aria-label="Закрыть чат"><IconX size={18} color="white" /></ActionIcon>
            </Group>

            <ScrollArea h={360} viewportRef={scrollViewport} type="auto" bg="gray.0">
              <Stack gap="sm" p="sm">
                {chat.isLoading ? (
                  <Stack align="center" py="xl"><Loader size="sm" /><Text size="xs" c="dimmed">Загружаем обращение…</Text></Stack>
                ) : chat.error ? (
                  <Stack align="center" py="xl"><IconMessageCircle2 size={30} color="gray" /><Text size="sm" c="red" ta="center">Не удалось загрузить переписку</Text><Button size="xs" variant="light" onClick={() => void chat.mutate()}>Повторить</Button></Stack>
                ) : messages.length === 0 ? (
                  <Paper withBorder radius="md" p="md" bg="white">
                    <Group gap="sm" align="flex-start" wrap="nowrap">
                      <ThemeIcon variant="light" color="indigo" radius="xl"><IconRobot size={17} /></ThemeIcon>
                      <Stack gap={5}>
                        <Text size="sm" fw={700}>Здравствуйте! Я помощник LeWheel.</Text>
                        <Text size="xs" c="dimmed">Подскажу по регистрации, объявлениям, доставке и аукционам. Если инструкции недостаточно, приглашу оператора и сохраню всю переписку.</Text>
                      </Stack>
                    </Group>
                  </Paper>
                ) : (
                  messages.map((message) => {
                    const visitor = message.authorType === "GUEST" || message.authorType === "USER"
                    const system = message.authorType === "SYSTEM"
                    const article = message.metadata?.article
                    const actionUrl = safeArticleUrl(article?.actionUrl)
                    return (
                      <Box key={message.id} ml={visitor ? "auto" : 0} maw={system ? "100%" : "84%"} w={system ? "100%" : undefined}>
                        <Paper
                          withBorder={!system}
                          radius="md"
                          px="sm"
                          py="xs"
                          bg={system ? "gray.2" : visitor ? "indigo.6" : "white"}
                          c={visitor ? "white" : undefined}
                        >
                          {!system && (
                            <Text size="10px" fw={700} c={visitor ? "indigo.0" : message.authorType === "OPERATOR" ? "teal" : "indigo"} mb={3}>
                              {visitor ? "Вы" : message.authorType === "OPERATOR" ? "Оператор" : "Помощник LeWheel"}
                            </Text>
                          )}
                          <Text size="xs" style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{message.content}</Text>
                          {actionUrl && (
                            <Button component={Link} href={actionUrl} size="compact-xs" variant={visitor ? "white" : "light"} mt="xs">
                              {article?.actionLabel || "Открыть"}
                            </Button>
                          )}
                        </Paper>
                      </Box>
                    )
                  })
                )}

                {quickReplies.length > 0 && ticket?.mode !== "OPERATOR" && ticket?.status !== "CLOSED" && (
                  <Group gap={5}>
                    {quickReplies.map((reply) => (
                      <Button key={reply} size="compact-xs" variant="white" color="indigo" radius="xl" onClick={() => void send(reply)} disabled={sending}>{reply}</Button>
                    ))}
                  </Group>
                )}
              </Stack>
            </ScrollArea>

            <Box p="sm">
              {error && <Text size="xs" c="red" mb="xs">{error}</Text>}
              {!session?.user && (
                <>
                  <Button
                    size="compact-xs"
                    variant="subtle"
                    color="gray"
                    leftSection={<IconUser size={14} />}
                    rightSection={<IconChevronDown size={13} />}
                    onClick={() => setContactOpen((value) => !value)}
                    mb={contactOpen ? "xs" : 0}
                  >
                    Оставить контакт для ответа
                  </Button>
                  <Collapse in={contactOpen}>
                    <Stack gap="xs" mb="sm">
                      <Group gap="xs" grow><TextInput size="xs" label="Имя" value={name} onChange={(event) => setName(event.currentTarget.value)} /><TextInput size="xs" label="Телефон" value={phone} onChange={(event) => setPhone(event.currentTarget.value)} /></Group>
                      <TextInput size="xs" label="Email" value={email} onChange={(event) => setEmail(event.currentTarget.value)} />
                      <Button size="xs" variant="light" loading={sending} onClick={() => void saveContact()}>Сохранить контакт</Button>
                    </Stack>
                  </Collapse>
                </>
              )}

              <Divider mb="sm" />
              <Group gap="xs" wrap="nowrap" align="flex-end">
                <TextInput
                  value={text}
                  onChange={(event) => setText(event.currentTarget.value)}
                  placeholder={ticket?.status === "CLOSED" ? "Новое сообщение откроет обращение" : "Напишите вопрос…"}
                  size="sm"
                  radius="lg"
                  style={{ flex: 1 }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault()
                      void send()
                    }
                  }}
                />
                <ActionIcon color="indigo" variant="filled" size={36} radius="lg" onClick={() => void send()} loading={sending} disabled={!text.trim()} aria-label="Отправить"><IconSend size={16} /></ActionIcon>
              </Group>

              <Group justify="space-between" mt="xs" gap="xs">
                <Button size="compact-xs" variant="subtle" color="orange" leftSection={<IconHeadset size={13} />} disabled={ticket?.mode === "OPERATOR" || sending} onClick={() => void post({ action: "REQUEST_OPERATOR" })}>
                  Позвать оператора
                </Button>
                {ticket && ticket.status !== "CLOSED" && (
                  <Button size="compact-xs" variant="subtle" color="gray" leftSection={<IconCheck size={13} />} disabled={sending} onClick={() => void post({ action: "CLOSE" })}>Закрыть</Button>
                )}
              </Group>
              <Text size="10px" c="dimmed" ta="center" mt={4}>Помощник отвечает по базе знаний. Срок живого ответа зависит от загрузки операторов.</Text>
            </Box>
          </Paper>
        </Box>
      )}
    </>
  )
}
