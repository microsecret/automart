"use client"

import { useEffect, useRef, useState } from "react"
import { Box, Button, Group, NumberInput, Paper, Select, Stack, Text, ThemeIcon, UnstyledButton } from "@mantine/core"
import { IconCheck, IconCoin } from "@tabler/icons-react"
import { FUEL_REPORT_LABELS, FUEL_REPORT_TYPES, formatReportedPrice } from "@/lib/fuel-price-reports"

export type ConsensusPrice = {
  fuel: string
  label: string
  priceKopecks: number
  confirmations: number
  updatedAt: string
  /* Насколько крепкая цена: считается теми же правилами, что и наличие
     — свежесть отметок, их число и согласие между ними. */
  confidencePercent: number
  confidenceLabel: "высокая" | "средняя" | "низкая"
  /** «2 метки за 3 ч» — из чего сложилось число. */
  confidenceNote: string
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

  // Подтверждение «Сохранено» гасится через 1,6 с. Водитель за это время часто
  // успевает закрыть карточку АЗС или выбрать другую точку: тогда таймер
  // срабатывал уже по снятому компоненту и React ругался на обновление
  // состояния размонтированного узла, а при повторном открытии формы карточка
  // могла схлопнуться сама. Держим ссылку на таймер и снимаем его при уходе.
  const resetTimer = useRef<number | null>(null)

  useEffect(() => () => {
    if (resetTimer.current !== null) window.clearTimeout(resetTimer.current)
  }, [])

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
      if (resetTimer.current !== null) window.clearTimeout(resetTimer.current)
      resetTimer.current = window.setTimeout(() => {
        resetTimer.current = null
        setStatus("idle")
        setIsOpen(false)
      }, 1_600)
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
        /* Цены строками со шкалой уверенности, а не бейджами.

           Бейдж «АИ-92 · 63,70 ₽ · 1» показывал цену как факт: за ней
           могла стоять одна отметка пятичасовой давности, и человек ехал
           платить на три рубля больше. Число подтверждений стояло рядом,
           но читалось как порядковый номер, а не как надёжность.

           Шкала отвечает на это прямо: чем крепче сведения, тем длиннее
           полоса. Цена по-прежнему нажимается — открывает форму с этой
           маркой, чтобы устаревшую можно было поправить. */
        <Stack gap={4}>
          {prices.map((entry) => {
            const updated = formatUpdatedAt(entry.updatedAt)
            return (
              <UnstyledButton
                key={entry.fuel}
                className="fuel-price-row"
                onClick={() => {
                  setFuel(entry.fuel)
                  setPrice((entry.priceKopecks / 100).toFixed(2).replace(".", ","))
                  setIsOpen(true)
                }}
                aria-label={`Поправить цену ${entry.label}, сейчас ${formatReportedPrice(entry.priceKopecks)} рублей, уверенность ${entry.confidencePercent}%`}
              >
                <span className="fuel-price-row__fuel">{entry.label}</span>
                <span className="fuel-price-row__value">{formatReportedPrice(entry.priceKopecks)} ₽</span>
                <span className="fuel-price-row__meter" data-level={entry.confidenceLabel} aria-hidden="true">
                  <span style={{ width: `${Math.max(6, entry.confidencePercent)}%` }} />
                </span>
                <span className="fuel-price-row__note">
                  {entry.confidenceNote}{updated ? ` · ${updated}` : ""}
                </span>
              </UnstyledButton>
            )
          })}
        </Stack>
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
