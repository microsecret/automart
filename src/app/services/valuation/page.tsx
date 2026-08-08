"use client"
export const dynamic = "force-dynamic"
import { useState } from "react"
import { Box, Stack, Title, Text, Card, TextInput, NumberInput, Button, Select, Group, ThemeIcon, Divider, Alert } from "@mantine/core"
import { IconCalculator, IconCar, IconCheck } from "@tabler/icons-react"
import { BRAND_NAMES, getModels } from "@/lib/catalog"
import { formatPrice } from "@/lib/format"

export default function ValuationPage() {
  const [make, setMake] = useState("")
  const [model, setModel] = useState("")
  const [year, setYear] = useState(2020)
  const [mileage, setMileage] = useState(50000)
  const [result, setResult] = useState<number | null>(null)

  const calc = () => {
    const base = 2000000
    const yearFactor = (year - 2010) * 150000
    const mileageFactor = -Math.min(mileage * 8, 800000)
    const brandBonus = ["BMW", "Mercedes-Benz", "Audi", "Lexus", "Porsche"].includes(make) ? 800000 : 0
    setResult(Math.max(300000, base + yearFactor + mileageFactor + brandBonus))
  }

  return (
    <Box p={{ base: "sm", md: "md" }} style={{ maxWidth: 600, margin: "0 auto" }}>
      <Stack gap="md">
        <Group gap="sm" align="center">
          <ThemeIcon variant="light" color="indigo" size={44} radius="md"><IconCalculator size={22} /></ThemeIcon>
          <Stack gap={0}>
            <Title order={2} size="h3" ff="var(--font-display),sans-serif">Оценка стоимости</Title>
            <Text size="xs" c="#71717a">Узнайте рыночную цену вашего авто за 10 секунд</Text>
          </Stack>
        </Group>

        <Card withBorder radius="md" p="lg" style={{ borderColor: "#f4f4f5" }}>
          <Stack gap="md">
            <Select label="Марка" data={Array.from(new Set(BRAND_NAMES)).map((b) => ({ value: b, label: b }))} searchable value={make} onChange={setMake} size="sm" />
            {make && <Select label="Модель" data={getModels(make).map((m) => ({ value: m, label: m }))} searchable value={model} onChange={setModel} size="sm" />}
            <Group grow>
              <NumberInput label="Год выпуска" value={year} onChange={(v) => setYear(Number(v) || 2020)} min={1990} max={2025} size="sm" />
              <NumberInput label="Пробег, км" value={mileage} onChange={(v) => setMileage(Number(v) || 0)} min={0} size="sm" />
            </Group>
            <Button onClick={calc} color="indigo" radius="md" leftSection={<IconCalculator size={18} />}>Рассчитать</Button>
          </Stack>
        </Card>

        {result != null && (
          <Card withBorder radius="md" p="lg" style={{ borderColor: "#c7d2fe", background: "linear-gradient(135deg, #fff 0%, #eef2ff 100%)" }}>
            <Stack gap="xs" align="center">
              <Text size="xs" c="#71717a">Оценочная стоимость</Text>
              <Text size="2rem" fw={800} c="#18181b" ff="var(--font-display),sans-serif">{formatPrice(result)}</Text>
              <Text size="xs" c="#a1a1aa">Демонстрационный расчёт. В продакшене — анализ реальных сделок.</Text>
            </Stack>
          </Card>
        )}
      </Stack>
    </Box>
  )
}
