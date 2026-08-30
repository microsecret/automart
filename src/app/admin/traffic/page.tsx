"use client"

import { useState, type ReactNode } from "react"
import useSWR from "swr"
import {
  Badge, Box, Card, Container, Group, Progress, SegmentedControl,
  SimpleGrid, Stack, Text, ThemeIcon, Title,
} from "@mantine/core"
import { IconChartBar, IconDeviceMobile, IconExternalLink, IconClock, IconSpeakerphone, IconMapPin, IconLayoutGrid, IconTrendingUp } from "@tabler/icons-react"
import TrafficBarChart from "@/components/admin/TrafficBarChart"
import { fetchJson } from "@/lib/api-client"
import { AdminStatCard } from "@/components/admin/AdminStatCard"
import { AsyncErrorState } from "@/components/ui/AsyncStates"

type Row = { name: string; visitors: number }

type TrafficResponse = {
  periodLabel: string
  totals: { views: number; uniqueVisitors: number; previousVisitors: number; change: number | null }
  totalsExtra: { viewsPerVisit: number; bounceRate: number; signedInVisitors: number; signedInShare: number; returningVisitors: number; newVisitors: number; returningShare: number }
  sources: Row[]
  referers: Row[]
  devices: Row[]
  campaigns: Row[]
  cities: Row[]
  sections: { key: string; label: string; group: string; visitors: number; views: number; previousVisitors: number; change: number | null }[]
  daily: { day: string; visitors: number; views: number }[]
  groups: { group: string; label: string; visitors: number; views: number }[]
  topPaths: { path: string; label: string; views: number }[]
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
            {/* Четыре карточки раскрывались вручную — сорок строк почти
                одинаковой разметки. Перебор по массиву и общий компонент
                держат единый вид со всеми остальными страницами. */}
            <SimpleGrid cols={{ base: 2, md: 3, xl: 6 }} spacing="sm">
              {[
                {
                  value: isLoading ? "—" : data?.totals.uniqueVisitors.toLocaleString("ru"),
                  label: "Уникальных посетителей",
                  changePercent: typeof change === "number" ? change : undefined,
                },
                {
                  value: isLoading ? "—" : data?.totals.views.toLocaleString("ru"),
                  label: "Просмотров страниц",
                  hint: data?.periodLabel,
                },
                {
                  value: isLoading || !data ? "—" : String(data.totalsExtra.viewsPerVisit),
                  label: "Страниц на человека",
                  /* Одна страница за визит — люди приходят и уходят;
                     десять — площадкой действительно пользуются. */
                  hint: data && data.totalsExtra.bounceRate > 0
                    ? `Ушли сразу: ${data.totalsExtra.bounceRate}%`
                    : "Глубина просмотра",
                },
                {
                  value: isLoading || !data ? "—" : data.totalsExtra.signedInVisitors.toLocaleString("ru"),
                  label: "Вошли в аккаунт",
                  /* Гость смотрит, вошедший действует: владельцу важно,
                     растёт ли вторая половина. */
                  hint: data ? `${data.totalsExtra.signedInShare}% от всех` : undefined,
                },
                {
                  value: isLoading || !data ? "—" : data.totalsExtra.returningVisitors.toLocaleString("ru"),
                  label: "Вернулись",
                  /* Сто посетителей — это сто новых людей или двадцать
                     постоянных? Ответ меняет решение: в первом случае
                     площадку находят, но не возвращаются. */
                  hint: data ? `${data.totalsExtra.returningShare}% · новых ${data.totalsExtra.newVisitors}` : undefined,
                },
                {
                  value: isLoading || !peakHour ? "—" : `${peakHour.hour}:00`,
                  label: "Час пика",
                  hint: "По Москве · когда запускать рассылку",
                },
              ].map((card) => (
                <AdminStatCard key={card.label} {...card} />
              ))}
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, md: 2, xl: 4 }} spacing="sm">
              {renderList("Источники переходов", <IconExternalLink size={15} />, data?.sources, "Пока нет данных")}
              {renderList("Кампании и кнопки", <IconSpeakerphone size={15} />, data?.campaigns, "Переходов по размеченным кнопкам пока не было")}
              {renderList("Сайты-источники", <IconExternalLink size={15} />, data?.referers, "Переходов со сторонних сайтов не было")}
              {renderList("Устройства", <IconDeviceMobile size={15} />, data?.devices, "Пока нет данных")}
              {/* Город человек выбирает сам — на карте заправок или в
                  фильтре каталога. Это честнее геобазы: говорит, где он
                  ищет машину, а не откуда подключился. */}
              {renderList("Города", <IconMapPin size={15} />, data?.cities, "Город никто ещё не выбирал")}
            </SimpleGrid>

            {/* Чем площадка живёт в целом.

                Десять разделов в списке отвечают точно, но не сразу:
                владельцу нужно за секунду увидеть, что перевешивает —
                объявления, запчасти или сервисы, — и только потом
                разбираться внутри направления. */}
            {data && data.groups.length > 0 && (
              <Card withBorder radius="md" p="md">
                <Text size="sm" fw={700} mb="sm">Направления</Text>
                <Group gap={2} wrap="nowrap" mb="sm" style={{ height: 12, borderRadius: 6, overflow: "hidden" }}>
                  {data.groups.map((group, index) => {
                    const share = (group.views / Math.max(1, data.totals.views)) * 100
                    const colors = ["indigo", "teal", "orange", "violet", "cyan", "grape", "gray"]
                    return (
                      <Box
                        key={group.group}
                        title={`${group.label}: ${group.views} просмотров`}
                        style={{
                          width: `${share}%`,
                          height: "100%",
                          background: `var(--mantine-color-${colors[index % colors.length]}-5)`,
                        }}
                      />
                    )
                  })}
                </Group>
                <Group gap="md" wrap="wrap">
                  {data.groups.map((group, index) => {
                    const colors = ["indigo", "teal", "orange", "violet", "cyan", "grape", "gray"]
                    const share = Math.round((group.views / Math.max(1, data.totals.views)) * 100)
                    return (
                      <Group key={group.group} gap={6} wrap="nowrap">
                        <Box style={{ width: 8, height: 8, borderRadius: 2, background: `var(--mantine-color-${colors[index % colors.length]}-5)` }} />
                        <Text size="xs">{group.label}</Text>
                        <Text size="xs" c="dimmed" fw={600}>{share}%</Text>
                      </Group>
                    )
                  })}
                </Group>
              </Card>
            )}

            {/* Динамика по дням.

                Одна цифра за период не говорит, был ли рост ровным или
                это всплеск одного дня: неделя с сотней посетителей может
                означать и пятнадцать каждый день, и сотню в понедельник
                при тишине после. */}
            {data && data.daily.length > 1 && (
              <Card withBorder radius="md" p="md">
                <Group gap="xs" mb="md">
                  <ThemeIcon variant="light" color="indigo" size={28} radius="md"><IconTrendingUp size={15} /></ThemeIcon>
                  <Text size="sm" fw={700}>Посетители по дням</Text>
                </Group>
                <TrafficBarChart
                  points={data.daily.map((item) => ({
                    label: item.day.slice(8),
                    title: new Date(item.day).toLocaleDateString("ru-RU", { day: "numeric", month: "long" }),
                    value: item.visitors,
                    secondary: item.views,
                  }))}
                  height={150}
                />
              </Card>
            )}

            <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="sm">
              <Card withBorder radius="md" p="md">
                <Group gap="xs" mb="md">
                  <ThemeIcon variant="light" color="indigo" size={28} radius="md"><IconClock size={15} /></ThemeIcon>
                  <Box>
                    <Text size="sm" fw={700}>Активность по часам</Text>
                    <Text size="xs" c="dimmed">По Москве · пик подсвечен</Text>
                  </Box>
                </Group>
                {data && (
                  <TrafficBarChart
                    points={data.hourly.map((item) => ({
                      label: String(item.hour),
                      title: `${item.hour}:00`,
                      value: item.visitors,
                    }))}
                  />
                )}
              </Card>

              {/* Чем пользуются, а не какие адреса открывают.

                  Список путей не отвечает на вопрос владельца: живёт ли
                  раздел запчастей, окупается ли карта заправок. Сорок
                  строк с кодами объявлений вытесняли из отчёта всё
                  остальное. */}
              <Card withBorder radius="md" p="md">
                <Group gap="xs" mb="md">
                  <ThemeIcon variant="light" color="teal" size={28} radius="md"><IconLayoutGrid size={15} /></ThemeIcon>
                  <Box>
                    <Text size="sm" fw={700}>Чем пользуются</Text>
                    <Text size="xs" c="dimmed">Разделы по числу посетителей</Text>
                  </Box>
                </Group>
                {data && data.sections.length > 0 ? (
                  <Stack gap={8}>
                    {data.sections.slice(0, 10).map((item) => {
                      const share = Math.round((item.visitors / Math.max(1, data.totals.uniqueVisitors)) * 100)
                      return (
                        <Box key={item.key}>
                          <Group justify="space-between" gap="xs" wrap="nowrap" mb={3}>
                            <Text size="sm" lineClamp={1}>{item.label}</Text>
                            <Group gap={6} wrap="nowrap">
                              {/* Рост важнее самого числа: раздел, потерявший
                                  половину аудитории, требует внимания даже
                                  когда цифра ещё большая. */}
                              {item.change !== null && item.change !== 0 && (
                                <Text size="xs" fw={600} c={item.change > 0 ? "teal" : "red"}>
                                  {item.change > 0 ? "+" : ""}{item.change}%
                                </Text>
                              )}
                              <Text size="xs" c="dimmed">{item.views} просм.</Text>
                              <Badge variant="light" color="teal" size="sm">{item.visitors}</Badge>
                            </Group>
                          </Group>
                          <Progress value={share} color="teal" size="sm" radius="xl" />
                        </Box>
                      )
                    })}
                  </Stack>
                ) : (
                  <Text size="sm" c="dimmed">Пока нет данных</Text>
                )}
              </Card>
            </SimpleGrid>

            <Card withBorder radius="md" p="md">
              <Text size="sm" fw={700} mb="sm">Популярные страницы</Text>
              <Stack gap={6}>
                {data?.topPaths.map((item) => (
                  <Group key={item.path} justify="space-between" gap="xs" wrap="nowrap">
                    <Box style={{ minWidth: 0 }}>
                      <Text size="sm" lineClamp={1}>{item.label}</Text>
                      {item.label !== item.path && (
                        <Text size="10px" c="dimmed" lineClamp={1}>{item.path}</Text>
                      )}
                    </Box>
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
