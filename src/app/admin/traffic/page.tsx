"use client"

import { useState, type ReactNode } from "react"
import useSWR from "swr"
import {
  Badge, Box, Card, Container, Group, Progress, SegmentedControl,
  SimpleGrid, Stack, Text, ThemeIcon, Title,
} from "@mantine/core"
import { IconChartBar, IconDeviceMobile, IconExternalLink, IconClock, IconSpeakerphone, IconTrendingUp, IconTrendingDown } from "@tabler/icons-react"
import { fetchJson } from "@/lib/api-client"
import { AsyncErrorState } from "@/components/ui/AsyncStates"

type Row = { name: string; visitors: number }

type TrafficResponse = {
  periodLabel: string
  totals: { views: number; uniqueVisitors: number; previousVisitors: number; change: number | null }
  sources: Row[]
  referers: Row[]
  devices: Row[]
  campaigns: Row[]
  topPaths: { path: string; views: number }[]
  hourly: { hour: number; visitors: number }[]
}

/**
 * Аналитика посещаемости.
 *
 * Одна цифра за период не отвечает, растёт площадка или падает: рядом с
 * числом посетителей стоит сравнение с таким же предыдущим отрезком.
 *
 * Отрезки календарные и московские: «последние 30 дней» нельзя сопоставить с
 * февралём или мартом, а владелец сравнивает именно месяцы.
 */
export default function TrafficPage() {
  const [period, setPeriod] = useState("week")
  const { data, error, isLoading, mutate } = useSWR<TrafficResponse>(
    `/api/admin/traffic?period=${period}`,
    fetchJson,
    { keepPreviousData: true },
  )

  const change = data?.totals.change
  const peakHour = data?.hourly.reduce(
    (best, item) => (item.visitors > best.visitors ? item : best),
    { hour: 0, visitors: 0 },
  )
  const maxHourly = Math.max(1, ...(data?.hourly.map((item) => item.visitors) || [1]))

  const renderList = (title: string, icon: ReactNode, rows: Row[] | undefined, empty: string) => {
    const max = Math.max(1, ...(rows?.map((row) => row.visitors) || [1]))
    return (
      <Card withBorder radius="md" p="md">
        <Group gap="xs" mb="sm">
          <ThemeIcon variant="light" color="indigo" size={28} radius="md">{icon}</ThemeIcon>
          <Text size="sm" fw={700}>{title}</Text>
        </Group>
        {rows && rows.length > 0 ? (
          <Stack gap={8}>
            {rows.map((row) => (
              <Box key={row.name}>
                <Group justify="space-between" gap="xs" wrap="nowrap" mb={3}>
                  <Text size="sm" lineClamp={1}>{row.name}</Text>
                  <Text size="sm" fw={700} style={{ fontVariantNumeric: "tabular-nums" }}>{row.visitors}</Text>
                </Group>
                {/* Полоса вместо голого числа: доля видна сразу, без счёта в уме. */}
                <Progress value={(row.visitors / max) * 100} size="xs" color="indigo" radius="xl" />
              </Box>
            ))}
          </Stack>
        ) : (
          <Text size="sm" c="dimmed">{isLoading ? "Загружаем…" : empty}</Text>
        )}
      </Card>
    )
  }

  return (
    /* Отступы по общей шкале админки: было py="lg" без боковых полей, и
       при переходе с соседней вкладки содержимое смещалось. */
    <Container size="xl" p={{ base: "sm", md: "md" }}>
      <Stack gap="lg">
        <Group justify="space-between" align="flex-end" wrap="wrap" gap="sm">
          <Group gap="sm">
            <ThemeIcon variant="light" color="indigo" size={42} radius="md"><IconChartBar size={22} /></ThemeIcon>
            <Box>
              <Title order={1} size="h3">Посещаемость</Title>
              <Text size="sm" c="dimmed">Источники переходов, устройства и активность по часам</Text>
            </Box>
          </Group>
          <SegmentedControl
            value={period}
            onChange={setPeriod}
            data={[
              { value: "day", label: "Сегодня" },
              { value: "week", label: "Неделя" },
              { value: "month", label: "Месяц" },
            ]}
          />
        </Group>

        {error ? (
          <AsyncErrorState
            title="Не удалось загрузить аналитику"
            description="Данные не изменены. Повторите запрос."
            onRetry={() => mutate()}
          />
        ) : (
          <>
            <SimpleGrid cols={{ base: 2, md: 4 }} spacing="sm">
              <Card withBorder radius="md" p="md">
                <Text fz={28} fw={800} ff="var(--font-display),sans-serif" lh={1}>
                  {isLoading ? "—" : data?.totals.uniqueVisitors.toLocaleString("ru")}
                </Text>
                <Text size="sm" fw={600} mt={4}>Уникальных посетителей</Text>
                {typeof change === "number" && (
                  <Group gap={4} mt={4}>
                    <ThemeIcon variant="light" size={20} radius="sm" color={change >= 0 ? "teal" : "red"}>
                      {change >= 0 ? <IconTrendingUp size={12} /> : <IconTrendingDown size={12} />}
                    </ThemeIcon>
                    <Text size="xs" c={change >= 0 ? "teal.7" : "red.7"} fw={600}>
                      {change >= 0 ? "+" : ""}{change}% к прошлому периоду
                    </Text>
                  </Group>
                )}
              </Card>

              <Card withBorder radius="md" p="md">
                <Text fz={28} fw={800} ff="var(--font-display),sans-serif" lh={1}>
                  {isLoading ? "—" : data?.totals.views.toLocaleString("ru")}
                </Text>
                <Text size="sm" fw={600} mt={4}>Просмотров страниц</Text>
                <Text size="xs" c="dimmed">{data?.periodLabel}</Text>
              </Card>

              <Card withBorder radius="md" p="md">
                <Text fz={28} fw={800} ff="var(--font-display),sans-serif" lh={1}>
                  {isLoading || !data ? "—" : (data.totals.views / Math.max(1, data.totals.uniqueVisitors)).toFixed(1)}
                </Text>
                <Text size="sm" fw={600} mt={4}>Страниц на человека</Text>
                <Text size="xs" c="dimmed">Глубина просмотра</Text>
              </Card>

              <Card withBorder radius="md" p="md">
                <Text fz={28} fw={800} ff="var(--font-display),sans-serif" lh={1}>
                  {isLoading || !peakHour ? "—" : `${peakHour.hour}:00`}
                </Text>
                <Text size="sm" fw={600} mt={4}>Час пика</Text>
                <Text size="xs" c="dimmed">По Москве · когда запускать рассылку</Text>
              </Card>
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, md: 2, xl: 4 }} spacing="sm">
              {renderList("Источники переходов", <IconExternalLink size={15} />, data?.sources, "Пока нет данных")}
              {renderList("Кампании и кнопки", <IconSpeakerphone size={15} />, data?.campaigns, "Переходов по размеченным кнопкам пока не было")}
              {renderList("Сайты-источники", <IconExternalLink size={15} />, data?.referers, "Переходов со сторонних сайтов не было")}
              {renderList("Устройства", <IconDeviceMobile size={15} />, data?.devices, "Пока нет данных")}
            </SimpleGrid>

            <Card withBorder radius="md" p="md">
              <Group gap="xs" mb="sm">
                <ThemeIcon variant="light" color="indigo" size={28} radius="md"><IconClock size={15} /></ThemeIcon>
                <Text size="sm" fw={700}>Активность по часам (МСК)</Text>
              </Group>
              {/* Столбики, а не таблица: провалы и пики видно с одного взгляда. */}
              <Group gap={3} align="flex-end" h={90} wrap="nowrap">
                {data?.hourly.map((item) => (
                  <Box key={item.hour} style={{ flex: 1, minWidth: 0 }}>
                    <Box
                      title={`${item.hour}:00 — ${item.visitors}`}
                      style={{
                        height: `${Math.max(3, (item.visitors / maxHourly) * 72)}px`,
                        background: item.visitors === maxHourly
                          ? "var(--market-accent)"
                          : "color-mix(in srgb, var(--market-primary) 45%, transparent)",
                        borderRadius: "var(--radius-xs)",
                      }}
                    />
                    <Text size="9px" c="dimmed" ta="center" mt={3}>
                      {item.hour % 3 === 0 ? item.hour : ""}
                    </Text>
                  </Box>
                ))}
              </Group>
            </Card>

            <Card withBorder radius="md" p="md">
              <Text size="sm" fw={700} mb="sm">Популярные страницы</Text>
              <Stack gap={6}>
                {data?.topPaths.map((item) => (
                  <Group key={item.path} justify="space-between" gap="xs" wrap="nowrap">
                    <Text size="sm" lineClamp={1}>{item.path}</Text>
                    <Badge variant="light" color="indigo" size="sm">{item.views}</Badge>
                  </Group>
                ))}
              </Stack>
            </Card>
          </>
        )}
      </Stack>
    </Container>
  )
}
