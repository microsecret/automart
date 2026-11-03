"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import useSWR from "swr"
import { useDebouncedValue } from "@mantine/hooks"
import { ActionIcon, Avatar, Badge, Box, Button, Group, Loader, Stack, Text, TextInput } from "@mantine/core"
import { IconChevronLeft, IconChevronRight, IconSearch, IconX } from "@tabler/icons-react"
import { ApiClientError, fetchJson } from "@/lib/api-client"

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
  lastMessage: { content: string; createdAt: string; senderId: string; isRead: boolean; attachmentCount: number } | null
  unreadCount: number
}

type MessagesResponse = {
  conversations: Conversation[]
  pagination: { page: number; pages: number; total: number }
}

const PAGE_SIZE = 30
const MAX_PAGE = 10_000

export default function TelegramMessages() {
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState("")
  const [debouncedQuery] = useDebouncedValue(query.trim(), 300)
  const searchRef = useRef<HTMLInputElement>(null)
  const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
  if (debouncedQuery) params.set("q", debouncedQuery)
  const { data, isLoading, isValidating, error, mutate } = useSWR<MessagesResponse>(`/api/messages?${params}`, fetchJson, {
    revalidateOnFocus: true,
    refreshInterval: 20_000,
    refreshWhenHidden: false,
    refreshWhenOffline: false,
    keepPreviousData: true,
    errorRetryCount: 2,
    shouldRetryOnError: (failure) => !(failure instanceof ApiClientError && (failure.status === 401 || failure.status === 403)),
  })
  const conversations = data?.conversations ?? []
  const totalPages = Math.min(MAX_PAGE, Math.max(1, data?.pagination.pages ?? 1))
  const searching = Boolean(debouncedQuery)
  const unauthorized = error instanceof ApiClientError && error.status === 401
  const forbidden = error instanceof ApiClientError && error.status === 403
  const bot = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, "")
  const signInHref = bot && /^[A-Za-z0-9_]{5,}$/.test(bot)
    ? `https://t.me/${bot}?start=register`
    : "/auth/signin?from=telegram&callbackUrl=%2Ftelegram%3Ftab%3Dchats"

  useEffect(() => {
    if (data && !isValidating && page > totalPages) setPage(totalPages)
  }, [data, isValidating, page, totalPages])

  const clearSearch = () => {
    setQuery("")
    setPage(1)
    searchRef.current?.focus()
  }

  // An expired session needs sign-in; service and network failures need retry.
  if (unauthorized) {
    return (
      <Stack align="center" py={48} gap={6}>
        <Text fw={700} c="var(--tg-text)">Войдите, чтобы читать переписку</Text>
        <Text size="xs" c="var(--tg-hint)" ta="center" maw={270}>
          Сообщения от продавцов приходят в аккаунт. Регистрация проходит в боте за минуту.
        </Text>
        <Button component={Link} href={signInHref} className="tg-button" mt="sm">
          {bot ? "Войти через бота" : "Войти в аккаунт"}
        </Button>
      </Stack>
    )
  }

  return (
    <Stack gap="sm" pb={8}>
      <Box className="tg-search">
        <TextInput
          ref={searchRef}
          className="tg-search__input"
          aria-label="Поиск по всем диалогам"
          placeholder="Собеседник, объявление или сообщение"
          type="search"
          autoComplete="off"
          spellCheck={false}
          maxLength={120}
          leftSection={<IconSearch size={16} aria-hidden="true" />}
          rightSectionWidth={query ? 48 : 32}
          rightSection={query ? (
            <ActionIcon size={44} variant="subtle" color="var(--tg-accent)" onClick={clearSearch} aria-label="Очистить поиск диалогов">
              <IconX size={16} aria-hidden="true" />
            </ActionIcon>
          ) : null}
          value={query}
          onChange={(event) => { setQuery(event.currentTarget.value); setPage(1) }}
        />
      </Box>

      {isLoading && !data ? (
        <Stack align="center" py={48} gap="xs" role="status">
          <Loader size="sm" color="var(--tg-accent)" />
          <Text size="xs" c="var(--tg-hint)">Загружаем переписку…</Text>
        </Stack>
      ) : error ? (
        <Stack align="center" py={48} px="md" gap="sm">
          <Text fw={700} c="var(--tg-text)" ta="center" role="alert">
            {forbidden ? "Доступ к переписке ограничен" : "Не удалось загрузить переписку"}
          </Text>
          <Text size="xs" c="var(--tg-hint)" ta="center" maw={290}>
            {forbidden ? "Проверьте статус аккаунта или обратитесь в поддержку." : "Проверьте связь и повторите запрос. Ваши диалоги сохранены."}
          </Text>
          <Button className="tg-button" onClick={() => void mutate()} loading={isValidating}>Повторить</Button>
        </Stack>
      ) : (
        <>
          <Group justify="space-between" px="md" gap="xs" mih={24}>
            <Text size="xs" c="var(--tg-hint)" role="status" aria-live="polite">
              {searching ? `Найдено диалогов: ${data?.pagination.total ?? 0}` : `Всего диалогов: ${data?.pagination.total ?? 0}`}
            </Text>
            {isValidating && <Loader size={16} color="var(--tg-accent)" aria-label="Обновляем диалоги" />}
          </Group>
          {conversations.length ? (
            <Stack gap={2} aria-busy={isValidating}>
              {conversations.map((conversation) => <ConversationRow key={conversation.id} conversation={conversation} />)}
            </Stack>
          ) : (
            <Stack align="center" py={48} px="md" gap={6}>
              <Text fw={700} c="var(--tg-text)">{searching ? "Ничего не найдено" : "Переписки пока нет"}</Text>
              <Text size="xs" c="var(--tg-hint)" ta="center" maw={290}>
                {searching ? "Попробуйте другое имя, название объявления или текст сообщения." : "Напишите продавцу с карточки машины — разговор появится здесь."}
              </Text>
              {searching && <Button variant="subtle" color="var(--tg-accent)" onClick={clearSearch}>Сбросить поиск</Button>}
            </Stack>
          )}
          {totalPages > 1 && (
            <Group justify="space-between" px="md" gap="xs" wrap="nowrap" aria-label="Страницы диалогов">
              <ActionIcon size={44} variant="light" color="var(--tg-accent)" disabled={page <= 1 || isValidating} onClick={() => setPage((value) => Math.max(1, value - 1))} aria-label="Предыдущая страница диалогов">
                <IconChevronLeft size={20} aria-hidden="true" />
              </ActionIcon>
              <Text size="sm" c="var(--tg-text)">Страница {page} из {totalPages}</Text>
              <ActionIcon size={44} variant="light" color="var(--tg-accent)" disabled={page >= totalPages || isValidating} onClick={() => setPage((value) => Math.min(totalPages, MAX_PAGE, value + 1))} aria-label="Следующая страница диалогов">
                <IconChevronRight size={20} aria-hidden="true" />
              </ActionIcon>
            </Group>
          )}
        </>
      )}
    </Stack>
  )
}

function ConversationRow({ conversation }: { conversation: Conversation }) {
  const tap = () => window.Telegram?.WebApp?.HapticFeedback?.impactOccurred("light")
  const name = conversation.otherUser.name || "Пользователь"
  const preview = conversation.lastMessage?.content || (conversation.lastMessage?.attachmentCount ? `Фото: ${conversation.lastMessage.attachmentCount}` : "Нет сообщений")

  return (
    <Box
      component={Link}
      href={`/messages/${conversation.id}?from=telegram`}
      onClick={tap}
      className="tg-chat"
      data-unread={conversation.unreadCount > 0 || undefined}
    >
      <Avatar src={conversation.otherUser.image} radius="xl" size={44} color="indigo" className="lw-user-avatar">
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
