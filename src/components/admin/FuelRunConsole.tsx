"use client"

import { useEffect, useRef, useState } from "react"
import { Badge, Box, Group, Paper, ScrollArea, Text, Loader } from "@mantine/core"
import { fetchJson } from "@/lib/api-client"

/**
 * Живая консоль прогона скрейпера.
 *
 * Сводных чисел прогона мало: по ним не понять, доходит ли сбор до нужного
 * города и какие данные он там видит. Лента показывает каждую обойдённую
 * заправку строкой — город, название, адрес, цены, наличие, источник.
 *
 * Строки читаются из базы, а не из живого потока: страницу закрывают и
 * открывают заново, приложение перезапускается при деплое, а история
 * последнего прогона должна пережить и то, и другое.
 */

type LogEntry = {
  id: string
  source: string
  city: string | null
  station: string | null
  address: string | null
  prices: string | null
  status: string | null
  kind: string
  message: string | null
  createdAt: string
}
type RunInfo = {
  id: string
  source: string
  status: string
  startedAt: string
  completedAt: string | null
  fetched: number
  upserted: number
  failed: number
}
type LogResponse = { run: RunInfo | null; entries: LogEntry[]; cursor: string | null }

const SOURCE_LABELS: Record<string, string> = {
  GDEBENZ: "ГдеБЕНЗ",
  GDEZAPRAVKA: "ГдеЗаправка",
  TWOGIS: "2ГИС",
  DROM: "Дром",
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  yes: { label: "есть", color: "teal" },
  low: { label: "мало", color: "yellow" },
  no: { label: "нет", color: "red" },
}

/* Лента держит в памяти ограниченное число строк: прогон приносит тысячи,
   и складывать их все в DOM значило бы подвесить вкладку. */
const MAX_VISIBLE = 400

function clockTime(value: string) {
  return new Date(value).toLocaleTimeString("ru-RU", { timeZone: "Europe/Moscow", hour12: false })
}

export default function FuelRunConsole({ active }: { active: boolean }) {
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [run, setRun] = useState<RunInfo | null>(null)
  const cursorRef = useRef<string | null>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const stickToBottomRef = useRef(true)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>

    const poll = async () => {
      try {
        const params = new URLSearchParams({ view: "log" })
        if (cursorRef.current) params.set("after", cursorRef.current)
        const data = await fetchJson<LogResponse>(`/api/admin/fuel?${params.toString()}`)
        if (cancelled) return

        setRun(data.run)
        if (data.entries.length) {
          cursorRef.current = data.cursor
          setEntries((current) => [...current, ...data.entries].slice(-MAX_VISIBLE))
        }
      } catch {
        /* Обрыв опроса не должен ломать страницу: следующая попытка
           через тот же интервал. */
      } finally {
        if (!cancelled) timer = setTimeout(poll, active ? 2_000 : 15_000)
      }
    }

    void poll()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [active])

  /* Лента прокручивается за новыми строками, но только пока человек сам не
     отмотал вверх — иначе невозможно прочитать то, что уже проехало. */
  useEffect(() => {
    if (!stickToBottomRef.current) return
    const viewport = viewportRef.current
    if (viewport) viewport.scrollTop = viewport.scrollHeight
  }, [entries])

  const onScroll = () => {
    const viewport = viewportRef.current
    if (!viewport) return
    stickToBottomRef.current = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 60
  }

  const running = run?.status === "RUNNING"

  return (
    <Paper withBorder radius="md" p="md">
      <Group justify="space-between" mb="xs" wrap="wrap" gap="xs">
        <Group gap="xs">
          <Text size="sm" fw={700}>Консоль сбора</Text>
          {running && <Loader size="xs" color="indigo" />}
        </Group>
        {run && (
          <Group gap="xs">
            <Badge variant="light" color="gray">{SOURCE_LABELS[run.source] || run.source}</Badge>
            <Badge variant="light" color={running ? "blue" : run.failed > 0 ? "orange" : "teal"}>
              {running ? "идёт" : run.failed > 0 ? "с ошибками" : "завершён"}
            </Badge>
            <Text size="xs" c="dimmed">собрано {run.fetched} · сохранено {run.upserted}</Text>
          </Group>
        )}
      </Group>

      <ScrollArea h={340} viewportRef={viewportRef} onScrollPositionChange={onScroll}>
        <Box
          style={{
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
            fontSize: 12,
            lineHeight: 1.7,
          }}
        >
          {entries.map((entry) => {
            if (entry.kind !== "STATION") {
              return (
                <Box key={entry.id} py={2}>
                  <Text span size="xs" c="dimmed">{clockTime(entry.createdAt)}</Text>{" "}
                  <Text span size="xs" c={entry.kind === "ERROR" ? "red" : "indigo"} fw={600}>
                    {entry.kind === "ERROR" ? "ошибка" : "регион"}
                  </Text>{" "}
                  {entry.city && <Text span size="xs" fw={600}>{entry.city} · </Text>}
                  <Text span size="xs" c={entry.kind === "ERROR" ? "red" : undefined}>{entry.message}</Text>
                </Box>
              )
            }

            const status = entry.status ? STATUS_META[entry.status] : null
            return (
              <Box key={entry.id} py={2}>
                <Text span size="xs" c="dimmed">{clockTime(entry.createdAt)}</Text>{" "}
                <Text span size="xs" fw={700}>{entry.city || "—"}</Text>
                <Text span size="xs" c="dimmed"> · </Text>
                <Text span size="xs" fw={600}>{entry.station}</Text>
                {entry.address && (
                  <>
                    <Text span size="xs" c="dimmed"> · </Text>
                    <Text span size="xs" c="dimmed">{entry.address}</Text>
                  </>
                )}
                {entry.prices && (
                  <>
                    <Text span size="xs" c="dimmed"> · </Text>
                    <Text span size="xs" c="indigo">{entry.prices}</Text>
                  </>
                )}
                {status && (
                  <>
                    <Text span size="xs" c="dimmed"> · </Text>
                    <Text span size="xs" c={status.color} fw={600}>{status.label}</Text>
                  </>
                )}
                <Text span size="xs" c="dimmed"> · {SOURCE_LABELS[entry.source] || entry.source}</Text>
              </Box>
            )
          })}

          {!entries.length && (
            <Text size="sm" c="dimmed" ta="center" py="xl">
              {running ? "Ожидаем первые строки прогона…" : "Здесь появятся заправки по мере сбора"}
            </Text>
          )}
        </Box>
      </ScrollArea>
    </Paper>
  )
}
