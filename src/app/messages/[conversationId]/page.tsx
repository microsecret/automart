"use client"
export const dynamic = "force-dynamic"

import { Suspense, useEffect, useRef, useState, useCallback } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import useSWRInfinite from "swr/infinite"
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
  FileButton,
  ActionIcon,
  Image,
  SimpleGrid,
} from "@mantine/core"
import { IconArrowLeft, IconLock, IconMessageCircle2, IconPaperclip, IconPhoto, IconSend, IconX } from "@tabler/icons-react"
import Link from "next/link"
import { formatRelativeDate } from "@/lib/format"
import { fetchJson, getApiClientErrorMessage } from "@/lib/api-client"
import { AsyncErrorState } from "@/components/ui/AsyncStates"

interface Message {
  id: string
  content: string
  senderId: string
  createdAt: string
  attachments: Array<{ id: string; fileName: string; mimeType: string; size: number; downloadUrl: string }>
}

type ConversationResponse = {
  messages: Message[]
  otherUser: { id: string; name: string | null; image: string | null } | null
  listingId: string | null
  listing: { id: string; title: string; target: "vehicle" | "part"; targetId: string } | null
  pagination: {
    page: number
    pages: number
    total: number
  }
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
  const [attachments, setAttachments] = useState<File[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const hasScrolledToLatest = useRef(false)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const recipientId = searchParams.get("recipientId")
  const requestedListingId = searchParams.get("listingId")
  const isNewConversation = Boolean(recipientId)
  const { data: messagePages, error, isLoading, isValidating, mutate, size, setSize } = useSWRInfinite<ConversationResponse>(
    (pageIndex) => session && !isNewConversation ? `/api/messages/${conversationId}?page=${pageIndex + 1}` : null,
    fetchJson,
    { refreshInterval: 5000, revalidateFirstPage: true }
  )

  const latestPage = messagePages?.[0]
  const messages = (messagePages ? [...messagePages].reverse().flatMap((page) => page.messages) : [])
    .filter((message, index, allMessages) => allMessages.findIndex((candidate) => candidate.id === message.id) === index)
  const hasOlderMessages = Boolean(latestPage && size < latestPage.pagination.pages)
  const loadingOlderMessages = Boolean(messagePages && isValidating && size > messagePages.length)

  useEffect(() => {
    if (status === "loading") return
    /* callbackUrl возвращает в этот же диалог после входа. */
    if (!session) router.push(`/auth/signin?callbackUrl=${encodeURIComponent(window.location.pathname)}`)
  }, [session, status, router])

  useEffect(() => {
    if (hasScrolledToLatest.current || messages.length === 0) return
    hasScrolledToLatest.current = true
    scrollToBottom()
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages.length])

  const send = useCallback(async () => {
    if ((!text.trim() && attachments.length === 0) || !session) return
    setSending(true)
    const content = text.trim()
    try {
      const receiverId = recipientId || latestPage?.otherUser?.id
      if (!receiverId) throw new Error("Не удалось определить собеседника")
      const listingId = requestedListingId || latestPage?.listingId || null
      const requestBody = attachments.length > 0 ? new FormData() : null
      if (requestBody) {
        requestBody.set("content", content)
        requestBody.set("receiverId", receiverId)
        if (listingId) requestBody.set("listingId", listingId)
        attachments.forEach((file) => requestBody.append("files", file))
      }
      const payload = await fetchJson<SendMessageResponse>("/api/messages", {
        method: "POST",
        ...(requestBody
          ? { body: requestBody }
          : {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ content, receiverId, listingId }),
            }),
      })
      setText("")
      setAttachments([])
      if (isNewConversation && payload.conversationId) {
        router.replace(`/messages/${payload.conversationId}`)
      } else {
        await mutate()
        scrollToBottom()
      }
    } catch (requestError) {
      notifications.show({
        title: "Сообщение не отправлено",
        message: getApiClientErrorMessage(requestError, "Повторите попытку."),
        color: "red",
      })
    } finally {
      setSending(false)
    }
  }, [text, attachments, session, recipientId, latestPage?.otherUser?.id, requestedListingId, latestPage?.listingId, isNewConversation, mutate, router])

  const selectAttachments = (files: File[]) => {
    if (files.length > 4) {
      notifications.show({ title: "Можно выбрать до четырёх фото", message: "Лишние файлы не добавлены.", color: "orange" })
    }
    setAttachments(files.slice(0, 4))
  }

  if (status === "loading" || !session) {
    return <Container py={80}><Center><Loader color="indigo" /></Center></Container>
  }

  const userId = session.user.id

  return (
    /* Высота считается от видимой части экрана, а не от «стекла».

       Стояло `100vh` и жёсткие 620 пикселей минимума. На телефоне это
       давало три беды разом: `vh` не учитывает адресную строку, минимум
       в 620 не давал окну сжаться, а под всем этим ещё 92 пикселя
       отступа под нижнее меню. Поле ввода с кнопкой «Отправить»
       оказывалось за нижним краем — до него надо было прокручивать
       страницу, борясь с прокруткой самой переписки.

       `dvh` следует за адресной строкой и за клавиатурой: список
       сообщений сжимается, а поле ввода остаётся на виду. Минимум снят
       — на телефоне высоту задаёт экран, а не число в коде. */
    <Container
      size="lg"
      py={{ base: "xs", sm: "xl" }}
      className="messages-conversation"
      style={{ height: "calc(100dvh - var(--app-header-height, 72px) - 24px)" }}
    >
      <Stack gap="md" style={{ height: "100%" }}>
        <Paper withBorder radius="xl" px="sm" py="xs">
        <Group gap="sm" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
          <Button component={Link} href="/messages" variant="default" color="gray" p={8} aria-label="К списку сообщений">
            <IconArrowLeft size={20} />
          </Button>
          <Avatar src={latestPage?.otherUser?.image} radius="xl" color="indigo" size="md">
            {latestPage?.otherUser?.name?.[0]?.toUpperCase()}
          </Avatar>
          <Stack gap={0}>
            <Text size="sm" fw={700}>{latestPage?.otherUser?.name || (isNewConversation ? "Новый диалог" : "Диалог")}</Text>
            {latestPage?.listing ? (
              <Text
                component={Link}
                href={`/listings/${latestPage.listing.target}/${latestPage.listing.targetId}`}
                size="xs"
                c="indigo"
                className="line-clamp-1"
                style={{ textDecoration: "none", maxWidth: 360 }}
              >
                По объявлению: {latestPage.listing.title}
              </Text>
            ) : (
              <Text size="xs" c="dimmed">Отвечайте только внутри Авторынка</Text>
            )}
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

                {/* Готовые первые фразы. Пустое поле — самый высокий
                    барьер к первому сообщению: человек не знает, с чего
                    начать, и уходит. Шаблон подставляется в поле, а не
                    отправляется сразу — фразу можно дописать. */}
                <Group gap={6} justify="center" wrap="wrap" maw={420}>
                  {["Здравствуйте! Ещё продаёте?", "Торг уместен?", "Когда можно посмотреть?"].map((template) => (
                    <Button
                      key={template}
                      size="compact-sm"
                      radius="xl"
                      variant="default"
                      onClick={() => setText((current) => current.trim() ? current : template)}
                    >
                      {template}
                    </Button>
                  ))}
                </Group>
              </Stack>
            </Center>
          ) : (
            <Stack gap="sm" p="xs">
              {hasOlderMessages && (
                <Center>
                  <Button
                    variant="light"
                    color="indigo"
                    size="xs"
                    loading={loadingOlderMessages}
                    onClick={() => void setSize(size + 1)}
                  >
                    Показать предыдущие сообщения
                  </Button>
                </Center>
              )}
              {messages.map((msg) => {
                const isOwn = msg.senderId === userId
                return (
                  <Group key={msg.id} justify={isOwn ? "flex-end" : "flex-start"} gap="xs">
                    <Paper
                      px="md"
                      py="xs"
                      radius="md"
                      className="message-bubble"
                      data-own={isOwn || undefined}
                    >
                      <Stack gap={2}>
                        {msg.attachments?.length > 0 && (
                          <SimpleGrid cols={msg.attachments.length > 1 ? 2 : 1} spacing={5} className="message-bubble__attachments">
                            {msg.attachments.map((attachment) => (
                              <Box
                                key={attachment.id}
                                component="a"
                                href={attachment.downloadUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="message-bubble__attachment"
                                aria-label={`Открыть фото ${attachment.fileName}`}
                              >
                                <Image src={attachment.downloadUrl} alt={attachment.fileName} loading="lazy" fit="cover" />
                              </Box>
                            ))}
                          </SimpleGrid>
                        )}
                        {msg.content && <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>{msg.content}</Text>}
                        <Text size="10px" c={isOwn ? "var(--market-on-primary-muted)" : "var(--market-muted)"}>{formatRelativeDate(msg.createdAt)}</Text>
                      </Stack>
                    </Paper>
                  </Group>
                )
              })}
            </Stack>
          )}
        </Box>
        <Box mt="sm" ref={messagesEndRef} />

        {attachments.length > 0 && (
          <Group gap={6} mb="xs" wrap="wrap" aria-live="polite">
            {attachments.map((file, index) => (
              <Paper key={`${file.name}-${file.lastModified}`} withBorder radius="md" px="xs" py={5} className="message-composer__attachment">
                <IconPhoto size={15} />
                <Text size="xs" lineClamp={1}>{file.name}</Text>
                <ActionIcon size="xs" variant="subtle" color="gray" aria-label={`Убрать ${file.name}`} onClick={() => setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))}>
                  <IconX size={13} />
                </ActionIcon>
              </Paper>
            ))}
          </Group>
        )}
        <Group gap="xs" align="flex-end">
          <FileButton onChange={selectAttachments} accept="image/jpeg,image/png,image/webp" multiple>
            {(props) => (
              <ActionIcon {...props} variant="default" color="gray" size={42} radius="md" disabled={sending} aria-label="Прикрепить фотографии">
                <IconPaperclip size={19} />
              </ActionIcon>
            )}
          </FileButton>
          {/* Плейсхолдер исчезает при первом же символе, поэтому скринридер
              объявлял поле просто «текстовое поле» — в переписке из нескольких
              полей неясно, куда попадёт ввод. */}
          <Textarea
            value={text}
            onChange={(e) => setText(e.currentTarget.value)}
            placeholder="Напишите сообщение…"
            aria-label="Текст сообщения"
            radius="md"
            autosize
            minRows={1}
            maxRows={4}
            disabled={sending}
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
            disabled={!text.trim() && attachments.length === 0}
            color="indigo"
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
