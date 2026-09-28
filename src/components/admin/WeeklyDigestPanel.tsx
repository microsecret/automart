"use client"

import { useState } from "react"
import useSWR from "swr"
import { Badge, Button, Card, Group, Stack, Text } from "@mantine/core"
import { notifications } from "@mantine/notifications"
import { IconCalendarRepeat, IconSend } from "@tabler/icons-react"
import { fetchJson, getApiClientErrorMessage } from "@/lib/api-client"

type WeeklyDigestSummary = {
  subscribed: number
  optedOut: number
  blocked: number
  sentLast7d: number
  dueToday: number
}

/**
 * Еженедельное письмо в боте — сводка и пример себе в Telegram.
 *
 * Письмо уходит само, раз в неделю каждому, кто нажал «Старт». Здесь видно,
 * сколько людей его получают, сколько отписались кнопкой «Не присылать» и
 * сколько получат сегодня; «Прислать мне» отправляет ровно то письмо, что
 * увидит человек, с вашей личной ссылкой.
 */
export default function WeeklyDigestPanel() {
  const { data, error } = useSWR<WeeklyDigestSummary>("/api/admin/telegram-weekly-digest", fetchJson)
  const [sending, setSending] = useState(false)

  const sendPreview = async () => {
    setSending(true)
    try {
      await fetchJson("/api/admin/telegram-weekly-digest", { method: "POST" })
      notifications.show({ title: "Пример отправлен", message: "Письмо пришло вам в Telegram.", color: "indigo" })
    } catch (sendError) {
      notifications.show({ title: "Не отправлено", message: getApiClientErrorMessage(sendError, "Не удалось отправить пример"), color: "red" })
    } finally {
      setSending(false)
    }
  }

  return (
    <Card withBorder radius="md" p="md">
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start" wrap="wrap" gap="sm">
          <Group gap="sm" wrap="nowrap" align="flex-start">
            <IconCalendarRepeat size={22} style={{ color: "var(--market-accent-button)", flexShrink: 0, marginTop: 2 }} />
            <div>
              <Text fw={700}>Еженедельное письмо в боте</Text>
              <Text size="sm" c="dimmed">
                Карта АЗС, отметки о дефиците, бесплатная подача и личная ссылка «Рассказать другу». Раз в неделю каждому,
                первое — через неделю после «Старта». Отписка — кнопкой «Не присылать» или /digest_off.
              </Text>
            </div>
          </Group>
          <Button leftSection={<IconSend size={16} />} variant="light" color="indigo" loading={sending} onClick={() => void sendPreview()}>
            Прислать мне пример
          </Button>
        </Group>
        {error ? (
          <Text size="sm" c="var(--market-danger-text)">Сводка не загрузилась</Text>
        ) : (
          <Group gap="xs">
            <Badge variant="light" color="indigo">Получают: {data?.subscribed ?? "—"}</Badge>
            <Badge variant="light" color="indigo">Ушло за неделю: {data?.sentLast7d ?? "—"}</Badge>
            <Badge variant="light" color="indigo">Сегодня по графику: {data?.dueToday ?? "—"}</Badge>
            <Badge variant="light" color="gray">Отписались: {data?.optedOut ?? "—"}</Badge>
            <Badge variant="light" color="gray">Заблокировали бота: {data?.blocked ?? "—"}</Badge>
          </Group>
        )}
      </Stack>
    </Card>
  )
}
