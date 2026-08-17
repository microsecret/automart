"use client"

import { useState } from "react"
import { Badge, Box, Button, Group, NumberInput, Paper, Select, Stack, Text, ThemeIcon } from "@mantine/core"
import { IconCheck, IconCoin, IconUsers } from "@tabler/icons-react"
import { FUEL_REPORT_LABELS, FUEL_REPORT_TYPES, formatReportedPrice } from "@/lib/fuel-price-reports"

export type ConsensusPrice = {
  fuel: string
  label: string
  priceKopecks: number
  confirmations: number
  updatedAt: string
}

const FUEL_OPTIONS = FUEL_REPORT_TYPES.map((fuel) => ({ value: fuel, label: FUEL_REPORT_LABELS[fuel] }))

function formatUpdatedAt(value: string) {
  const updated = new Date(value)
  if (Number.isNaN(updated.getTime())) return null
  const hours = Math.round((Date.now() - updated.getTime()) / (60 * 60 * 1_000))
  if (hours < 1) return "только что"
  if (hours < 24) return `${hours} ч назад`
  const days = Math.round(hours / 24)
  return days === 1 ? "вчера" : `${days} дн назад`
}

/**
 * Позволяет водителю отметить цену на конкретной АЗС.
 *
 * Открытые картографические данные не содержат цен, а розничные API сетей
 * платные, поэтому цену на карте формируют сами пользователи. Показывается
 * согласованное значение и число подтверждений, чтобы читатель видел, на
 * сколько отметок опирается цифра.
 */
export default function FuelPriceReporter({ stationId, latitude, longitude, prices, onReported }: {
  stationId: string
  latitude: number
  longitude: number
  prices: ConsensusPrice[]
  onReported?: (prices: ConsensusPrice[]) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [fuel, setFuel] = useState<string | null>(FUEL_REPORT_TYPES[1])
  const [price, setPrice] = useState<string | number>("")
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle")
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!fuel || price === "" || status === "saving") return
    setStatus("saving")
    setError(null)
    try {
      const response = await fetch("/api/fuel-prices", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ stationId, latitude, longitude, fuel, price }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        setError(typeof payload?.error === "string" ? payload.error : "Не удалось сохранить отметку")
        setStatus("idle")
        return
      }
      if (Array.isArray(payload?.prices)) onReported?.(payload.prices)
      setStatus("saved")
      setPrice("")
      setTimeout(() => { setStatus("idle"); setIsOpen(false) }, 1_600)
    } catch {
      setError("Нет связи с сервером. Попробуйте ещё раз.")
      setStatus("idle")
    }
  }

  return (
    <Paper radius="md" p="sm" withBorder style={{ background: "var(--market-surface-subtle)" }}>
      <Group justify="space-between" gap="xs" wrap="wrap" mb={prices.length ? 8 : 0}>
        <Group gap={6}>
          <ThemeIcon size="sm" radius="xl" color="indigo" variant="light"><IconCoin size={13} /></ThemeIcon>
          <Text size="sm" fw={700}>Цены от водителей</Text>
        </Group>
        <Button
          size="compact-xs"
          variant={isOpen ? "subtle" : "light"}
          color="indigo"
          onClick={() => { setIsOpen((open) => !open); setError(null) }}
        >
          {isOpen ? "Отмена" : "Отметить цену"}
        </Button>
      </Group>

      {prices.length ? (
        <Group gap={6} wrap="wrap">
          {prices.map((entry) => {
            const updated = formatUpdatedAt(entry.updatedAt)
            return (
              <Badge
                key={entry.fuel}
                size="sm"
                variant="light"
                color="teal"
                leftSection={<IconUsers size={11} />}
                title={`${entry.confirmations} подтверждени${entry.confirmations === 1 ? "е" : entry.confirmations < 5 ? "я" : "й"}${updated ? `, обновлено ${updated}` : ""}`}
              >
                {entry.label} · {formatReportedPrice(entry.priceKopecks)} ₽ · {entry.confirmations}
              </Badge>
            )
          })}
        </Group>
      ) : !isOpen ? (
        <Text size="xs" c="dimmed">Цен пока никто не отмечал. Заправились здесь — подскажите цену другим водителям.</Text>
      ) : null}

      {isOpen && (
        <Stack gap="xs" mt="xs">
          <Group gap="xs" align="flex-end" wrap="nowrap">
            <Select
              size="xs"
              label="Топливо"
              data={FUEL_OPTIONS}
              value={fuel}
              onChange={setFuel}
              allowDeselect={false}
              style={{ flex: "0 0 108px" }}
            />
            <NumberInput
              size="xs"
              label="Цена, ₽/л"
              placeholder="58,40"
              value={price}
              onChange={setPrice}
              min={10}
              max={300}
              decimalScale={2}
              decimalSeparator=","
              style={{ flex: 1 }}
            />
            <Button
              size="xs"
              color="indigo"
              onClick={submit}
              loading={status === "saving"}
              disabled={!fuel || price === ""}
              leftSection={status === "saved" ? <IconCheck size={14} /> : undefined}
            >
              {status === "saved" ? "Спасибо" : "Сохранить"}
            </Button>
          </Group>
          {error && <Text size="xs" c="red.7">{error}</Text>}
          <Box>
            <Text size="10px" c="dimmed">
              Отметка публикуется как мнение водителя: карта показывает согласованную цену по нескольким отметкам, а не оферту АЗС.
            </Text>
          </Box>
        </Stack>
      )}
    </Paper>
  )
}
