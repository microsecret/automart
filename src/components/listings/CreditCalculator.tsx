"use client"

import { useState, useMemo } from "react"
import { Card, Stack, Group, Text, Slider, Select, Box, Divider } from "@mantine/core"
import { IconCalculator } from "@tabler/icons-react"
import { formatPrice } from "@/lib/format"

export default function CreditCalculator({ price }: { price: number }) {
  const [downPayment, setDownPayment] = useState(Math.round(price * 0.2))
  const [term, setTerm] = useState(36)
  const [rate, setRate] = useState(14.9)

  const { monthlyPayment, totalLoan, totalCost } = useMemo(() => {
    const loan = Math.max(0, price - downPayment)
    const monthlyRate = rate / 100 / 12
    const n = term
    const monthly =
      monthlyRate === 0
        ? loan / n
        : (loan * monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1)
    return {
      monthlyPayment: Math.round(monthly),
      totalLoan: loan,
      totalCost: Math.round(monthly * n + downPayment),
    }
  }, [price, downPayment, term, rate])

  return (
    <Card withBorder radius="md" p="md" style={{ borderColor: "var(--mantine-color-border)" }}>
      <Stack gap="sm">
        <Group gap="sm" align="center">
          <IconCalculator size={18} color="#4f46e5" />
          <Text size="sm" fw={600} c="dark.9">Кредитный калькулятор</Text>
        </Group>

        {/* Сумма кредита */}
        <Box>
          <Text size="xs" c="gray.5" mb={4}>Первоначальный взнос</Text>
          <Text size="md" fw={700} c="dark.9" mb={6}>{formatPrice(downPayment)}</Text>
          <Slider
            value={downPayment}
            onChange={setDownPayment}
            min={0}
            max={price}
            step={10000}
            size="sm"
            color="indigo"
            label={null}
          />
        </Box>

        {/* Срок */}
        <Box>
          <Text size="xs" c="gray.5" mb={4}>Срок кредита</Text>
          <Text size="md" fw={700} c="dark.9" mb={6}>{term} мес ({Math.round(term / 12 * 10) / 10} лет)</Text>
          <Slider
            value={term}
            onChange={setTerm}
            min={12}
            max={84}
            step={12}
            size="sm"
            color="indigo"
            marks={[
              { value: 12, label: "1г" },
              { value: 36, label: "3г" },
              { value: 60, label: "5л" },
              { value: 84, label: "7л" },
            ]}
          />
        </Box>

        {/* Ставка */}
        <Select
          label="Ставка"
          data={[
            { value: "9.9", label: "9.9% — спецпредложение" },
            { value: "12.9", label: "12.9% — стандартная" },
            { value: "14.9", label: "14.9% — базовая" },
            { value: "19.9", label: "19.9% — б/у авто" },
          ]}
          value={String(rate)}
          onChange={(v) => setRate(Number(v) || 14.9)}
          size="xs"
          radius="md"
        />

        <Divider color="#f4f4f5" />

        {/* Результат */}
        <Group justify="space-between" align="center">
          <Stack gap={0}>
            <Text size="xs" c="gray.5">Ежемесячный платёж</Text>
            <Text size="xl" fw={800} c="#4f46e5" ff="var(--font-display),sans-serif">{formatPrice(monthlyPayment)}</Text>
          </Stack>
          <Stack gap={0} align="flex-end">
            <Text size="xs" c="gray.5">Сумма кредита</Text>
            <Text size="sm" fw={600} c="dark.9">{formatPrice(totalLoan)}</Text>
            <Text size="xs" c="gray.5">Всего с первым взносом: {formatPrice(totalCost)}</Text>
          </Stack>
        </Group>

        <Text size="10px" c="gray.4">Расчёт предварительный. Точные условия определяет банк.</Text>
      </Stack>
    </Card>
  )
}
