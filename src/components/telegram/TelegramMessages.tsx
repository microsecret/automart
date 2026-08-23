"use client"

import Link from "next/link"
import useSWR from "swr"
import { Avatar, Badge, Box, Loader, Stack, Text } from "@mantine/core"
import { fetchJson } from "@/lib/api-client"

/**
 * Переписка с продавцами в приложении.
 *
 * Раньше пункт меню уводил на сайт: человек выходил из приложения, ждал
 * загрузку обычной страницы и терял ленту, к которой возвращался. Здесь
 * список переписок открывается на месте.
 */

type Conversation = {
  id: string
  otherUser: { id: string; name: string | null; image: string | null }
  listing: { id: string; title: string } | null
  lastMessage: { content: string; createdAt: string; senderId: string; isRead: boolean } | null
  unreadCount: number
}

type MessagesResponse = { conversations: Conversation[] }

export default function TelegramMessages() {
  const { data, isLoading, error } = useSWR<MessagesResponse>("/api/messages?limit=30", fetchJson, {
    revalidateOnFocus: false,
  })

  if (isLoading) {
    return (
      <Stack align="center" py={48} gap="xs">
        <Loader size="sm" color="var(--tg-accent)" />
        <Text size="xs" c="var(--tg-hint)">Загружаем переписку…</Text>
      </Stack>
    )
  }

  /* Не вошёл — не ошибка, а обычное состояние: смотреть машины можно без
     аккаунта, и попадать сюда человек будет до входа. */
  if (error) {
    return (
      <Stack align="center" py={48} gap={6}>
        <Text fw={700} c="var(--tg-text)">Войдите, чтобы читать переписку</Text>
        <Text size="xs" c="var(--tg-hint)" ta="center" maw={270}>
          Сообщения от продавцов приходят в аккаунт. Регистрация проходит в боте за минуту.
        </Text>
      </Stack>
    )
  }

  const conversations = data?.conversations || []
  if (!conversations.length) {
    return (
      <Stack align="center" py={48} gap={6}>
        <Text fw={700} c="var(--tg-text)">Переписки пока нет</Text>
        <Text size="xs" c="var(--tg-hint)" ta="center" maw={270}>
          Напишите продавцу с карточки машины — разговор появится здесь.
        </Text>
      </Stack>
    )
  }

  return (
    <Stack gap={2} pb={8}>
      {conversations.map((conversation) => (
        <ConversationRow key={conversation.id} conversation={conversation} />
      ))}
    </Stack>
  )
}

function ConversationRow({ conversation }: { conversation: Conversation }) {
  const tap = () => window.Telegram?.WebApp?.HapticFeedback?.impactOccurred("light")
  const name = conversation.otherUser.name || "Пользователь"
  const preview = conversation.lastMessage?.content || "Нет сообщений"

  return (
    <Box
      component={Link}
      href={`/messages/${conversation.id}?from=telegram`}
      onClick={tap}
      className="tg-chat"
      data-unread={conversation.unreadCount > 0 || undefined}
    >
      <Avatar src={conversation.otherUser.image} radius="xl" size={44} color="blue">
        {name.slice(0, 1).toUpperCase()}
      </Avatar>

      <Box className="tg-chat__body">
        <Box className="tg-chat__head">
          <Text className="tg-chat__name" lineClamp={1}>{name}</Text>
          {conversation.lastMessage && (
            <Text className="tg-chat__time">{shortTime(conversation.lastMessage.createdAt)}</Text>
          )}
        </Box>

        {conversation.listing && (
          <Text className="tg-chat__listing" lineClamp={1}>{conversation.listing.title}</Text>
        )}
        <Text className="tg-chat__preview" lineClamp={1}>{preview}</Text>
      </Box>

      {conversation.unreadCount > 0 && (
        <Badge className="tg-chat__badge" size="sm" circle>
          {conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}
        </Badge>
      )}
    </Box>
  )
}

/**
 * Время последнего сообщения: сегодняшнее — часами, вчерашнее — словом,
 * старое — датой. Так устроены все мессенджеры, и человек читает такую
 * подпись не задумываясь.
 */
function shortTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""

  const now = new Date()
  const sameDay = date.toDateString() === now.toDateString()
  if (sameDay) return date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })

  const yesterday = new Date(now.getTime() - 86_400_000)
  if (date.toDateString() === yesterday.toDateString()) return "вчера"

  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })
}
