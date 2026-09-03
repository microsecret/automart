"use client"

import Link from "next/link"
import useSWR from "swr"
import { useState } from "react"
import { ActionIcon, Badge, Box, Button, Group, Loader, Paper, Stack, Text, Tooltip } from "@mantine/core"
import { IconBell, IconBellOff, IconBrandTelegram, IconGasStation, IconSearch, IconTrash } from "@tabler/icons-react"
import { fetchJson } from "@/lib/api-client"
import { EmptyState } from "@/components/ui/AsyncStates"

/**
 * Подписки человека в одном месте.
 *
 * Подписаться можно было в двух местах — на карте АЗС и в каталоге, — а
 * посмотреть и отменить негде: раздела не существовало. Замер на боевом
 * сервере: двести двенадцать пользователей и три подписки на топливо. Это
 * не «функцией не пользуются», это ловушка — человек не видит, на что
 * подписан, и не рискует подписываться дальше.
 *
 * Бэкенд был готов целиком: и чтение, и удаление есть в
 * /api/fuel-subscriptions и /api/saved-searches. Не хватало только
 * страницы.
 */

type FuelSubscription = {
  id: string
  kind: string
  stationId: string | null
  stationName: string | null
  fuel: string | null
  city: string | null
  lastNotifiedAt: string | null
  createdAt: string
}

type SavedSearch = {
  id: string
  title: string
  scope: string
  notifyTelegram: boolean
  lastMatchCount: number | null
  createdAt: string
}

const FUEL_LABELS: Record<string, string> = {
  AI92: "АИ-92",
  AI95: "АИ-95",
  AI98: "АИ-98",
  AI100: "АИ-100",
  DT: "ДТ",
  GAS: "Газ",
}

/** Человеческое описание подписки: на что именно придёт сообщение. */
function describeFuelSubscription(subscription: FuelSubscription): string {
  const fuel = subscription.fuel ? FUEL_LABELS[subscription.fuel] ?? subscription.fuel : null

  if (subscription.kind === "CITY_FUEL") {
    return `${fuel ?? "Любое топливо"} в городе ${subscription.city ?? "—"}`
  }
  if (subscription.kind === "STATION_FUEL") {
    return `${fuel ?? "Топливо"} на «${subscription.stationName ?? "заправке"}»`
  }
  return `Любое топливо на «${subscription.stationName ?? "заправке"}»`
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })
}

export default function SubscriptionsPanel() {
  const [removingId, setRemovingId] = useState<string | null>(null)

  const fuel = useSWR<{ subscriptions: FuelSubscription[] }>("/api/fuel-subscriptions", fetchJson)
  const searches = useSWR<{ searches: SavedSearch[] }>("/api/saved-searches", fetchJson)

  const fuelList = fuel.data?.subscriptions ?? []
  const searchList = searches.data?.searches ?? []
  const isLoading = fuel.isLoading || searches.isLoading
  const isEmpty = !isLoading && fuelList.length === 0 && searchList.length === 0

  async function removeFuel(id: string) {
    setRemovingId(id)
    try {
      await fetchJson(`/api/fuel-subscriptions?id=${encodeURIComponent(id)}`, { method: "DELETE" })
      await fuel.mutate()
    } finally {
      setRemovingId(null)
    }
  }

  async function removeSearch(id: string) {
    setRemovingId(id)
    try {
      await fetchJson(`/api/saved-searches?id=${encodeURIComponent(id)}`, { method: "DELETE" })
      await searches.mutate()
    } finally {
      setRemovingId(null)
    }
  }

  if (isLoading) {
    return (
      <Group justify="center" py="xl">
        <Loader size="sm" />
        <Text size="sm" c="dimmed">Загружаем подписки…</Text>
      </Group>
    )
  }

  /* Пустое состояние объясняет, что подписка вообще существует и где её
     завести: человек, не знавший о функции, попадает сюда из меню и
     должен уйти отсюда с пониманием, а не с пустым экраном. */
  if (isEmpty) {
    return (
      <EmptyState
        title="Пока нет ни одной подписки"
        description="Бот пишет в Telegram, когда на заправке появляется нужное топливо или в каталоге выходит подходящее объявление. Подписка заводится одной кнопкой на карте АЗС или в результатах поиска."
        actionLabel="Открыть карту АЗС"
        actionHref="/services/fuel-map"
      />
    )
  }

  return (
    <Stack gap="lg">
      {fuelList.length > 0 && (
        <Stack gap="sm">
          <Group gap={8}>
            <IconGasStation size={18} />
            <Text fw={700}>Топливо</Text>
            <Badge size="sm" variant="light">{fuelList.length}</Badge>
          </Group>
          {/* Строка о том, что происходит после подписки: без неё список
              выглядит настройкой, а не работающим обещанием. */}
          <Text size="xs" c="dimmed" mt={-6}>
            Сообщение приходит в Telegram сразу, как только водитель отметит появление топлива. Не чаще раза в час по одной подписке.
          </Text>

          {fuelList.map((subscription) => (
            <Paper key={subscription.id} withBorder radius="md" p="sm">
              <Group justify="space-between" wrap="nowrap" gap="sm">
                <Box miw={0}>
                  <Text fw={600} fz="sm" lineClamp={1}>{describeFuelSubscription(subscription)}</Text>
                  <Text size="xs" c="dimmed">
                    {subscription.lastNotifiedAt
                      ? `Последнее сообщение ${formatDate(subscription.lastNotifiedAt)}`
                      : `Подписка с ${formatDate(subscription.createdAt)} · сообщений пока не было`}
                  </Text>
                </Box>
                <Tooltip label="Отписаться" withArrow>
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    onClick={() => void removeFuel(subscription.id)}
                    loading={removingId === subscription.id}
                    aria-label="Отписаться от уведомлений"
                  >
                    <IconBellOff size={17} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Paper>
          ))}
        </Stack>
      )}

      {searchList.length > 0 && (
        <Stack gap="sm">
          <Group gap={8}>
            <IconSearch size={18} />
            <Text fw={700}>Поиск объявлений</Text>
            <Badge size="sm" variant="light">{searchList.length}</Badge>
          </Group>

          {searchList.map((search) => (
            <Paper key={search.id} withBorder radius="md" p="sm">
              <Group justify="space-between" wrap="nowrap" gap="sm">
                <Box miw={0}>
                  <Text fw={600} fz="sm" lineClamp={1}>{search.title}</Text>
                  <Group gap={6} wrap="wrap">
                    <Text size="xs" c="dimmed">
                      {typeof search.lastMatchCount === "number"
                        ? `${search.lastMatchCount} объявлений в прошлой проверке`
                        : `Сохранён ${formatDate(search.createdAt)}`}
                    </Text>
                    {search.notifyTelegram && (
                      <Badge size="xs" variant="light" leftSection={<IconBrandTelegram size={11} />}>
                        уведомления в боте
                      </Badge>
                    )}
                  </Group>
                </Box>
                <Group gap={4} wrap="nowrap">
                  <Button component={Link} href="/search" size="compact-xs" variant="subtle">
                    Открыть
                  </Button>
                  <Tooltip label="Удалить поиск" withArrow>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      onClick={() => void removeSearch(search.id)}
                      loading={removingId === search.id}
                      aria-label="Удалить сохранённый поиск"
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Group>
            </Paper>
          ))}
        </Stack>
      )}
    </Stack>
  )
}
