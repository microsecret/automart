"use client"

import { Box, Group, Paper, Text } from "@mantine/core"
import { useState } from "react"

export type BarPoint = {
  /** Подпись под столбцом: час, день, что угодно короткое. */
  label: string
  /** Полная подпись для всплывающей карточки. */
  title?: string
  value: number
  /** Второй ряд — например, просмотры рядом с посетителями. */
  secondary?: number
}

/**
 * Столбчатый график активности.
 *
 * Прежние полоски были высотой в два пикселя и одного бледного цвета:
 * из двадцати четырёх часов различался только пик, а остальное сливалось
 * в серую линию у оси. Владелец смотрит на такой график и не может
 * сказать, тише ли в шесть утра, чем в полночь.
 *
 * Здесь у столбца есть высота, подпись и наведение с точными числами.
 * Пик выделен цветом — он и есть ответ на вопрос «когда запускать
 * рассылку».
 */
export default function TrafficBarChart({
  points,
  valueLabel = "посетителей",
  secondaryLabel = "просмотров",
  height = 132,
}: {
  points: BarPoint[]
  valueLabel?: string
  secondaryLabel?: string
  height?: number
}) {
  const [active, setActive] = useState<number | null>(null)

  /* Оба ряда по одной шкале: просмотров всегда больше, и если считать
     их отдельно, столбцы посетителей вытянутся до той же высоты — на
     графике разница исчезнет, хотя она и есть главный ответ. */
  const max = Math.max(1, ...points.map((point) => Math.max(point.value, point.secondary || 0)))
  const peak = points.reduce((best, point, index) => (point.value > points[best]?.value ? index : best), 0)
  const total = points.reduce((sum, point) => sum + point.value, 0)

  if (total === 0) {
    return (
      <Text size="sm" c="dimmed" ta="center" py="lg">
        За этот период данных нет
      </Text>
    )
  }

  const hasSecondary = points.some((point) => point.secondary != null && point.secondary > point.value)

  return (
    <Box style={{ position: "relative" }}>
      {/* Легенда только когда рядов правда два: у графика по часам
          второго нет, и подпись про просмотры сбивала бы с толку. */}
      {hasSecondary && (
        <Group gap="md" mb="xs">
          <Group gap={5} wrap="nowrap">
            <Box style={{ width: 9, height: 9, borderRadius: 2, background: "var(--mantine-color-indigo-5)" }} />
            <Text size="10px" c="dimmed">{valueLabel}</Text>
          </Group>
          <Group gap={5} wrap="nowrap">
            <Box style={{ width: 9, height: 9, borderRadius: 2, background: "var(--mantine-color-indigo-1)" }} />
            <Text size="10px" c="dimmed">{secondaryLabel}</Text>
          </Group>
        </Group>
      )}
      <Group gap={3} align="flex-end" wrap="nowrap" style={{ height, overflow: "hidden" }}>
        {points.map((point, index) => {
          /* Минимальная высота у ненулевого столбца: единственный визит в
             три часа ночи должен быть виден, иначе график врёт, будто
             активности не было вовсе. */
          const ratio = point.value / max
          const barHeight = point.value === 0 ? 2 : Math.max(6, Math.round(ratio * height))
          const isPeak = index === peak && point.value > 0
          const isActive = active === index

          return (
            <Box
              key={`${point.label}-${index}`}
              style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "flex-end", height: "100%" }}
              onMouseEnter={() => setActive(index)}
              onMouseLeave={() => setActive(null)}
            >
              {/* Просмотры бледной подложкой, посетители плотным столбцом
                  поверх: видно и объём, и сколько за ним живых людей.
                  Раздельные графики заставляли сравнивать глазами два
                  разных масштаба. */}
              <Box style={{ position: "relative", width: "100%", height: "100%", display: "flex", alignItems: "flex-end" }}>
                {point.secondary != null && point.secondary > point.value && (
                  <Box
                    style={{
                      position: "absolute",
                      bottom: 0,
                      width: "100%",
                      height: Math.max(6, Math.round((point.secondary / max) * height)),
                      borderRadius: "4px 4px 2px 2px",
                      background: "var(--mantine-color-indigo-1)",
                      transition: "height var(--ease-slow) var(--ease-out)",
                    }}
                  />
                )}
                <Box
                  style={{
                    position: "relative",
                    width: "100%",
                    height: barHeight,
                    borderRadius: "4px 4px 2px 2px",
                    background: point.value === 0
                      ? "var(--mantine-color-gray-3)"
                      : isPeak || isActive
                        ? "var(--mantine-color-indigo-6)"
                        : "var(--mantine-color-indigo-4)",
                    transition: "background var(--ease-fast) var(--ease-out), height var(--ease-slow) var(--ease-out)",
                  }}
                />
              </Box>
            </Box>
          )
        })}
      </Group>

      {/* Подписи под столбцами: каждая третья, иначе они наезжают друг на
          друга и превращаются в серую полосу. */}
      <Group gap={3} wrap="nowrap" mt={6}>
        {points.map((point, index) => (
          <Box key={`label-${point.label}-${index}`} style={{ flex: 1, minWidth: 0, textAlign: "center" }}>
            <Text size="10px" c={index === peak ? "indigo" : "dimmed"} fw={index === peak ? 700 : 400}>
              {points.length > 16 && index % 3 !== 0 && index !== peak ? "" : point.label}
            </Text>
          </Box>
        ))}
      </Group>

      {active !== null && points[active] && (
        <Paper
          withBorder
          radius="md"
          p={8}
          shadow="md"
          style={{
            position: "absolute",
            top: -6,
            left: `${Math.min(78, (active / Math.max(1, points.length - 1)) * 100)}%`,
            pointerEvents: "none",
            zIndex: 3,
          }}
        >
          <Text size="xs" fw={700}>{points[active].title || points[active].label}</Text>
          <Text size="xs" c="dimmed">{points[active].value} {valueLabel}</Text>
          {points[active].secondary != null && (
            <Text size="xs" c="dimmed">{points[active].secondary} {secondaryLabel}</Text>
          )}
        </Paper>
      )}
    </Box>
  )
}
