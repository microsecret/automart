"use client"

import { useState } from "react"
import { Badge, Box, Button, Group, NumberInput, Paper, Stack, Text, TextInput, UnstyledButton } from "@mantine/core"
import { IconCamera, IconCheck, IconX } from "@tabler/icons-react"
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
  /* Насколько крепкие сведения: 0–100. Карта говорила «есть 92» как
     факт, а за этим могла стоять одна отметка восьмичасовой давности. */
  confidencePercent: number
  confidenceLabel: "высокая" | "средняя" | "низкая"
  /** «1 метка за 8 ч» — из чего сложилось число. */
  confidenceNote: string
  photo: string | null
  comment: string | null
}

/** Что человек отметил по одной марке в форме. */
type DraftEntry = {
  state: "YES" | "NO" | null
  price: string | number
}

const EMPTY_DRAFT: DraftEntry = { state: null, price: "" }

/**
 * Отметка наличия топлива на АЗС.
 *
 * Человек стоит у табло, где все цены и все марки видны сразу. Раньше
 * форма спрашивала по одной марке за раз: чтобы отметить 92-й, 95-й и
 * дизель, надо было открыть её трижды и трижды нажать «есть». За рулём
 * этого не делают — отмечали одну марку и уезжали.
 *
 * Теперь форма показывает все марки строками: у каждой «есть», «нет» и
 * поле цены. Очередь, снимок и комментарий относятся к заправке целиком
 * и стоят внизу — их заполняют реже.
 *
 * Сетка марок над формой осталась: по ней человек читает, что здесь
 * сейчас, не открывая ничего.
 */
export default function FuelAvailabilityReporter({
  stationId,
  stationName,
  city,
  latitude,
  longitude,
  availability,
  onReported,
}: {
  stationId: string
  /* Название и город уходят вместе с отметкой: по ним строится текст
     уведомления подписчикам, а на сервере этих сведений нет — точки
     приходят из OpenStreetMap и в базе не хранятся. */
  stationName: string
  city: string
  latitude: number
  longitude: number
  availability: StationAvailability[]
  onReported?: (next: StationAvailability[]) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [draft, setDraft] = useState<Record<string, DraftEntry>>({})
  const [queue, setQueue] = useState<QueueLevel | null>(null)
  const [photo, setPhoto] = useState<string | null>(null)
  const [comment, setComment] = useState("")
  const [uploading, setUploading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const byFuel = new Map(availability.map((item) => [item.fuel, item]))

  const entryOf = (fuel: AvailabilityFuel) => draft[fuel] || EMPTY_DRAFT

  const setEntry = (fuel: AvailabilityFuel, patch: Partial<DraftEntry>) => {
    setDraft((current) => ({ ...current, [fuel]: { ...(current[fuel] || EMPTY_DRAFT), ...patch } }))
  }

  /* Отмеченные марки: только они уходят на сервер. Пустые строки — это
     «не смотрел», а не «нет», и присылать их нельзя. */
  const filled = AVAILABILITY_FUELS
    .map((fuel) => ({ fuel, ...entryOf(fuel) }))
    .filter((row) => row.state !== null)

  const send = async () => {
    if (filled.length === 0) {
      setError("Отметьте хотя бы одну марку")
      return
    }

    setSending(true)
    setError(null)
    try {
      const response = await fetch("/api/fuel-availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stationId,
          stationName,
          city,
          latitude,
          longitude,
          queue,
          photo,
          comment,
          entries: filled.map((row) => ({
            fuel: row.fuel,
            state: row.state,
            price: row.price || null,
          })),
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || "Не удалось отправить отметку")

      onReported?.(payload.availability || [])
      setIsOpen(false)
      setDraft({})
      setQueue(null)
      setPhoto(null)
      setComment("")

      /* Подтверждение держится недолго: человек уже уехал, и оно нужно
         ровно на то, чтобы он понял — засчитано. */
      setSaved(true)
      window.setTimeout(() => setSaved(false), 2500)
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Не удалось отправить отметку")
    } finally {
      setSending(false)
    }
  }

  return (
    <Stack gap="xs">
      <Group justify="space-between" align="center">
        <Text size="sm" fw={600}>Есть ли топливо</Text>
        <Text size="xs" c="dimmed">по отметкам водителей</Text>
      </Group>

      {/* Сетка марок: человек читает, что здесь сейчас, не открывая
          форму. Цвет несёт состояние, но не в одиночку — рядом стоит
          подпись «есть»/«нет», иначе карта нечитаема при дальтонизме. */}
      <Box style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
        {AVAILABILITY_FUELS.map((fuel) => {
          const known = byFuel.get(fuel)
          const state = known?.state ?? "UNKNOWN"
          const age = known?.updatedAt ? formatAge(new Date(known.updatedAt)) : null

          return (
            <Box
              key={fuel}
              style={{
                padding: "8px 6px",
                borderRadius: 10,
                border: `1px solid ${
                  state === "YES" ? "var(--mantine-color-teal-4)"
                  : state === "NO" ? "var(--mantine-color-red-4)"
                  : "var(--market-line)"
                }`,
                background: state === "YES" ? "var(--mantine-color-teal-0)"
                  : state === "NO" ? "var(--mantine-color-red-0)"
                  : "var(--market-surface-subtle)",
                textAlign: "center",
              }}
            >
              <Text fw={700} fz={15} lh={1.1}>{AVAILABILITY_FUEL_LABELS[fuel]}</Text>
              <Text fz={10} c={state === "YES" ? "teal.7" : state === "NO" ? "red.7" : "dimmed"} lh={1.3}>
                {state === "YES" ? "есть" : state === "NO" ? "нет" : "не отмечали"}
              </Text>
              {/* Возраст отметки — половина ответа: по свежести человек
                  сам решает, верить ли. */}
              {age && <Text fz={9} c="dimmed" lh={1.2}>{age}</Text>}
              {/* Уверенность показывается, только когда сведения слабые:
                  при высокой она лишний шум, при низкой — предупреждение. */}
              {known && known.confidenceLabel !== "высокая" && (
                <Text fz={9} c={known.confidenceLabel === "низкая" ? "orange.7" : "dimmed"} lh={1.2}>
                  {known.confidencePercent}%
                </Text>
              )}
            </Box>
          )
        })}
      </Box>

      {!isOpen ? (
        <Button
          size="sm"
          radius="md"
          color={saved ? "teal" : "indigo"}
          variant={saved ? "light" : "filled"}
          leftSection={saved ? <IconCheck size={16} /> : undefined}
          onClick={() => setIsOpen(true)}
        >
          {saved ? "Записали, спасибо" : "Отметить, что здесь есть"}
        </Button>
      ) : (
        <Paper withBorder radius="md" p="xs" bg="var(--market-surface-subtle)">
          <Stack gap={8}>
            <Text size="xs" c="dimmed">
              Отметьте марки, которые видите на табло. Цена — если знаете.
            </Text>

            {/* Все марки строками: человек проходит табло сверху вниз и
                отмечает разом, а не открывает форму пять раз. */}
            <Stack gap={4}>
              {AVAILABILITY_FUELS.map((fuel) => {
                const entry = entryOf(fuel)
                return (
                  <Group key={fuel} gap={6} wrap="nowrap" align="center">
                    <Text fw={700} fz={13} w={38} style={{ flex: "0 0 38px" }}>
                      {AVAILABILITY_FUEL_LABELS[fuel]}
                    </Text>

                    <Button
                      size="compact-xs"
                      radius="md"
                      color="teal"
                      variant={entry.state === "YES" ? "filled" : "default"}
                      onClick={() => setEntry(fuel, { state: entry.state === "YES" ? null : "YES" })}
                      aria-pressed={entry.state === "YES"}
                      aria-label={`${AVAILABILITY_FUEL_LABELS[fuel]} есть`}
                      px={10}
                    >
                      <IconCheck size={13} />
                    </Button>

                    <Button
                      size="compact-xs"
                      radius="md"
                      color="red"
                      variant={entry.state === "NO" ? "filled" : "default"}
                      onClick={() => setEntry(fuel, { state: entry.state === "NO" ? null : "NO", price: "" })}
                      aria-pressed={entry.state === "NO"}
                      aria-label={`${AVAILABILITY_FUEL_LABELS[fuel]} нет`}
                      px={10}
                    >
                      <IconX size={13} />
                    </Button>

                    {/* Цена только к «есть»: у отсутствующего топлива её
                        не бывает, и поле там сбивает с толку. */}
                    <NumberInput
                      size="xs"
                      radius="md"
                      placeholder="₽/л"
                      value={entry.price}
                      onChange={(value) => setEntry(fuel, { price: value, state: entry.state ?? "YES" })}
                      min={10}
                      max={300}
                      decimalScale={2}
                      step={0.5}
                      hideControls
                      disabled={entry.state === "NO"}
                      style={{ flex: 1 }}
                      aria-label={`Цена ${AVAILABILITY_FUEL_LABELS[fuel]}, рублей за литр`}
                    />
                  </Group>
                )
              })}
            </Stack>

            {/* Очередь одна на заправку: она не бывает разной у 92-го и
                95-го — машины стоят в общую. */}
            <Group gap={6} align="center">
              <Text size="xs" c="dimmed" style={{ flex: "0 0 auto" }}>Очередь:</Text>
              {(["NONE", "SMALL", "BIG"] as QueueLevel[]).map((level) => (
                <Button
                  key={level}
                  size="compact-xs"
                  radius="md"
                  variant={queue === level ? "filled" : "default"}
                  color="indigo"
                  onClick={() => setQueue(queue === level ? null : level)}
                  aria-pressed={queue === level}
                >
                  {QUEUE_LABELS[level]}
                </Button>
              ))}
            </Group>

            {/* Снимок табло — доказательство к отметке. Спорная отметка
                обычна, когда топливо кончается на глазах, и фотография
                снимает спор быстрее любого счётчика подтверждений.

                capture="environment" открывает на телефоне заднюю камеру
                сразу: человек снимает колонку, а не ищет её в галерее. */}
            <Group gap={6} align="center">
              <Button
                size="xs"
                radius="md"
                variant={photo ? "light" : "default"}
                color={photo ? "teal" : "gray"}
                leftSection={photo ? <IconCheck size={14} /> : <IconCamera size={14} />}
                loading={uploading}
                onClick={() => document.getElementById(`fuel-photo-${stationId}`)?.click()}
              >
                {photo ? "Снимок добавлен" : "Снять табло"}
              </Button>
              {photo && (
                <Button size="xs" radius="md" variant="subtle" color="gray" onClick={() => setPhoto(null)}>
                  Убрать
                </Button>
              )}
              <input
                id={`fuel-photo-${stationId}`}
                type="file"
                accept="image/*"
                capture="environment"
                hidden
                onChange={async (event) => {
                  const file = event.currentTarget.files?.[0]
                  event.currentTarget.value = ""
                  if (!file) return

                  setUploading(true)
                  setError(null)
                  try {
                    const form = new FormData()
                    form.append("file", file)
                    const response = await fetch("/api/upload", { method: "POST", body: form })
                    const payload = await response.json().catch(() => null)
                    if (!response.ok) throw new Error(payload?.error || "Не удалось загрузить снимок")
                    setPhoto(payload.url || payload.path || null)
                  } catch (uploadError) {
                    setError(uploadError instanceof Error ? uploadError.message : "Не удалось загрузить снимок")
                  } finally {
                    setUploading(false)
                  }
                }}
              />
            </Group>

            {/* Подпись к отметке, а не сообщение: длинная не поместится в
                карточке и превратит карту в переписку. */}
            <TextInput
              size="xs"
              radius="md"
              placeholder="Комментарий: лимит на бак, что-то ещё"
              value={comment}
              onChange={(event) => setComment(event.currentTarget.value.slice(0, 200))}
              disabled={sending}
            />

            {error && <Text size="xs" c="red.6">{error}</Text>}

            <Group grow gap={6}>
              <Button
                size="sm"
                radius="md"
                color="indigo"
                loading={sending}
                disabled={filled.length === 0}
                onClick={() => void send()}
              >
                {filled.length > 1 ? `Отправить (${filled.length})` : "Отправить"}
              </Button>
              <Button
                size="sm"
                radius="md"
                variant="default"
                onClick={() => { setIsOpen(false); setError(null) }}
              >
                Отмена
              </Button>
            </Group>
          </Stack>
        </Paper>
      )}

      {/* Комментарии водителей — отдельно от снимка.

          Раньше комментарий показывался только под фотографией: без неё
          он пропадал вовсе, хотя именно текст часто и есть главное. «На
          табло не горит, по факту есть», «лимит 30 литров», «очередь на
          въезде» — такое не выразить кнопками, и оно решает, ехать ли. */}
      {(() => {
        const notes = availability.filter((item) => item.comment && item.updatedAt).slice(0, 3)
        if (notes.length === 0) return null

        return (
          <Stack gap={4}>
            {notes.map((item) => (
              <Paper key={item.fuel} withBorder radius="md" p={6} bg="var(--market-surface-subtle)">
                <Text size="xs" c="var(--market-ink)">{item.comment}</Text>
                <Text size="10px" c="dimmed" mt={2}>
                  {item.label} · {item.updatedAt ? formatAge(new Date(item.updatedAt)) : ""}
                </Text>
              </Paper>
            ))}
          </Stack>
        )
      })()}

      {/* Снимок табло — там, где он есть. Показывается один, самый
          свежий: галерея из шести фотографий одной колонки не говорит
          больше, чем последняя, а карточку растягивает. */}
      {(() => {
        const withPhoto = availability.find((item) => item.photo)
        if (!withPhoto?.photo) return null
        return (
          <Box
            component="img"
            src={withPhoto.photo}
            alt={`Табло на заправке, отметка про ${withPhoto.label}`}
            loading="lazy"
            style={{ width: "100%", maxHeight: 180, objectFit: "cover", borderRadius: 10, display: "block" }}
          />
        )
      })()}

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
