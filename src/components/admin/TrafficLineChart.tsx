"use client"

import { Badge, Box, Group, Paper, Text } from "@mantine/core"
import { useState } from "react"

export type TrafficChartPoint = {
  date: string
  pageViews: number
  uniqueVisitors: number
  registrations: number
  newListings: number
}

type ChartCoordinate = { x: number; y: number }

const SERIES = [
  { key: "pageViews", label: "Просмотры страниц", color: "var(--mantine-color-indigo-6)", badgeColor: "indigo" },
  { key: "uniqueVisitors", label: "Уникальные посетители", color: "var(--mantine-color-cyan-6)", badgeColor: "cyan" },
  { key: "registrations", label: "Регистрации", color: "var(--mantine-color-teal-6)", badgeColor: "teal" },
  { key: "newListings", label: "Новые объявления", color: "var(--mantine-color-violet-7)", badgeColor: "violet" },
] as const

function curvedLinePath(points: ChartCoordinate[]) {
  if (!points.length) return ""
  return points.slice(1).reduce((path, point, index) => {
    const previous = points[index]
    const middleX = (previous.x + point.x) / 2
    return `${path} C ${middleX} ${previous.y}, ${middleX} ${point.y}, ${point.x} ${point.y}`
  }, `M ${points[0].x} ${points[0].y}`)
}

export default function TrafficLineChart({ points }: { points: TrafficChartPoint[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const width = 760
  const height = 210
  const padding = { top: 14, right: 18, bottom: 34, left: 42 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom
  /* Каждый ряд по своей шкале.

     Раньше шкала была общая, и это делало график бесполезным: просмотров
     сотни, регистраций единицы — три ряда из четырёх ложились прямой
     линией у нуля, будто их вовсе нет. Владелец видел только просмотры и
     не мог сказать, растут ли регистрации.

     Теперь каждая линия занимает всю высоту по своему максимуму: видно
     форму каждой. Абсолютные числа читаются наведением, а сравнивать
     ряды между собой по высоте всё равно было нельзя — величины
     несопоставимы. */
  const maxima = Object.fromEntries(
    SERIES.map(({ key }) => [key, Math.max(1, ...points.map((point) => point[key]))]),
  ) as Record<(typeof SERIES)[number]["key"], number>

  const maximum = maxima.pageViews
  const x = (index: number) => padding.left + (points.length > 1 ? (index / (points.length - 1)) * chartWidth : chartWidth / 2)
  const y = (value: number, key: (typeof SERIES)[number]["key"] = "pageViews") =>
    padding.top + chartHeight - (value / maxima[key]) * chartHeight
  const pageViewPoints = points.map((point, index) => ({ x: x(index), y: y(point.pageViews, "pageViews") }))
  const visitorPoints = points.map((point, index) => ({ x: x(index), y: y(point.uniqueVisitors, "uniqueVisitors") }))
  const registrationPoints = points.map((point, index) => ({ x: x(index), y: y(point.registrations, "registrations") }))
  const listingPoints = points.map((point, index) => ({ x: x(index), y: y(point.newListings, "newListings") }))
  const pageViewPath = curvedLinePath(pageViewPoints)
  const visitorPath = curvedLinePath(visitorPoints)
  const registrationPath = curvedLinePath(registrationPoints)
  const listingPath = curvedLinePath(listingPoints)
  const areaPath = pageViewPoints.length ? `${pageViewPath} L ${pageViewPoints.at(-1)?.x} ${padding.top + chartHeight} L ${pageViewPoints[0].x} ${padding.top + chartHeight} Z` : ""
  const activePoint = activeIndex === null ? null : points[activeIndex]
  const activeX = activeIndex === null ? 0 : x(activeIndex)
  const interactionWidth = points.length > 1 ? chartWidth / (points.length - 1) : chartWidth
  const tooltipPosition = activeIndex === 0
    ? { left: 8 }
    : activeIndex === points.length - 1
      ? { right: 8 }
      : { left: `${(activeX / width) * 100}%`, transform: "translateX(-50%)" }

  return (
    <Box className="admin-traffic-chart">
      <Box className="admin-traffic-chart__plot">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Интерактивный график просмотров, уникальных посетителей, регистраций и новых объявлений за семь дней" preserveAspectRatio="xMidYMid meet" onPointerLeave={() => setActiveIndex(null)}>
          <defs>
            <linearGradient id="admin-page-view-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--mantine-color-indigo-6)" stopOpacity="0.24" />
              <stop offset="100%" stopColor="var(--mantine-color-indigo-6)" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const gridY = padding.top + chartHeight * ratio
            return <line key={ratio} x1={padding.left} x2={width - padding.right} y1={gridY} y2={gridY} stroke="var(--mantine-color-default-border)" strokeWidth="1" />
          })}
          {areaPath && <path d={areaPath} fill="url(#admin-page-view-area)" />}
          {pageViewPath && <path d={pageViewPath} fill="none" stroke={SERIES[0].color} strokeWidth="4" strokeLinecap="round" />}
          {visitorPath && <path d={visitorPath} fill="none" stroke={SERIES[1].color} strokeWidth="3" strokeLinecap="round" strokeDasharray="8 5" />}
          {registrationPath && <path d={registrationPath} fill="none" stroke={SERIES[2].color} strokeWidth="2.5" strokeLinecap="round" />}
          {listingPath && <path d={listingPath} fill="none" stroke={SERIES[3].color} strokeWidth="2.5" strokeLinecap="round" strokeDasharray="5 4" />}
          {activeIndex !== null && <line x1={activeX} x2={activeX} y1={padding.top} y2={padding.top + chartHeight} stroke="var(--mantine-color-gray-5)" strokeWidth="1" strokeDasharray="4 4" />}
          {points.map((point, index) => {
            const label = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", timeZone: "UTC" }).format(new Date(`${point.date}T00:00:00Z`))
            const active = activeIndex === index
            return (
              <g key={point.date}>
                <circle cx={x(index)} cy={y(point.pageViews)} r={active ? 6 : 4} fill={SERIES[0].color} stroke="var(--mantine-color-body)" strokeWidth="2" />
                <circle cx={x(index)} cy={y(point.uniqueVisitors)} r={active ? 5 : 3} fill={SERIES[1].color} stroke="var(--mantine-color-body)" strokeWidth="2" />
                {active && <circle cx={x(index)} cy={y(point.registrations)} r="4" fill={SERIES[2].color} stroke="var(--mantine-color-body)" strokeWidth="2" />}
                {active && <circle cx={x(index)} cy={y(point.newListings)} r="4" fill={SERIES[3].color} stroke="var(--mantine-color-body)" strokeWidth="2" />}
                <text x={x(index)} y={height - 10} textAnchor="middle" fill="var(--mantine-color-dimmed)" fontSize="12" fontWeight="650">{label}</text>
                <rect
                  x={Math.max(0, x(index) - interactionWidth / 2)}
                  y="0"
                  width={Math.min(interactionWidth, width - Math.max(0, x(index) - interactionWidth / 2))}
                  height={height}
                  fill="transparent"
                  tabIndex={0}
                  role="button"
                  aria-label={`${label}: открыть показатели`}
                  onPointerEnter={() => setActiveIndex(index)}
                  onPointerMove={() => setActiveIndex(index)}
                  onFocus={() => setActiveIndex(index)}
                  onBlur={() => setActiveIndex(null)}
                />
              </g>
            )
          })}
          <text x="6" y={padding.top + 5} fill="var(--mantine-color-dimmed)" fontSize="11">{maximum}</text>
          <text x="28" y={padding.top + chartHeight + 4} fill="var(--mantine-color-gray-5)" fontSize="11">0</text>
        </svg>
        {activePoint && (
          <Paper className="admin-traffic-tooltip" withBorder shadow="lg" radius="md" p="sm" style={tooltipPosition}>
            <Text className="admin-traffic-tooltip__date" size="xs" fw={800} c="gray.6">
              📅 {new Intl.DateTimeFormat("ru-RU", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${activePoint.date}T00:00:00Z`))}
            </Text>
            {SERIES.map(({ key, label, color }) => (
              <Group key={key} justify="space-between" gap="lg" wrap="nowrap" className="admin-traffic-tooltip__row">
                <Group gap={6} wrap="nowrap">
                  <Box w={8} h={8} bg={color} style={{ borderRadius: "50%", flex: "0 0 auto" }} />
                  <Text size="xs" c="gray.6" style={{ whiteSpace: "nowrap" }}>{label}</Text>
                </Group>
                <Text size="sm" fw={800} style={{ color, fontVariantNumeric: "tabular-nums" }}>{activePoint[key].toLocaleString("ru-RU")}</Text>
              </Group>
            ))}
          </Paper>
        )}
      </Box>
      {/* Максимум рядом с названием.

          У каждой линии своя шкала, и без этого числа график читался бы
          неверно: регистрации и просмотры доходят до одной высоты, хотя
          отличаются в сотни раз. Максимум говорит, о каком масштабе
          речь, не заставляя наводить курсор. */}
      <Group gap="md" justify="center" mt={4} wrap="wrap">
        {SERIES.map(({ key, label, badgeColor }) => (
          <Badge key={key} variant="dot" color={badgeColor}>
            {label} · до {maxima[key].toLocaleString("ru-RU")}
          </Badge>
        ))}
      </Group>
    </Box>
  )
}
