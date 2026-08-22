"use client"

import { useState } from "react"
import useSWR from "swr"
import {
  Badge, Box, Button, Card, Container, Group, SegmentedControl, SimpleGrid,
  Stack, Text, Textarea, ThemeIcon, Title,
} from "@mantine/core"
import { notifications } from "@mantine/notifications"
import { IconBrandTelegram, IconSend, IconUsers, IconUserCheck, IconUserOff, IconClock } from "@tabler/icons-react"
import { fetchJson, getApiClientErrorMessage } from "@/lib/api-client"
import { AsyncErrorState } from "@/components/ui/AsyncStates"

type Stats = {
  trackingSince: string
  total: number
  registered: number
  unregistered: number
  blocked: number
  reachable: number
  active24h: number
  active7d: number
}

type BroadcastResult = {
  total: number
  delivered: number
  blocked: number
  failed: number
}

type HistoryItem = {
  id: string
  text: string
  audience: string
  total: number
  delivered: number
  blocked: number
  failed: number
  sentByName: string | null
  createdAt: string
}

const AUDIENCE_LABELS: Record<string, string> = {
  all: "Всем",
  unregistered: "Не закончившим",
  registered: "Зарегистрированным",
}

/**
 * Рассылка по контактам бота.
 *
 * Аудитория — все, кто хоть раз нажал «Начать», включая тех, кто не закончил
 * регистрацию: их большинство, и до этой страницы связаться с ними было
 * нечем.
 */
export default function TelegramBroadcastPage() {
  const { data, error, isLoading, mutate } = useSWR<{ stats: Stats; history: HistoryItem[] }>(
    "/api/admin/telegram-broadcast",
    fetchJson,
  )
  const [text, setText] = useState("")
  const [audience, setAudience] = useState("all")
  const [sending, setSending] = useState(false)

  const stats = data?.stats

  const audienceSize = stats
    ? audience === "registered" ? stats.registered
      : audience === "unregistered" ? stats.unregistered
      : stats.reachable
    : null

  const send = async () => {
    if (!text.trim() || sending) return
    setSending(true)
    try {
      const result = await fetchJson<BroadcastResult>("/api/admin/telegram-broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim(), audience }),
      })
      notifications.show({
        title: "Рассылка завершена",
        message: `Доставлено ${result.delivered} из ${result.total}. Заблокировали бота: ${result.blocked}, ошибок: ${result.failed}.`,
        color: result.failed > 0 ? "orange" : "teal",
        autoClose: 12_000,
      })
      setText("")
      void mutate()
    } catch (sendError) {
      notifications.show({
        title: "Рассылка не выполнена",
        message: getApiClientErrorMessage(sendError, "Попробуйте ещё раз позже."),
        color: "red",
      })
    } finally {
      setSending(false)
    }
  }

  const cards = stats ? [
    { label: "Открывали бота", value: stats.total, hint: "нажали «Начать» хоть раз", icon: <IconUsers size={18} />, color: "indigo" },
    { label: "Завершили регистрацию", value: stats.registered, hint: "телефон, почта и пароль", icon: <IconUserCheck size={18} />, color: "teal" },
    { label: "Не закончили", value: stats.unregistered, hint: "основная аудитория рассылки", icon: <IconClock size={18} />, color: "orange" },
    { label: "Заблокировали бота", value: stats.blocked, hint: "им отправка не идёт", icon: <IconUserOff size={18} />, color: "gray" },
  ] : []

  return (
    <Container size="lg" py="lg">
      <Stack gap="lg">
        <Group gap="sm" align="center">
          <ThemeIcon variant="light" color="indigo" size={42} radius="md"><IconBrandTelegram size={22} /></ThemeIcon>
          <Box>
            <Title order={1} size="h3">Рассылка в Telegram</Title>
            <Text size="sm" c="dimmed">Сообщение уходит всем, кто открывал бота — даже если регистрация не завершена</Text>
          </Box>
        </Group>

        {error ? (
          <AsyncErrorState
            title="Не удалось загрузить статистику"
            description="Данные не изменены. Повторите запрос."
            onRetry={() => mutate()}
          />
        ) : (
          <SimpleGrid cols={{ base: 2, md: 4 }} spacing="sm">
            {cards.map((card) => (
              <Card key={card.label} withBorder radius="md" p="md">
                <Group gap="xs" wrap="nowrap" mb={6}>
                  <ThemeIcon variant="light" color={card.color} size={30} radius="md">{card.icon}</ThemeIcon>
                </Group>
                <Text fz={26} fw={800} ff="var(--font-display),sans-serif" lh={1}>
                  {isLoading ? "—" : card.value.toLocaleString("ru")}
                </Text>
                <Text size="sm" fw={650} mt={4}>{card.label}</Text>
                <Text size="xs" c="dimmed">{card.hint}</Text>
              </Card>
            ))}
          </SimpleGrid>
        )}

        {stats && (
          <Group gap="xs" align="center">
            <Badge variant="light" color="indigo">За сутки активны: {stats.active24h}</Badge>
            <Badge variant="light" color="blue">За неделю: {stats.active7d}</Badge>
            {/* Без этой оговорки «открывали бота» читается как полная история,
                хотя до включения учёта сохранялись только дошедшие до
                подтверждения телефона. */}
            <Text size="xs" c="dimmed">
              Полный учёт ведётся с {new Date(stats.trackingSince).toLocaleDateString("ru", { day: "numeric", month: "long" })}; более ранние — только те, кто подтвердил телефон
            </Text>
          </Group>
        )}

        <Card withBorder radius="md" p="lg">
          <Stack gap="md">
            <Box>
              <Text size="sm" fw={700} mb={6}>Кому отправить</Text>
              <SegmentedControl
                value={audience}
                onChange={setAudience}
                data={[
                  { value: "all", label: "Всем" },
                  { value: "unregistered", label: "Не закончившим" },
                  { value: "registered", label: "Зарегистрированным" },
                ]}
                fullWidth
              />
              {audienceSize !== null && (
                <Text size="xs" c="dimmed" mt={6}>
                  Получателей: <strong>{audienceSize.toLocaleString("ru")}</strong> — заблокировавшие бота исключены
                </Text>
              )}
            </Box>

            <Textarea
              label="Текст сообщения"
              description="Поддерживается разметка Telegram: <b>жирный</b>, <i>курсив</i>, <a href=&quot;…&quot;>ссылка</a>"
              placeholder="Например: Появились новые лоты из Кореи — цены пересчитаны по курсу ЦБ."
              value={text}
              onChange={(event) => setText(event.currentTarget.value)}
              minRows={5}
              autosize
              maxLength={4_000}
            />

            <Group justify="space-between" align="center">
              <Text size="xs" c="dimmed">
                {/* Отозвать рассылку нельзя — предупреждаем до нажатия. */}
                Отправленные сообщения нельзя отозвать. Проверьте текст перед отправкой.
              </Text>
              <Button
                leftSection={<IconSend size={16} />}
                color="indigo"
                onClick={() => void send()}
                loading={sending}
                disabled={!text.trim() || !audienceSize}
              >
                {sending ? "Отправляем" : "Отправить"}
              </Button>
            </Group>
          </Stack>
        </Card>

        {/* История: рассылку нельзя отозвать, поэтому важно видеть, что уже
            ушло, прежде чем писать следующее письмо. */}
        {data?.history && data.history.length > 0 && (
          <Card withBorder radius="md" p="lg">
            <Text size="sm" fw={700} mb="sm">Последние рассылки</Text>
            <Stack gap="xs">
              {data.history.map((item) => (
                <Box key={item.id} className="broadcast-history-item">
                  <Group justify="space-between" gap="xs" wrap="nowrap" align="flex-start">
                    <Box style={{ minWidth: 0, flex: 1 }}>
                      <Text size="sm" lineClamp={2}>{item.text}</Text>
                      <Text size="xs" c="dimmed" mt={2}>
                        {new Date(item.createdAt).toLocaleString("ru", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        {" · "}{AUDIENCE_LABELS[item.audience] || item.audience}
                        {item.sentByName ? ` · ${item.sentByName}` : ""}
                      </Text>
                    </Box>
                    <Group gap={4} wrap="nowrap">
                      <Badge variant="light" color="teal" size="sm">{item.delivered}</Badge>
                      {item.blocked > 0 && <Badge variant="light" color="gray" size="sm">заблок. {item.blocked}</Badge>}
                      {item.failed > 0 && <Badge variant="light" color="red" size="sm">ошибок {item.failed}</Badge>}
                    </Group>
                  </Group>
                </Box>
              ))}
            </Stack>
          </Card>
        )}
      </Stack>
    </Container>
  )
}
