"use client"

import { useState, useEffect, useRef } from "react"
import { Box, Paper, Stack, Group, Text, TextInput, Button, ActionIcon, ThemeIcon, Anchor } from "@mantine/core"
import { IconMessageCircle2, IconX, IconSend, IconHeadset } from "@tabler/icons-react"

interface Msg {
  id: string
  content: string
  senderId: string
  createdAt: string
  isSupport?: boolean
}

export default function SupportChat() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Msg[]>([])
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)
  const [ticketId, setTicketId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Восстановить ticketId из localStorage
    const saved = localStorage.getItem("support-ticket")
    if (saved) {
      setTicketId(saved)
      loadMessages(saved)
    }
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages])

  const loadMessages = async (tId: string) => {
    try {
      const res = await fetch(`/api/support?ticketId=${tId}`)
      const data = await res.json()
      if (data.messages) setMessages(data.messages)
    } catch {}
  }

  const send = async () => {
    if (!text.trim()) return
    setSending(true)
    const content = text.trim()
    setText("")

    // Оптимистичное обновление
    const tempMsg: Msg = { id: `temp-${Date.now()}`, content, senderId: "me", createdAt: new Date().toISOString() }
    setMessages((p) => [...p, tempMsg])

    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content, ticketId }),
      })
      const data = await res.json()
      if (data.ticketId && !ticketId) {
        setTicketId(data.ticketId)
        localStorage.setItem("support-ticket", data.ticketId)
      }

      // Авто-ответ бота поддержки через 1 сек
      setTimeout(() => {
        const botReply: Msg = {
          id: `bot-${Date.now()}`,
          content: getBotReply(content),
          senderId: "support-team",
          createdAt: new Date().toISOString(),
          isSupport: true,
        }
        setMessages((p) => [...p, botReply])
      }, 1200)
    } catch {}
    finally { setSending(false) }
  }

  return (
    <>
      {/* Кнопка открытия — fixed в правом нижнем углу */}
      <Box pos="fixed" bottom={20} right={20} z={500}>
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
        <Box pos="fixed" bottom={20} right={20} z={500} style={{ width: 340, maxWidth: "calc(100vw - 40px)" }}>
          <Paper radius="md" withBorder shadow="lg" style={{ borderColor: "#e4e4e7", overflow: "hidden" }}>
            {/* Шапка */}
            <Group justify="space-between" p="sm" style={{ background: "#18181b" }}>
              <Group gap="sm">
                <ThemeIcon variant="light" color="indigo" size={32} radius="md">
                  <IconHeadset size={18} />
                </ThemeIcon>
                <Stack gap={0}>
                  <Text size="sm" fw={600} c="white">Поддержка</Text>
                  <Text size="10px" c="#a1a1aa">Обычно отвечает за минуты</Text>
                </Stack>
              </Group>
              <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => setOpen(false)} aria-label="Закрыть">
                <IconX size={16} color="white" />
              </ActionIcon>
            </Group>

            {/* Лента */}
            <Box ref={scrollRef} style={{ height: 320, overflowY: "auto", padding: 12, background: "#fcfcfd" }}>
              {messages.length === 0 ? (
                <Stack align="center" gap="sm" py={20}>
                  <IconMessageCircle2 size={32} stroke={1.5} color="#d4d4d8" />
                  <Text size="sm" c="#71717a" ta="center">Напишите нам — поможем с любым вопросом</Text>
                </Stack>
              ) : (
                <Stack gap="xs">
                  {messages.map((msg) => {
                    const isMe = msg.senderId === "me" || msg.senderId === "support-anonymous"
                    return (
                      <Box key={msg.id} style={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start" }}>
                        <Paper
                          px="sm"
                          py="xs"
                          radius="md"
                          style={{
                            maxWidth: "80%",
                            background: isMe ? "#4f46e5" : "#fff",
                            color: isMe ? "#fff" : "#18181b",
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
            <Group gap="xs" p="sm" style={{ borderTop: "1px solid #f4f4f5", background: "#fff" }}>
              <TextInput
                value={text}
                onChange={(e) => setText(e.currentTarget.value)}
                placeholder="Сообщение..."
                size="xs"
                radius="md"
                style={{ flex: 1 }}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send() } }}
              />
              <ActionIcon color="indigo" variant="filled" size="md" radius="md" onClick={send} loading={sending} disabled={!text.trim()} aria-label="Отправить">
                <IconSend size={14} />
              </ActionIcon>
            </Group>
          </Paper>
        </Box>
      )}
    </>
  )
}

function getBotReply(input: string): string {
  const lower = input.toLowerCase()
  if (/привет|здравств|добр|хай/i.test(lower)) return "Здравствуйте! Чем могу помочь?"
  if (/как.*прода|размест|добавить.*объяв/i.test(lower)) return "Чтобы разместить объявление: нажмите «Продать» в шапке → заполните форму. Это бесплатно!"
  if (/цен|стоим|сколько/i.test(lower)) return "Размещение объявлений — бесплатно. Платно только продвижение (ТОП, Премиум, VIP)."
  if (/VIN|вин|истори|провер/i.test(lower)) return "Проверка VIN доступна на странице объявления в блоке «VIN-паспорт»."
  if (/безопасн|эскроу|сделк/i.test(lower)) return "Безопасная сделка: деньги на счёте платформы до передачи авто. Подробности — на странице объявления."
  if (/удалить|отредактир|изменить/i.test(lower)) return "Управление объявлениями — в Личном кабинете → Продавец → Мои объявления."
  if (/спасибо|благодар/i.test(lower)) return "Рады помочь! Если есть ещё вопросы — пишите."
  return "Спасибо за обращение! Наш специалист ответит в ближайшее время. А пока вы можете найти ответ в разделе «Помощь»."
}
