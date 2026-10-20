"use client"

import Link from "next/link"
import useSWR from "swr"
import { useRef, useState } from "react"
import { ActionIcon, Alert, Badge, Box, Button, Group, Paper, Stack, Switch, Text, Tooltip } from "@mantine/core"
import { IconBellOff, IconGasStation, IconSearch, IconTrash } from "@tabler/icons-react"
import { fetchJson, getApiClientErrorMessage } from "@/lib/api-client"
import { savedSearchHref, type SavedSearchScope } from "@/lib/saved-search"
import { savedSearchSummary } from "@/lib/saved-search-summary.mjs"
import { AsyncErrorState, AsyncLoadingState } from "@/components/ui/AsyncStates"
import ScenicBanner from "@/components/ui/ScenicBanner"
import classes from "./SubscriptionsPanel.module.css"

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
  query?: string
  notifyTelegram: boolean
  lastMatchCount: number | null
  lastCheckedAt: string | null
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
  return new Date(value).toLocaleDateString("ru-RU", { day: "numeric", month: "long", timeZone: "Asia/Yekaterinburg" })
}

export default function SubscriptionsPanel() {
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [isToggling, setIsToggling] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState("")
  const actionLock = useRef(false)

  const fuel = useSWR<{ subscriptions: FuelSubscription[] }>("/api/fuel-subscriptions", fetchJson)
  const searches = useSWR<{ searches: SavedSearch[] }>("/api/saved-searches", fetchJson)

  const fuelList = fuel.data?.subscriptions ?? []
  const searchList = searches.data?.searches ?? []
  const isLoading = fuel.isLoading || searches.isLoading
  const loadError = fuel.error || searches.error
  const isEmpty = !isLoading && fuelList.length === 0 && searchList.length === 0

  async function removeFuel(id: string) {
    if (actionLock.current) return
    /* Красный значок без подписи стоит в ряду карточек, и промах пальцем
       на телефоне отписывал молча. Заново подписка заводится только через
       карточку заправки на карте — то есть человек сначала не понимает,
       почему перестали приходить сообщения, а потом ищет, где включить. */
    if (!window.confirm("Отписаться от уведомлений? Включить снова можно будет через карточку заправки на карте.")) return

    actionLock.current = true
    setRemovingId(id)
    setActionError(null)
    setFeedback("")
    try {
      await fetchJson(`/api/fuel-subscriptions?id=${encodeURIComponent(id)}`, { method: "DELETE" })
      await fuel.mutate((current) => current ? { subscriptions: current.subscriptions.filter((row) => row.id !== id) } : current, { revalidate: false })
      setFeedback("Подписка на топливо удалена.")
    } catch (error) {
      setActionError(getApiClientErrorMessage(error, "Не удалось отписаться. Повторите попытку."))
    } finally {
      actionLock.current = false
      setRemovingId(null)
    }
  }

  async function removeSearch(id: string) {
    if (actionLock.current) return
    /* Сохранённый поиск — это набор фильтров, собранный руками: марка,
       год, цена, пробег, город. Восстановить его после удаления нельзя,
       и одно касание не должно стоить этой работы. */
    if (!window.confirm("Удалить сохранённый поиск? Его фильтры не восстановить.")) return

    actionLock.current = true
    setRemovingId(id)
    setActionError(null)
    setFeedback("")
    try {
      await fetchJson(`/api/saved-searches?id=${encodeURIComponent(id)}`, { method: "DELETE" })
      await searches.mutate((current) => current ? { searches: current.searches.filter((row) => row.id !== id) } : current, { revalidate: false })
      setFeedback("Сохранённый поиск удалён.")
    } catch (error) {
      setActionError(getApiClientErrorMessage(error, "Не удалось удалить поиск. Повторите попытку."))
    } finally {
      actionLock.current = false
      setRemovingId(null)
    }
  }

  async function toggleSearch(search: SavedSearch) {
    if (actionLock.current) return
    actionLock.current = true
    setRemovingId(search.id)
    setIsToggling(true)
    setActionError(null)
    setFeedback("")
    try {
      const result = await fetchJson<{ search: SavedSearch }>("/api/saved-searches", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: search.id, notifyTelegram: !search.notifyTelegram }),
      })
      await searches.mutate((current) => current ? { searches: current.searches.map((row) => row.id === search.id ? result.search : row) } : current, { revalidate: false })
      setFeedback(result.search.notifyTelegram ? "Уведомления включены. Будем следить за новыми предложениями с этого момента." : "Уведомления на паузе. Фильтры поиска сохранены.")
    } catch (error) {
      setActionError(getApiClientErrorMessage(error, "Не удалось изменить подписку. Повторите попытку."))
    } finally {
      actionLock.current = false
      setRemovingId(null)
      setIsToggling(false)
    }
  }

  if (isLoading) {
    return <AsyncLoadingState label="Загружаем подписки…" />
  }

  if (loadError) {
    return (
      <AsyncErrorState
        title="Не удалось загрузить подписки"
        description="Подписки на топливо и сохранённые поиски временно недоступны. Повторите запрос."
        onRetry={() => Promise.all([fuel.mutate(), searches.mutate()])}
      />
    )
  }

  const banner = <ScenicBanner scene="subscriptions">
    <Stack gap="sm" maw={520}>
      <Text component="h1" fw={800} fz="h2">Подписки на поиск</Text>
      <Text>Сохраняйте поиск и следите за новыми предложениями</Text>
      <Group gap="xs">
        <Button component={Link} href="/" color="indigo">Найти автомобиль</Button>
        <Button component={Link} href="/services/fuel-map" variant="default">Открыть карту АЗС</Button>
      </Group>
    </Stack>
  </ScenicBanner>

  const notices = <>
    {actionError && <Alert color="red" role="alert" title="Изменение не сохранено">{actionError}</Alert>}
    <Text size="sm" c="dimmed" role="status" aria-live="polite" className={classes.feedback}>{feedback}</Text>
  </>

  /* Пустое состояние объясняет, что подписка вообще существует и где её
     завести: человек, не знавший о функции, попадает сюда из меню и
     должен уйти отсюда с пониманием, а не с пустым экраном. */
  if (isEmpty) {
    return (
      <Stack gap="md">
      {banner}
      {notices}
      <Paper withBorder radius="md" p="md">
        <Stack gap={4}>
          <Text fw={700}>Пока нет ни одной подписки</Text>
          <Text size="sm" c="dimmed">Бот пишет в Telegram, когда на заправке появляется нужное топливо или в каталоге выходит подходящее объявление. Сохраните поиск в каталоге или оформите подписку на карте АЗС.</Text>
        </Stack>
      </Paper>
      </Stack>
    )
  }

  return (
    <Stack gap="lg">
      {banner}
      {notices}
      <details className={classes.tutorial}>
        <summary>Как управлять подписками</summary>
        <ol>
          <li>Откройте сохранённый поиск: все выбранные фильтры уже подставлены.</li>
          <li>Поставьте уведомления на паузу, если пока не ищете. Сам поиск останется.</li>
          <li>Включите снова: будем проверять только новые предложения, без накопившихся за время паузы.</li>
        </ol>
        <Text size="sm" c="dimmed">Для поисков объявлений — до 5 уведомлений за 24 часа суммарно. Они сохраняются на сайте; при доступном боте приходят и в Telegram.</Text>
      </details>
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
                    disabled={removingId !== null}
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
            <Paper key={search.id} withBorder radius="md" p="md" className={classes.search} data-busy={removingId === search.id || undefined} aria-busy={removingId === search.id}>
              <Group justify="space-between" wrap="wrap" gap="sm" align="flex-start">
                <Box miw={0}>
                  <Text component="h2" fw={700} fz="md" className={classes.title}>{search.title}</Text>
                  <Group gap={6} wrap="wrap">
                    <Badge size="sm" variant="light" color={search.notifyTelegram ? "indigo" : "gray"}>{search.notifyTelegram ? "Следим за новыми" : "На паузе"}</Badge>
                    <Text size="xs" c="dimmed">
                      {typeof search.lastMatchCount === "number"
                        ? `Совпадений при последнем подсчёте: ${search.lastMatchCount}`
                        : `Сохранён ${formatDate(search.createdAt)}`}
                    </Text>
                  </Group>
                  <ul className={classes.filters} aria-label="Условия сохранённого поиска">
                    {savedSearchSummary(search.query ?? "").map((facet) => <li key={facet.label}><span>{facet.label}:</span> {facet.value}</li>)}
                  </ul>
                  {search.lastCheckedAt && <Text size="xs" c="dimmed" mt={6}>Проверяли {formatDate(search.lastCheckedAt)}</Text>}
                </Box>
                <Group gap="sm" wrap="wrap" className={classes.actions}>
                  <Switch checked={search.notifyTelegram} onChange={() => void toggleSearch(search)} disabled={removingId !== null} label="Уведомления" aria-label={`Уведомления: ${search.title}`} />
                  {/* Открывает выдачу подписки с её фильтрами: раньше любая
                      подписка вела на общий /search без условий. */}
                  <Button component={Link} href={savedSearchHref(search.scope as SavedSearchScope, search.query ?? "")} size="sm" variant="light">
                    Открыть
                  </Button>
                  <Tooltip label="Удалить поиск" withArrow>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      onClick={() => void removeSearch(search.id)}
                      loading={removingId === search.id && !isToggling}
                      disabled={removingId !== null}
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
