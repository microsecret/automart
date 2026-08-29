"use client"

import { useState } from "react"
import { Badge, Box, Button, Group, Paper, Stack, Text, UnstyledButton } from "@mantine/core"
import { IconCheck, IconX } from "@tabler/icons-react"
import {
  AVAILABILITY_FUELS,
  AVAILABILITY_FUEL_LABELS,
  QUEUE_LABELS,
  formatAge,
  type AvailabilityFuel,
  type QueueLevel,
} from "@/lib/fuel-availability"

export type StationAvailability = {
  fuel: AvailabilityFuel
  label: string
  state: "YES" | "NO" | "UNKNOWN"
  confirmations: number
  updatedAt: string | null
  queue: QueueLevel | null
}

/**
 * Отметка наличия топлива на АЗС.
 *
 * Главное здесь — скорость. Человек стоит у колонки с телефоном в руке и
 * отмечает по дороге: если это дольше двух нажатий, он не отметит вовсе,
 * а без отметок карта мертва.
 *
 * Поэтому сетка марок сразу видна, а нажатие на марку открывает только
 * «есть» и «нет». Очередь — необязательное уточнение после «есть», и её
 * пропуск ничего не ломает.
 */
export default function FuelAvailabilityReporter({
  stationId,
  latitude,
  longitude,
  availability,
  onReported,
}: {
  stationId: string
  latitude: number
  longitude: number
  availability: StationAvailability[]
  onReported?: (next: StationAvailability[]) => void
}) {
  const [openFuel, setOpenFuel] = useState<AvailabilityFuel | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedFuel, setSavedFuel] = useState<AvailabilityFuel | null>(null)

  const byFuel = new Map(availability.map((item) => [item.fuel, item]))

  const send = async (fuel: AvailabilityFuel, state: "YES" | "NO", queue: QueueLevel | null) => {
    setSending(true)
    setError(null)
    try {
      const response = await fetch("/api/fuel-availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stationId, latitude, longitude, fuel, state, queue }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || "Не удалось отправить отметку")

      onReported?.(payload.availability || [])
      setOpenFuel(null)
      /* Отметка держится на виду недолго: человек уже уехал, и подтверждение
         нужно ровно на то, чтобы он понял — засчитано. */
      setSavedFuel(fuel)
      window.setTimeout(() => setSavedFuel(null), 2000)
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Не удалось отправить отметку")
    } finally {
      setSending(false)
    }
  }

  return (
    <Stack gap="xs">
      <Group justify="space-between" align="baseline">
        <Text size="sm" fw={600}>Есть ли топливо</Text>
        <Text size="xs" c="dimmed">по отметкам водителей</Text>
      </Group>

      {/* Марки сеткой: человек ищет свою глазами, а не в выпадающем списке.
          Цвет несёт состояние, но не в одиночку — рядом стоит подпись
          «есть»/«нет», иначе карта нечитаема при дальтонизме. */}
      <Box style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
        {AVAILABILITY_FUELS.map((fuel) => {
          const known = byFuel.get(fuel)
          const state = known?.state ?? "UNKNOWN"
          const age = known?.updatedAt ? formatAge(new Date(known.updatedAt)) : null
          const isOpen = openFuel === fuel
          const justSaved = savedFuel === fuel

          return (
            <UnstyledButton
              key={fuel}
              onClick={() => setOpenFuel(isOpen ? null : fuel)}
              disabled={sending}
              aria-label={`Отметить наличие ${AVAILABILITY_FUEL_LABELS[fuel]}`}
              aria-expanded={isOpen}
              style={{
                padding: "8px 6px",
                borderRadius: 10,
                border: `1px solid ${
                  isOpen ? "var(--mantine-color-indigo-5)"
                  : state === "YES" ? "var(--mantine-color-teal-4)"
                  : state === "NO" ? "var(--mantine-color-red-4)"
                  : "var(--market-line)"
                }`,
                background: state === "YES" ? "var(--mantine-color-teal-0)"
                  : state === "NO" ? "var(--mantine-color-red-0)"
                  : "var(--market-surface-subtle)",
                textAlign: "center",
                cursor: "pointer",
                transition: "border-color 170ms cubic-bezier(0.25, 1, 0.5, 1)",
              }}
            >
              <Text fw={700} fz={15} lh={1.1}>{AVAILABILITY_FUEL_LABELS[fuel]}</Text>
              <Text fz={10} c={state === "YES" ? "teal.7" : state === "NO" ? "red.7" : "dimmed"} lh={1.3}>
                {justSaved ? "записано" : state === "YES" ? "есть" : state === "NO" ? "нет" : "не отмечали"}
              </Text>
              {/* Возраст отметки — половина ответа: по свежести человек сам
                  решает, верить ли. */}
              {age && !justSaved && <Text fz={9} c="dimmed" lh={1.2}>{age}</Text>}
            </UnstyledButton>
          )
        })}
      </Box>

      {openFuel && (
        <Paper withBorder radius="md" p="xs" bg="var(--market-surface-subtle)">
          <Stack gap={8}>
            <Text size="xs" c="dimmed">
              {AVAILABILITY_FUEL_LABELS[openFuel]} — что на заправке сейчас?
            </Text>
            <Group grow gap={6}>
              <Button
                size="sm"
                radius="md"
                color="teal"
                leftSection={<IconCheck size={16} />}
                loading={sending}
                onClick={() => void send(openFuel, "YES", null)}
              >
                Есть
              </Button>
              <Button
                size="sm"
                radius="md"
                color="red"
                variant="light"
                leftSection={<IconX size={16} />}
                loading={sending}
                onClick={() => void send(openFuel, "NO", null)}
              >
                Нет
              </Button>
            </Group>

            {/* Очередь — необязательное уточнение: человек, которому некогда,
                просто нажмёт «есть» и уедет. */}
            <Text size="xs" c="dimmed">Есть и очередь:</Text>
            <Group grow gap={6}>
              {(["SMALL", "BIG"] as QueueLevel[]).map((queue) => (
                <Button
                  key={queue}
                  size="xs"
                  radius="md"
                  variant="default"
                  loading={sending}
                  onClick={() => void send(openFuel, "YES", queue)}
                >
                  {QUEUE_LABELS[queue]}
                </Button>
              ))}
            </Group>

            {error && <Text size="xs" c="red.6">{error}</Text>}
          </Stack>
        </Paper>
      )}

      {/* Очередь и число подтверждений — там, где они есть: пустые строки
          «подтверждений: 0» только зашумляют карточку. */}
      {availability.some((item) => item.confirmations > 1 || item.queue) && (
        <Group gap={6} wrap="wrap">
          {availability
            .filter((item) => item.confirmations > 1 || item.queue)
            .map((item) => (
              <Badge
                key={item.fuel}
                size="sm"
                radius="sm"
                variant="light"
                color={item.state === "YES" ? "teal" : "red"}
              >
                {item.label}
                {item.queue ? ` · ${QUEUE_LABELS[item.queue]}` : ""}
                {item.confirmations > 1 ? ` · ${item.confirmations}` : ""}
              </Badge>
            ))}
        </Group>
      )}
    </Stack>
  )
}
