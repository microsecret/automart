"use client"
export const dynamic = "force-dynamic"
import { useState } from "react"
import { Box, Stack, Text, Paper, NumberInput, Button, Select, Group, ThemeIcon, Divider, SimpleGrid, Progress, Badge } from "@mantine/core"
import { IconCalculator, IconTrendingUp, IconTrendingDown, IconCar, IconInfoCircle } from "@tabler/icons-react"
import { BRAND_NAMES, getModels } from "@/lib/catalog"
import { formatPrice } from "@/lib/format"

interface ValuationResult { min: number; avg: number; max: number; factors: { label: string; impact: number; positive: boolean }[] }

export default function ValuationPage() {
  const [make, setMake] = useState("")
  const [model, setModel] = useState("")
  const [year, setYear] = useState(2020)
  const [mileage, setMileage] = useState(50000)
  const [condition, setCondition] = useState("EXCELLENT")
  const [result, setResult] = useState<ValuationResult | null>(null)

  const calc = () => {
    const base = 1800000
    const yearFactor = (year - 2015) * 200000
    const mileageFactor = -Math.min(mileage * 7, 700000)
    const premiumBrands = ["BMW", "Mercedes-Benz", "Audi", "Lexus", "Porsche", "Land Rover"]
    const brandBonus = premiumBrands.includes(make) ? 900000 : ["Lada (ВАЗ)", "УАЗ"].includes(make) ? -300000 : 0
    const condMap: Record<string, number> = { NEW: 500000, LIKE_NEW: 200000, EXCELLENT: 0, GOOD: -150000, FAIR: -400000, POOR: -700000 }
    const condFactor = condMap[condition] || 0

    const avg = Math.max(200000, base + yearFactor + mileageFactor + brandBonus + condFactor)
    const min = Math.round(avg * 0.85)
    const max = Math.round(avg * 1.18)

    setResult({
      min, avg, max,
      factors: [
        { label: `Год (${year})`, impact: yearFactor, positive: yearFactor > 0 },
        { label: `Пробег (${mileage.toLocaleString("ru")} км)`, impact: mileageFactor, positive: false },
        { label: `Марка (${make})`, impact: brandBonus, positive: brandBonus >= 0 },
        { label: `Состояние`, impact: condFactor, positive: condFactor >= 0 },
      ].filter(f => f.impact !== 0),
    })
  }

  return (
    <Box p={{ base: "sm", md: "md" }} style={{ maxWidth: 640, margin: "0 auto" }}>
      <Stack gap="md">
        <Group gap="sm" align="center">
          <ThemeIcon variant="light" color="indigo" size={44} radius="md"><IconCalculator size={22} /></ThemeIcon>
          <Stack gap={0}>
            <Text component="h1" fw={800} fz={22} c="dark.9" ff="var(--font-display),sans-serif">Оценка стоимости авто</Text>
            <Text size="xs" c="gray.5">Рыночная цена за 10 секунд — на основе года, пробега и состояния</Text>
          </Stack>
        </Group>

        <Paper withBorder radius="md" p="lg">
          <Stack gap="md">
            <Select label="Марка" data={Array.from(new Set(BRAND_NAMES)).map((b) => ({ value: b, label: b }))} searchable value={make} onChange={(value) => setMake(value || "")} size="sm" placeholder="Выберите марку" />
            {make && <Select label="Модель" data={getModels(make).map((m) => ({ value: m, label: m }))} searchable value={model} onChange={(value) => setModel(value || "")} size="sm" />}
            <Group grow>
              <NumberInput label="Год выпуска" value={year} onChange={(v) => setYear(Number(v) || 2020)} min={1990} max={2025} size="sm" />
              <NumberInput label="Пробег, км" value={mileage} onChange={(v) => setMileage(Number(v) || 0)} min={0} size="sm" />
            </Group>
            <Select label="Состояние" data={[
              { value: "NEW", label: "Новое" }, { value: "LIKE_NEW", label: "Как новое" },
              { value: "EXCELLENT", label: "Отличное" }, { value: "GOOD", label: "Хорошее" },
              { value: "FAIR", label: "Удовлетворительное" }, { value: "POOR", label: "Требует ремонта" },
            ]} value={condition} onChange={(value) => setCondition(value || "EXCELLENT")} size="sm" />
            <Button onClick={calc} color="indigo" radius="md" size="md" leftSection={<IconCalculator size={18} />} disabled={!make}>Рассчитать стоимость</Button>
          </Stack>
        </Paper>

        {result && (
          <Stack gap="md">
            <Paper radius="md" p="lg" style={{ background: "linear-gradient(135deg, #eef2ff 0%, #fff 100%)", borderColor: "#c7d2fe", borderWidth: 1 }} withBorder>
              <Stack gap="sm" align="center">
                <Text size="xs" c="gray.5" tt="uppercase" fw={600}>Рыночная стоимость</Text>
                <Text size="2.2rem" fw={800} c="#4f46e5" ff="var(--font-display),sans-serif" lh={1}>{formatPrice(result.avg)}</Text>
                <Group gap="xl">
                  <Stack gap={0} align="center">
                    <Group gap={4}><IconTrendingDown size={14} color="#e11d48" /><Text size="xs" c="gray.5">Минимум</Text></Group>
                    <Text fw={700} fz="md" c="#e11d48">{formatPrice(result.min)}</Text>
                  </Stack>
                  <Stack gap={0} align="center">
                    <Group gap={4}><IconTrendingUp size={14} color="#059669" /><Text size="xs" c="gray.5">Максимум</Text></Group>
                    <Text fw={700} fz="md" c="#059669">{formatPrice(result.max)}</Text>
                  </Stack>
                </Group>
              </Stack>
            </Paper>

            <Paper radius="md" p="md" withBorder>
              <Stack gap="xs">
                <Text size="sm" fw={700} c="dark.9">Факторы оценки</Text>
                {result.factors.map((f) => (
                  <Group key={f.label} justify="space-between">
                    <Text size="xs" c="gray.6">{f.label}</Text>
                    <Badge size="sm" color={f.positive ? "green" : "red"} variant="light">
                      {f.positive ? "+" : ""}{(f.impact / 1000).toFixed(0)}к ₽
                    </Badge>
                  </Group>
                ))}
              </Stack>
            </Paper>

            <Group gap="xs" align="center">
              <IconInfoCircle size={14} color="gray.4" />
              <Text size="xs" c="gray.4">Расчёт приблизительный, на основе алгоритма. Для точной оценки нужна диагностика.</Text>
            </Group>
          </Stack>
        )}
      </Stack>
    </Box>
  )
}
