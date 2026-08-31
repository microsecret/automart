"use client"

import { useState } from "react"
import {
  Alert, Badge, Button, Group, Modal, MultiSelect, Paper, Stack, Text, Tooltip,
} from "@mantine/core"
import { notifications } from "@mantine/notifications"
import { IconPlayerPlay, IconAlertTriangle, IconRefresh } from "@tabler/icons-react"
import { fetchJson, getApiClientErrorMessage } from "@/lib/api-client"
import { FUEL_TARGET_REGIONS } from "@/lib/fuel-target-regions"

/**
 * Ручной запуск скрейпера АЗС.
 *
 * Сбор идёт по расписанию, но администратору нужен способ дособрать данные
 * сразу — после правки источника или когда цены в городе явно устарели.
 * Прогон долгий и бьёт по внешним сайтам, поэтому запуск подтверждается
 * отдельно, а не срабатывает по одному клику.
 */

const SOURCE_OPTIONS = [
  { value: "GDEBENZ", label: "ГдеБЕНЗ — цены и наличие" },
  { value: "GDEZAPRAVKA", label: "ГдеЗаправка — точки и наличие" },
  { value: "TWOGIS", label: "2ГИС — справочник точек" },
]

const DEFAULT_SOURCES = ["GDEBENZ", "GDEZAPRAVKA"]

type RunSummary = {
  source: string
  status: string
  fetched: number
  saved: number
  failed: number
  message: string | null
}
type RunResponse = { fetched: number; saved: number; failed: number; sources: RunSummary[] }

const SOURCE_LABELS: Record<string, string> = {
  GDEBENZ: "ГдеБЕНЗ",
  GDEZAPRAVKA: "ГдеЗаправка",
  TWOGIS: "2ГИС",
  DROM: "Дром",
}

export default function FuelScraperRunner({ onFinished }: { onFinished?: () => void }) {
  const [sources, setSources] = useState<string[]>(DEFAULT_SOURCES)
  const [regions, setRegions] = useState<string[]>([])
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [running, setRunning] = useState(false)
  const [lastResult, setLastResult] = useState<RunResponse | null>(null)

  const regionOptions = FUEL_TARGET_REGIONS.map((region) => ({ value: region.key, label: region.city }))
  const scopeLabel = regions.length ? `${regions.length} регион(ов)` : "все целевые регионы"

  const run = async () => {
    if (!sources.length || running) return
    setConfirmOpen(false)
    setRunning(true)
    try {
      const result = await fetchJson<RunResponse>("/api/admin/fuel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sources, ...(regions.length ? { regions } : {}) }),
      })
      setLastResult(result)
      notifications.show({
        title: "Сбор завершён",
        message: `Собрано ${result.fetched}, сохранено ${result.saved}, ошибок ${result.failed}.`,
        color: result.failed > 0 ? "orange" : "teal",
        autoClose: 12_000,
      })
      onFinished?.()
    } catch (error) {
      notifications.show({
        title: "Сбор не выполнен",
        message: getApiClientErrorMessage(error, "Попробуйте ещё раз позже."),
        color: "red",
        autoClose: 12_000,
      })
    } finally {
      setRunning(false)
    }
  }

  return (
    <Paper withBorder radius="md" p="md">
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start" wrap="wrap" gap="sm">
          <div>
            <Text size="sm" fw={700}>Ручной сбор</Text>
            <Text size="xs" c="dimmed">
              Обычно скрейпер работает по расписанию. Запускайте вручную, если данные устарели.
            </Text>
          </div>
          <Tooltip label="Выберите хотя бы один источник" disabled={sources.length > 0}>
            <Button
              leftSection={running ? <IconRefresh size={16} /> : <IconPlayerPlay size={16} />}
              onClick={() => setConfirmOpen(true)}
              loading={running}
              disabled={!sources.length}
            >
              {running ? "Идёт сбор…" : "Запустить сбор"}
            </Button>
          </Tooltip>
        </Group>

        <Group gap="sm" wrap="wrap" align="flex-start">
          <MultiSelect
            label="Источники"
            data={SOURCE_OPTIONS}
            value={sources}
            onChange={setSources}
            disabled={running}
            w={320}
          />
          <MultiSelect
            label="Регионы"
            placeholder={regions.length ? undefined : "Все целевые регионы"}
            data={regionOptions}
            value={regions}
            onChange={setRegions}
            disabled={running}
            searchable
            clearable
            w={320}
          />
        </Group>

        {running && (
          <Alert color="blue" variant="light" title="Сбор идёт">
            Прогон занимает несколько минут: источники обходятся последовательно с паузой.
            Страницу можно не держать открытой — результат попадёт в журнал прогонов.
          </Alert>
        )}

        {lastResult && !running && (
          <Group gap="xs" wrap="wrap">
            <Text size="xs" c="dimmed">Последний ручной запуск:</Text>
            {lastResult.sources.map((row) => (
              <Badge
                key={row.source}
                variant="light"
                color={row.failed > 0 ? "orange" : row.status === "NOT_CONFIGURED" || row.status === "UNSUPPORTED" ? "gray" : "teal"}
              >
                {SOURCE_LABELS[row.source] || row.source}: {row.saved} сохранено
              </Badge>
            ))}
          </Group>
        )}
      </Stack>

      <Modal opened={confirmOpen} onClose={() => setConfirmOpen(false)} title="Запустить сбор АЗС?" centered radius="lg">
        <Stack gap="sm">
          <Alert color="orange" variant="light" icon={<IconAlertTriangle size={18} />}>
            Прогон обращается к внешним сайтам и занимает несколько минут.
            Пока он идёт, второй запуск будет отклонён.
          </Alert>
          <Text size="sm">
            Источники: <b>{sources.map((value) => SOURCE_LABELS[value] || value).join(", ")}</b>
            <br />
            Охват: <b>{scopeLabel}</b>
          </Text>
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={() => setConfirmOpen(false)}>Отмена</Button>
            <Button onClick={run} leftSection={<IconPlayerPlay size={16} />}>Запустить</Button>
          </Group>
        </Stack>
      </Modal>
    </Paper>
  )
}
