"use client"

import { useState } from "react"
import { Badge, Box, Button, Group, Paper, Stack, Text, UnstyledButton } from "@mantine/core"
import { IconCurrentLocation, IconMapPin } from "@tabler/icons-react"
import { AVAILABILITY_FUEL_LABELS, formatAge, type AvailabilityFuel } from "@/lib/fuel-availability"
import { formatDistance, sortByFuelAndDistance, type NearbyStation } from "@/lib/fuel-nearby"

/**
 * «Куда ехать за 92-м прямо сейчас».
 *
 * Карта отвечает на вопрос «что вокруг», а человеку за рулём нужен
 * другой. Разглядывать метки в движении неудобно и небезопасно — нужен
 * список, где первая строка и есть ответ.
 *
 * Положение спрашивается только по нажатию. Запрос при открытии страницы
 * даёт окно браузера раньше, чем человек понял, зачем оно, — и половина
 * отказывает не глядя, после чего вернуть разрешение можно только в
 * настройках.
 */
export default function FuelNearbyList({
  stations,
  availabilityByStation,
  onSelect,
  fallbackOrigin,
}: {
  stations: NearbyStation[]
  availabilityByStation: Record<string, Array<{ fuel: string; state: string; updatedAt: string | null }>>
  onSelect?: (stationId: string) => void
  /* Центр карты: от него считаем расстояния, если положение недоступно.
     Список без положения бесполезнее, чем с приблизительным. */
  fallbackOrigin?: { latitude: number; longitude: number }
}) {
  const [origin, setOrigin] = useState<{ latitude: number; longitude: number } | null>(null)
  const [fuel, setFuel] = useState<AvailabilityFuel>("AI92")
  const [asking, setAsking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const locate = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("Браузер не умеет определять положение. Показываем заправки в центре карты.")
      if (fallbackOrigin) setOrigin(fallbackOrigin)
      return
    }

    setAsking(true)
    setError(null)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setOrigin({ latitude: position.coords.latitude, longitude: position.coords.longitude })
        setAsking(false)
      },
      (failure) => {
        /* Причина отказа разная, и совет должен быть разный.

           Общее «не удалось определить положение» ничего не объясняло:
           человек не знал, отказал ли он сам, слаб ли сигнал или дело в
           браузере. И главное — список после этого не работал вовсе,
           хотя показать ближайшие к центру карты можно и без спутника. */
        const reason = failure?.code === 1
          ? "Доступ к положению запрещён. Разрешите его в настройках браузера — или смотрите заправки в центре карты."
          : failure?.code === 3
          ? "Спутники не отвечают. Под крышей это обычное дело — попробуйте на улице или смотрите заправки в центре карты."
          : "Положение определить не вышло. Показываем заправки в центре карты."

        setError(reason)
        setAsking(false)

        /* Запасной путь: считаем от центра карты. Список без положения
           бесполезнее, чем с приблизительным, — человек всё равно видит,
           где топливо есть, и сам понимает, далеко ли. */
        if (fallbackOrigin) setOrigin(fallbackOrigin)
      },
      { timeout: 10_000, maximumAge: 60_000 },
    )
  }

  if (!origin) {
    return (
      <Paper withBorder radius="md" p="sm">
        <Stack gap="xs">
          <Text size="sm" fw={600}>Куда ехать за топливом</Text>
          <Text size="xs" c="dimmed">
            Покажем ближайшие заправки, где топливо есть по свежим отметкам водителей.
          </Text>
          <Button
            size="sm"
            radius="md"
            color="indigo"
            variant="light"
            leftSection={<IconCurrentLocation size={16} />}
            loading={asking}
            onClick={locate}
          >
            Найти рядом со мной
          </Button>
          {error && <Text size="xs" c="red.6">{error}</Text>}
        </Stack>
      </Paper>
    )
  }

  const rows = sortByFuelAndDistance(stations, origin, availabilityByStation, fuel).slice(0, 8)
  const withFuel = rows.filter((row) => row.hasFuel)

  return (
    <Paper withBorder radius="md" p="sm">
      <Stack gap="xs">
        <Group justify="space-between" align="center">
          <Text size="sm" fw={600}>Куда ехать за топливом</Text>
          <Button size="compact-xs" variant="subtle" color="gray" onClick={() => setOrigin(null)}>
            Сбросить
          </Button>
        </Group>

        {/* Марка переключается здесь же: человек с дизелем не должен
            искать другой раздел. */}
        <Group gap={6}>
          {(["AI92", "AI95", "DT"] as AvailabilityFuel[]).map((item) => (
            <Button
              key={item}
              size="compact-xs"
              radius="md"
              variant={fuel === item ? "filled" : "default"}
              color="indigo"
              onClick={() => setFuel(item)}
            >
              {AVAILABILITY_FUEL_LABELS[item]}
            </Button>
          ))}
        </Group>

        {withFuel.length === 0 && (
          /* Честно: отметок нет — не значит, что топлива нет. Обещать
             обратное хуже, чем признать незнание. */
          <Text size="xs" c="dimmed">
            Свежих отметок с {AVAILABILITY_FUEL_LABELS[fuel]} рядом нет. Ниже — ближайшие заправки;
            отметьте наличие, если заедете, — это поможет остальным.
          </Text>
        )}

        <Stack gap={4}>
          {rows.map((row) => (
            <UnstyledButton
              key={row.station.id}
              onClick={() => onSelect?.(row.station.id)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                padding: "8px 10px",
                borderRadius: 10,
                border: `1px solid ${row.hasFuel ? "var(--mantine-color-teal-3)" : "var(--market-line)"}`,
                background: row.hasFuel ? "var(--mantine-color-teal-0)" : "var(--market-surface-subtle)",
                textAlign: "left",
              }}
            >
              <Box style={{ minWidth: 0 }}>
                <Text size="sm" fw={600} lineClamp={1}>{row.station.name}</Text>
                <Text size="xs" c="dimmed">
                  {formatDistance(row.km)}
                  {row.updatedAt ? ` · ${formatAge(new Date(row.updatedAt))}` : " · не отмечали"}
                </Text>
              </Box>
              <Badge
                size="sm"
                variant="light"
                color={row.hasFuel ? "teal" : row.updatedAt ? "red" : "gray"}
              >
                {row.hasFuel ? "есть" : row.updatedAt ? "нет" : "?"}
              </Badge>
            </UnstyledButton>
          ))}
        </Stack>

        <Group gap={4} align="center">
          <IconMapPin size={12} color="var(--mantine-color-dimmed)" />
          <Text size="xs" c="dimmed">Расстояние по прямой. Маршрут проложит навигатор.</Text>
        </Group>
      </Stack>
    </Paper>
  )
}
