"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button, Group, Modal, Select, Stack, Text } from "@mantine/core"
import { notifications } from "@mantine/notifications"
import { IconArrowsExchange, IconLock, IconLockOpen, IconPin, IconPinnedOff } from "@tabler/icons-react"

/**
 * Действия модератора над темой.
 *
 * Перенос нужен чаще прочего: на форуме о машинах постоянно пишут не
 * туда — вопрос про растаможку в разделе марки, объявление о продаже в
 * разделе ремонта. Без переноса модератору остаётся только закрыть тему
 * и просить написать заново.
 */

type Props = {
  topicId: string
  isPinned: boolean
  isClosed: boolean
  /** Разделы для переноса: список готовится на сервере. */
  sections: { value: string; label: string }[]
}

export default function TopicModeration({ topicId, isPinned, isClosed, sections }: Props) {
  const router = useRouter()
  const [pinned, setPinned] = useState(isPinned)
  const [closed, setClosed] = useState(isClosed)
  const [busy, setBusy] = useState<string | null>(null)
  const [moving, setMoving] = useState(false)
  const [target, setTarget] = useState<string | null>(null)

  const act = async (action: string, extra?: Record<string, unknown>) => {
    setBusy(action)
    try {
      const response = await fetch("/api/admin/forum-topics", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicId, action, ...extra }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || "Не удалось выполнить")

      if (action === "pin" || action === "unpin") setPinned(action === "pin")
      if (action === "close" || action === "open") setClosed(action === "close")

      if (action === "move" && payload?.sectionSlug && payload?.slug) {
        /* Адрес темы содержит раздел: после переноса прежний ведёт в
           никуда, и остаться на нём нельзя. */
        router.replace(`/forum/${payload.sectionSlug}/${payload.slug}`)
        return
      }

      router.refresh()
    } catch (error) {
      notifications.show({
        title: "Не получилось",
        message: error instanceof Error ? error.message : "Повторите попытку",
        color: "red",
      })
    } finally {
      setBusy(null)
      setMoving(false)
    }
  }

  return (
    <Group gap="xs" wrap="wrap">
      <Button
        variant="subtle"
        color="gray"
        size="compact-xs"
        leftSection={pinned ? <IconPinnedOff size={13} /> : <IconPin size={13} />}
        loading={busy === "pin" || busy === "unpin"}
        onClick={() => void act(pinned ? "unpin" : "pin")}
      >
        {pinned ? "Открепить" : "Закрепить"}
      </Button>

      <Button
        variant="subtle"
        color="gray"
        size="compact-xs"
        leftSection={closed ? <IconLockOpen size={13} /> : <IconLock size={13} />}
        loading={busy === "close" || busy === "open"}
        onClick={() => void act(closed ? "open" : "close")}
      >
        {closed ? "Открыть" : "Закрыть"}
      </Button>

      <Button
        variant="subtle"
        color="gray"
        size="compact-xs"
        leftSection={<IconArrowsExchange size={13} />}
        onClick={() => setMoving(true)}
      >
        Перенести
      </Button>

      <Modal opened={moving} onClose={() => setMoving(false)} title="Перенести тему" size="md" radius="md">
        <Stack gap="sm">
          <Text size="sm" c="var(--market-muted)">
            Тема переедет вместе со всеми сообщениями. Прежний адрес перестанет работать.
          </Text>
          <Select
            label="В какой раздел"
            placeholder="Выберите раздел"
            data={sections}
            value={target}
            onChange={setTarget}
            searchable
            size="sm"
          />
          <Group justify="flex-end" gap="xs">
            <Button variant="subtle" color="gray" size="sm" onClick={() => setMoving(false)}>Отмена</Button>
            <Button
              size="sm"
              loading={busy === "move"}
              disabled={!target}
              onClick={() => target && void act("move", { sectionSlug: target })}
            >
              Перенести
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Group>
  )
}
