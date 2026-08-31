"use client"
export const dynamic = "force-dynamic"

import useSWR, { useSWRConfig } from "swr"
import { useState } from "react"
import {
  Badge, Box, Card, Center, Group, Loader, Pagination, Paper, Select, SimpleGrid,
  Stack, Table, Tabs, Text, TextInput, ThemeIcon, Title,
} from "@mantine/core"
import {
  IconGasStation, IconChartLine, IconRefresh, IconUsers, IconCheck,
  IconSearch, IconDatabase, IconPencilPlus, IconClock,
} from "@tabler/icons-react"
import { AsyncErrorState } from "@/components/ui/AsyncStates"
import TrafficBarChart, { type BarPoint } from "@/components/admin/TrafficBarChart"
import FuelScraperRunner from "@/components/admin/FuelScraperRunner"
import FuelRunConsole from "@/components/admin/FuelRunConsole"
import { fetchJson } from "@/lib/api-client"
import { formatAdminDateTime, formatAdminDateTimeShort } from "@/lib/admin-datetime"
import { SYNC_RUN_STATUS, describeStatus, toneColor } from "@/lib/admin-status-tone"

const SOURCE_LABELS: Record<string, string> = {
  GDEBENZ: "ГдеБЕНЗ",
  GDEZAPRAVKA: "ГдеЗаправка",
  TWOGIS: "2ГИС",
  DROM: "Дром",
}

const FUEL_LABELS: Record<string, string> = {
  AI92: "АИ-92",
  AI95: "АИ-95",
  AI98: "АИ-98",
  AI100: "АИ-100",
  DT: "ДТ",
  GAS: "Газ",
}

const FUEL_STATUS_META: Record<string, { label: string; color: string }> = {
  yes: { label: "Есть", color: "teal" },
  low: { label: "Мало", color: "yellow" },
  no: { label: "Нет", color: "red" },
}

type FuelPriceRow = { fuel: string; priceRub: number; confirmations: number; observedAt: string | null }
type StationRow = {
  id: string
  source: string
  sourceId: string
  name: string | null
  brand: string | null
  address: string | null
  city: string | null
  status: string | null
  fuelsNow: string | null
  updatedAt: string
  prices: FuelPriceRow[]
}
type OverviewResponse = {
  summary: {
    total: number
    withPrices: number
    withAvailability: number
    bySource: Array<{ source: string; count: number }>
    byCity: Array<{ city: string; count: number }>
    lastRun: { source: string; status: string; fetched: number; upserted: number; failed: number; startedAt: string; completedAt: string | null } | null
  }
  stations: StationRow[]
  cities: string[]
  sources: string[]
  page: number
  pageSize: number
  total: number
}
type AnalyticsResponse = {
  analytics: {
    visits30d: number
    uniqueVisitors30d: number
    activeReporters: number
    priceReports30d: number
    availabilityReports30d: number
    newVisitors7d: number
    daily: Array<{ date: string; visits: number; uniqueVisitors: number; priceReports: number; availabilityReports: number }>
    cities: Array<{ city: string; count: number }>
  }
}
type RunsResponse = {
  runs: Array<{
    id: string
    source: string
    status: string
    requested: number
    fetched: number
    upserted: number
    failed: number
    error: string | null
    startedAt: string
    completedAt: string | null
  }>
}

const PAGE_SIZE = 25

function sourceLabel(value: string) {
  return SOURCE_LABELS[value] || value
}

function formatPrice(kopecks: number) {
  return (kopecks / 100).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function shortDay(date: string) {
  return `${date.slice(8, 10)}.${date.slice(5, 7)}`
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status || !FUEL_STATUS_META[status]) {
    return <Badge variant="light" color="gray">—</Badge>
  }
  const meta = FUEL_STATUS_META[status]
  return <Badge variant="light" color={meta.color}>{meta.label}</Badge>
}

function StationsTab({ filters, setFilters }: {
  filters: { city: string | null; source: string | null; status: string | null; q: string; page: number }
  setFilters: (patch: Partial<typeof filters>) => void
}) {
  const params = new URLSearchParams()
  if (filters.city) params.set("city", filters.city)
  if (filters.source) params.set("source", filters.source)
  if (filters.status) params.set("status", filters.status)
  if (filters.q) params.set("q", filters.q)
  params.set("page", String(filters.page))
  params.set("pageSize", String(PAGE_SIZE))

  const { data, error, isLoading, mutate } = useSWR<OverviewResponse>(
    `/api/admin/fuel?view=overview&${params.toString()}`,
    fetchJson,
  )
  /* После ручного прогона таблица и журнал должны показать новые данные без
     перезагрузки страницы, поэтому обновляем и текущий список, и вкладку
     прогонов, которая живёт под своим ключом SWR. */
  const { mutate: globalMutate } = useSWRConfig()
  const refreshAfterRun = () => {
    void mutate()
    void globalMutate("/api/admin/fuel?view=runs")
  }

  if (error) return <AsyncErrorState title="Не удалось загрузить данные" description="Проверьте доступ к серверу и повторите позже." />
  if (isLoading || !data) {
    return (
      <Center h={300}>
        <Loader color="indigo" />
      </Center>
    )
  }

  const pages = Math.max(1, Math.ceil(data.total / data.pageSize))

  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
        <Card withBorder radius="md" p="md">
          <Group gap="xs" c="dimmed">
            <IconGasStation size={18} />
            <Text size="xs" fw={700} tt="uppercase">Заправок в базе</Text>
          </Group>
          <Text fw={800} fz={26} mt={4}>{data.summary.total.toLocaleString("ru-RU")}</Text>
        </Card>
        <Card withBorder radius="md" p="md">
          <Group gap="xs" c="dimmed">
            <IconDatabase size={18} />
            <Text size="xs" fw={700} tt="uppercase">С ценами</Text>
          </Group>
          <Text fw={800} fz={26} mt={4}>{data.summary.withPrices.toLocaleString("ru-RU")}</Text>
        </Card>
        <Card withBorder radius="md" p="md">
          <Group gap="xs" c="dimmed">
            <IconCheck size={18} />
            <Text size="xs" fw={700} tt="uppercase">С наличием</Text>
          </Group>
          <Text fw={800} fz={26} mt={4}>{data.summary.withAvailability.toLocaleString("ru-RU")}</Text>
        </Card>
        <Card withBorder radius="md" p="md">
          <Group gap="xs" c="dimmed">
            <IconRefresh size={18} />
            <Text size="xs" fw={700} tt="uppercase">Последний прогон</Text>
          </Group>
          {data.summary.lastRun ? (
            <>
              <Text fw={800} fz={20} mt={4}>{sourceLabel(data.summary.lastRun.source)}</Text>
              <Text size="xs" c="dimmed">{formatAdminDateTimeShort(data.summary.lastRun.startedAt)}</Text>
            </>
          ) : (
            <Text fw={800} fz={20} mt={4} c="dimmed">Пока не было</Text>
          )}
        </Card>
      </SimpleGrid>

      <FuelScraperRunner onFinished={refreshAfterRun} />

      <FuelRunConsole active />

      <Paper withBorder radius="md" p="sm">
        <Group gap="sm" wrap="wrap">
          <Select
            placeholder="Город"
            data={data.cities.map((city) => ({ value: city, label: city }))}
            value={filters.city}
            onChange={(value) => setFilters({ city: value, page: 1 })}
            clearable
            searchable
            w={220}
          />
          <Select
            placeholder="Источник"
            data={data.sources.map((source) => ({ value: source, label: sourceLabel(source) }))}
            value={filters.source}
            onChange={(value) => setFilters({ source: value, page: 1 })}
            clearable
            w={180}
          />
          <Select
            placeholder="Наличие"
            data={[
              { value: "yes", label: "Есть" },
              { value: "low", label: "Мало" },
              { value: "no", label: "Нет" },
            ]}
            value={filters.status}
            onChange={(value) => setFilters({ status: value, page: 1 })}
            clearable
            w={150}
          />
          <TextInput
            placeholder="Поиск по названию и адресу"
            leftSection={<IconSearch size={16} />}
            value={filters.q}
            onChange={(event) => setFilters({ q: event.currentTarget.value, page: 1 })}
            w={280}
          />
        </Group>
      </Paper>

      <Paper withBorder radius="md">
        <Table striped highlightOnHover verticalSpacing="xs" horizontalSpacing="md">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Город</Table.Th>
              <Table.Th>Заправка</Table.Th>
              <Table.Th>Адрес</Table.Th>
              <Table.Th>Наличие</Table.Th>
              <Table.Th>Цены</Table.Th>
              <Table.Th>Обновлено</Table.Th>
              <Table.Th>Источник</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data.stations.map((station) => (
              <Table.Tr key={station.id}>
                <Table.Td><Text size="sm" fw={600}>{station.city || "—"}</Text></Table.Td>
                <Table.Td>
                  <Text size="sm" fw={600}>{station.name || station.brand || "АЗС"}</Text>
                  {station.brand && station.name && station.brand !== station.name && (
                    <Text size="xs" c="dimmed">{station.brand}</Text>
                  )}
                </Table.Td>
                <Table.Td><Text size="xs">{station.address || "—"}</Text></Table.Td>
                <Table.Td><StatusBadge status={station.status} /></Table.Td>
                <Table.Td>
                  {station.prices.length ? (
                    <Group gap={6} wrap="nowrap">
                      {station.prices.slice(0, 4).map((price) => (
                        <Badge key={price.fuel} variant="outline" color="indigo" size="sm">
                          {FUEL_LABELS[price.fuel] || price.fuel} {formatPrice(price.priceRub)}
                        </Badge>
                      ))}
                    </Group>
                  ) : (
                    <Text size="xs" c="dimmed">—</Text>
                  )}
                </Table.Td>
                <Table.Td><Text size="xs" c="dimmed">{formatAdminDateTimeShort(station.updatedAt)}</Text></Table.Td>
                <Table.Td><Badge variant="light" color="gray">{sourceLabel(station.source)}</Badge></Table.Td>
              </Table.Tr>
            ))}
            {!data.stations.length && (
              <Table.Tr>
                <Table.Td colSpan={7}>
                  <Text size="sm" c="dimmed" ta="center" py="lg">По выбранным фильтрам заправок нет</Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Paper>

      {pages > 1 && (
        <Group justify="center">
          <Pagination total={pages} value={filters.page} onChange={(page) => setFilters({ page })} />
        </Group>
      )}
    </Stack>
  )
}

function AnalyticsTab() {
  const { data, error, isLoading } = useSWR<AnalyticsResponse>("/api/admin/fuel?view=analytics", fetchJson)

  if (error) return <AsyncErrorState title="Не удалось загрузить аналитику" description="Проверьте доступ к серверу и повторите позже." />
  if (isLoading || !data) {
    return (
      <Center h={300}>
        <Loader color="indigo" />
      </Center>
    )
  }

  const a = data.analytics
  const visitPoints: BarPoint[] = a.daily.map((day) => ({
    label: shortDay(day.date),
    title: `${day.date}: ${day.uniqueVisitors} посетителей, ${day.visits} просмотров`,
    value: day.uniqueVisitors,
    secondary: day.visits,
  }))
  const reportPoints: BarPoint[] = a.daily.map((day) => ({
    label: shortDay(day.date),
    title: `${day.date}: цен — ${day.priceReports}, наличия — ${day.availabilityReports}`,
    value: day.priceReports,
    secondary: day.availabilityReports,
  }))

  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 2, sm: 3, lg: 5 }}>
        <Card withBorder radius="md" p="md">
          <Group gap="xs" c="dimmed"><IconChartLine size={18} /><Text size="xs" fw={700} tt="uppercase">Просмотры за 30 дн</Text></Group>
          <Text fw={800} fz={26} mt={4}>{a.visits30d.toLocaleString("ru-RU")}</Text>
        </Card>
        <Card withBorder radius="md" p="md">
          <Group gap="xs" c="dimmed"><IconUsers size={18} /><Text size="xs" fw={700} tt="uppercase">Уникальные за 30 дн</Text></Group>
          <Text fw={800} fz={26} mt={4}>{a.uniqueVisitors30d.toLocaleString("ru-RU")}</Text>
        </Card>
        <Card withBorder radius="md" p="md">
          <Group gap="xs" c="dimmed"><IconPencilPlus size={18} /><Text size="xs" fw={700} tt="uppercase">Активные водители</Text></Group>
          <Text fw={800} fz={26} mt={4}>{a.activeReporters.toLocaleString("ru-RU")}</Text>
        </Card>
        <Card withBorder radius="md" p="md">
          <Group gap="xs" c="dimmed"><IconCheck size={18} /><Text size="xs" fw={700} tt="uppercase">Отметок цен / наличия</Text></Group>
          <Text fw={800} fz={26} mt={4}>{a.priceReports30d} / {a.availabilityReports30d}</Text>
        </Card>
        <Card withBorder radius="md" p="md">
          <Group gap="xs" c="dimmed"><IconClock size={18} /><Text size="xs" fw={700} tt="uppercase">Новые за 7 дн</Text></Group>
          <Text fw={800} fz={26} mt={4}>{a.newVisitors7d.toLocaleString("ru-RU")}</Text>
        </Card>
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, lg: 2 }}>
        <Paper withBorder radius="md" p="md">
          <Text size="sm" fw={700} mb="xs">Посетители карты заправок по дням</Text>
          <TrafficBarChart points={visitPoints} valueLabel="посетителей" secondaryLabel="просмотров" height={180} />
        </Paper>
        <Paper withBorder radius="md" p="md">
          <Text size="sm" fw={700} mb="xs">Отметки водителей по дням</Text>
          <TrafficBarChart points={reportPoints} valueLabel="цен" secondaryLabel="наличия" height={180} />
        </Paper>
      </SimpleGrid>

      <Paper withBorder radius="md" p="md">
        <Text size="sm" fw={700} mb="xs">Города, где пользуются картой</Text>
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
          {a.cities.map((row) => (
            <Group key={row.city} justify="space-between" gap="xs">
              <Text size="sm">{row.city}</Text>
              <Badge variant="light" color="indigo">{row.count}</Badge>
            </Group>
          ))}
          {!a.cities.length && <Text size="sm" c="dimmed">Пока нет данных о выбранных городах</Text>}
        </SimpleGrid>
      </Paper>
    </Stack>
  )
}

function RunsTab() {
  const { data, error, isLoading } = useSWR<RunsResponse>("/api/admin/fuel?view=runs", fetchJson)

  if (error) return <AsyncErrorState title="Не удалось загрузить журнал" description="Проверьте доступ к серверу и повторите позже." />
  if (isLoading || !data) {
    return (
      <Center h={300}>
        <Loader color="indigo" />
      </Center>
    )
  }

  return (
    <Paper withBorder radius="md">
      <Table striped highlightOnHover verticalSpacing="xs" horizontalSpacing="md">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Источник</Table.Th>
            <Table.Th>Статус</Table.Th>
            <Table.Th>Начало</Table.Th>
            <Table.Th>Собрано</Table.Th>
            <Table.Th>Сохранено</Table.Th>
            <Table.Th>Ошибок</Table.Th>
            <Table.Th>Ошибка</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {data.runs.map((run) => {
            const status = describeStatus(SYNC_RUN_STATUS, run.status)
            return (
              <Table.Tr key={run.id}>
                <Table.Td><Badge variant="light" color="gray">{sourceLabel(run.source)}</Badge></Table.Td>
                <Table.Td><Badge variant="light" color={toneColor(status.tone)}>{status.label}</Badge></Table.Td>
                <Table.Td><Text size="xs">{formatAdminDateTime(run.startedAt)}</Text></Table.Td>
                <Table.Td><Text size="sm">{run.fetched}</Text></Table.Td>
                <Table.Td><Text size="sm">{run.upserted}</Text></Table.Td>
                <Table.Td>
                  {run.failed > 0 ? (
                    <Badge variant="light" color="red">{run.failed}</Badge>
                  ) : (
                    <Text size="sm" c="dimmed">0</Text>
                  )}
                </Table.Td>
                <Table.Td><Text size="xs" c={run.error ? "red" : "dimmed"}>{run.error || "—"}</Text></Table.Td>
              </Table.Tr>
            )
          })}
          {!data.runs.length && (
            <Table.Tr>
              <Table.Td colSpan={7}>
                <Text size="sm" c="dimmed" ta="center" py="lg">Прогонов ещё не было</Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </Paper>
  )
}

export default function FuelAdminPage() {
  const [filters, setFilters] = useState<{ city: string | null; source: string | null; status: string | null; q: string; page: number }>({
    city: null, source: null, status: null, q: "", page: 1,
  })

  const patchFilters = (patch: Partial<typeof filters>) => setFilters((current) => ({ ...current, ...patch }))

  return (
    <Stack gap="md">
      <Group gap="sm">
        <ThemeIcon variant="light" color="indigo" size={40} radius="md">
          <IconGasStation size={22} />
        </ThemeIcon>
        <Box>
          <Title order={2}>АЗС и топливо</Title>
          <Text size="sm" c="dimmed">Скрейбер собирает заправки, цены и наличие из ГдеБЕНЗ, ГдеЗаправки и 2ГИС</Text>
        </Box>
      </Group>

      <Tabs defaultValue="stations">
        <Tabs.List>
          <Tabs.Tab value="stations" leftSection={<IconGasStation size={16} />}>Заправки</Tabs.Tab>
          <Tabs.Tab value="analytics" leftSection={<IconChartLine size={16} />}>Аналитика</Tabs.Tab>
          <Tabs.Tab value="runs" leftSection={<IconRefresh size={16} />}>Прогоны</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="stations" pt="md">
          <StationsTab filters={filters} setFilters={patchFilters} />
        </Tabs.Panel>
        <Tabs.Panel value="analytics" pt="md">
          <AnalyticsTab />
        </Tabs.Panel>
        <Tabs.Panel value="runs" pt="md">
          <RunsTab />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  )
}
