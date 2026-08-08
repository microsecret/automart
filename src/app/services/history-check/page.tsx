"use client"
export const dynamic = "force-dynamic"
import { useState } from "react"
import { Box, Stack, Text, Paper, TextInput, Button, Group, ThemeIcon, SimpleGrid, Divider, Badge, Timeline, Center, Loader } from "@mantine/core"
import { IconHistory, IconCheck, IconX, IconShieldCheck, IconCar, IconAlertTriangle, IconSearch, IconFileText } from "@tabler/icons-react"

interface ReportItem { label: string; value: string; ok: boolean }
interface HistoryEvent { date: string; title: string; type: "ok" | "warn" | "bad" }

function generateReport(vin: string) {
  const seed = vin.split("").reduce((s, c) => s + c.charCodeAt(0), 0)
  const rnd = (salt: number) => ((seed * 9301 + salt * 49297) % 233280) / 233280

  const hasAccident = rnd(1) < 0.25
  const hasRestriction = rnd(2) < 0.12
  const hasTaxi = rnd(3) < 0.1
  const hasMileageRollback = rnd(4) < 0.18
  const owners = 1 + Math.floor(rnd(5) * 4)

  const items: ReportItem[] = [
    { label: "ДТП", value: hasAccident ? "Найдено: 1 случай" : "Не найдено", ok: !hasAccident },
    { label: "В розыске", value: "Нет", ok: true },
    { label: "Залог", value: rnd(6) < 0.08 ? "В реестре залогов" : "Нет", ok: rnd(6) >= 0.08 },
    { label: "Ограничения ГИБДД", value: hasRestriction ? "Есть ограничения" : "Нет", ok: !hasRestriction },
    { label: "Такси / Каршеринг", value: hasTaxi ? "Использовалось в такси" : "Не использовалось", ok: !hasTaxi },
    { label: "Утиль / Тотал", value: "Нет", ok: true },
    { label: "Владельцев по ПТС", value: String(owners), ok: owners <= 3 },
    { label: "Скрученный пробег", value: hasMileageRollback ? "Обнаружен откат" : "Не обнаружен", ok: !hasMileageRollback },
  ]

  const events: HistoryEvent[] = [
    { date: `${2024 - Math.floor(rnd(7) * 5)}`, title: "Регистрация в ГИБДД", type: "ok" },
    { date: `${2023 - Math.floor(rnd(8) * 3)}`, title: "Техосмотр пройден", type: "ok" },
  ]
  if (hasAccident) events.push({ date: `${2022 - Math.floor(rnd(9) * 2)}`, title: "ДТП — повреждение заднего бампера", type: "bad" })
  if (hasMileageRollback) events.push({ date: "2021", title: "Подозрение на корректировку пробега", type: "warn" })
  events.push({ date: `${2020 + Math.floor(rnd(10) * 2)}`, title: "Договор купли-продажи", type: "ok" })

  const cleanScore = items.filter((i) => i.ok).length
  return { items, events, cleanScore, total: items.length }
}

export default function HistoryCheckPage() {
  const [vin, setVin] = useState("")
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<ReturnType<typeof generateReport> | null>(null)

  const check = () => {
    if (vin.length < 10) return
    setLoading(true)
    setReport(null)
    setTimeout(() => {
      setReport(generateReport(vin))
      setLoading(false)
    }, 1500)
  }

  const isClean = report && report.cleanScore === report.total

  return (
    <Box p={{ base: "sm", md: "md" }} style={{ maxWidth: 640, margin: "0 auto" }}>
      <Stack gap="md">
        <Group gap="sm" align="center">
          <ThemeIcon variant="light" color="green" size={44} radius="md"><IconHistory size={22} /></ThemeIcon>
          <Stack gap={0}>
            <Text component="h1" fw={800} fz={22} c="dark.9" ff="var(--font-display),sans-serif">Проверка истории авто</Text>
            <Text size="xs" c="gray.5">Полный отчёт по VIN: ДТП, пробег, ограничения, розыск, владельцы</Text>
          </Stack>
        </Group>

        <Paper withBorder radius="md" p="lg">
          <Stack gap="md">
            <TextInput label="VIN-номер" placeholder="Например: WAUZZZ8K9DA123456" value={vin} onChange={(e) => setVin(e.currentTarget.value.toUpperCase())} size="md" maxLength={17} leftSection={<IconSearch size={18} />} />
            <Button onClick={check} color="green" radius="md" size="md" loading={loading} leftSection={<IconShieldCheck size={18} />} disabled={vin.length < 10}>
              Проверить историю
            </Button>
            <Text size="xs" c="gray.4">Отчёт формируется 2-3 секунды</Text>
          </Stack>
        </Paper>

        {loading && <Center py={40}><Stack align="center"><Loader size="sm" color="green" /><Text size="sm" c="gray.5">Проверяем по базам ЕАЭС...</Text></Stack></Center>}

        {report && (
          <Stack gap="md">
            {/* Итоговый вердикт */}
            <Paper radius="md" p="lg" withBorder style={{
              borderColor: isClean ? "#bbf7d0" : "#fde68a",
              background: isClean ? "#f0fdf4" : "#fffbeb",
            }}>
              <Group gap="md" align="center">
                <ThemeIcon size={52} radius="xl" color={isClean ? "green" : "orange"} variant="light">
                  {isClean ? <IconShieldCheck size={28} /> : <IconAlertTriangle size={28} />}
                </ThemeIcon>
                <Stack gap={2}>
                  <Text fw={700} fz="lg" c={isClean ? "#16a34a" : "#d97706"}>{isClean ? "Чистая история" : "Найдены проблемы"}</Text>
                  <Text size="sm" c="gray.6">{report.cleanScore} из {report.total} проверок пройдено</Text>
                  <Badge size="sm" color={isClean ? "green" : "orange"} variant="light">VIN: {vin.slice(0, 4)}...{vin.slice(-4)}</Badge>
                </Stack>
              </Group>
            </Paper>

            {/* Детальный отчёт */}
            <Paper radius="md" p="md" withBorder>
              <Group gap="xs" mb="sm"><IconFileText size={16} color="gray.6" /><Text fw={700} c="dark.9">Результаты проверок</Text></Group>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
                {report.items.map((item) => (
                  <Group key={item.label} gap="sm" align="flex-start">
                    <ThemeIcon variant="light" color={item.ok ? "green" : "red"} size={28} radius="sm" style={{ flexShrink: 0 }}>
                      {item.ok ? <IconCheck size={16} /> : <IconX size={16} />}
                    </ThemeIcon>
                    <Stack gap={0}>
                      <Text size="xs" c="gray.5">{item.label}</Text>
                      <Text size="sm" fw={600} c={item.ok ? "#16a34a" : "#dc2626"}>{item.value}</Text>
                    </Stack>
                  </Group>
                ))}
              </SimpleGrid>
            </Paper>

            {/* Хронология */}
            <Paper radius="md" p="md" withBorder>
              <Group gap="xs" mb="sm"><IconHistory size={16} color="gray.6" /><Text fw={700} c="dark.9">Хронология событий</Text></Group>
              <Timeline bulletSize={20} lineWidth={2} color="green">
                {report.events.map((e, i) => (
                  <Timeline.Item key={i} bullet={<IconCar size={12} />} title={<Text size="sm" fw={600} c={e.type === "bad" ? "#dc2626" : e.type === "warn" ? "#d97706" : "var(--mantine-color-text)"}>{e.title}</Text>}>
                    <Text size="xs" c="gray.4">{e.date}</Text>
                  </Timeline.Item>
                ))}
              </Timeline>
            </Paper>

            <Text size="xs" c="gray.4" ta="center">Демонстрационный отчёт. В продакшене — данные из реестров ГИБДД, ФССП, НБКИ.</Text>
          </Stack>
        )}
      </Stack>
    </Box>
  )
}
