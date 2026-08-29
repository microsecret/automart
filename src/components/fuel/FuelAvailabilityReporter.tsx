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
  const [openFuel, setOpenFuel] = useState<AvailabilityFuel | null>(null)
  /* Снимок и подпись необязательны и живут отдельно от нажатия «есть» /
     «нет»: человек у колонки отмечает за две секунды, а фотографирует
     только если считает нужным. Требовать снимок значило бы получать
     отметки от единиц. */
  const [photo, setPhoto] = useState<string | null>(null)
  const [comment, setComment] = useState("")
  /* Цена вводится вместе с наличием: отдельным блоком её не ставил
     никто — человек отмечал топливо, закрывал карточку и уезжал. */
  const [price, setPrice] = useState<string | number>("")
  const [uploading, setUploading] = useState(false)
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
        body: JSON.stringify({ stationId, stationName, city, latitude, longitude, fuel, state, queue, photo, comment, price: price || null }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || "Не удалось отправить отметку")

      onReported?.(payload.availability || [])
      setOpenFuel(null)
      /* Снимок и подпись сбрасываются: они относились к этой отметке, а
         следующая будет про другую заправку или другую марку. */
      setPhoto(null)
      setComment("")
      setPrice("")
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
              {/* Уверенность вместо голого «есть».

                  Карта говорила «есть 92» как факт, а за этим могла стоять
                  одна отметка восьмичасовой давности. Человек ехал и
                  возвращался ни с чем — второй раз он на карту уже не
                  смотрел.

                  Число показывается только когда сведения слабые: при
                  высокой уверенности оно лишний шум, а при низкой —
                  предупреждение. */}
              {known && !justSaved && known.confidenceLabel !== "высокая" && (
                <Text fz={9} c={known.confidenceLabel === "низкая" ? "orange.7" : "dimmed"} lh={1.2}>
                  {known.confidencePercent}% · {known.confidenceNote}
                </Text>
              )}
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

            {/* Цена рядом с «есть» — одним движением.

                Раньше цена жила отдельным блоком ниже: человек отмечал
                наличие, закрывал карточку и уезжал, а цену не ставил
                никто. Между тем это то, ради чего половина открывает
                карту вообще.

                Поле необязательное: нажал «есть» — записалось и без
                цены. Отметка остаётся делом двух секунд. */}
            <Group gap={6} align="center">
              <NumberInput
                size="xs"
                radius="md"
                placeholder="Цена, ₽/л"
                value={price}
                onChange={setPrice}
                min={10}
                max={300}
                decimalScale={2}
                step={0.5}
                hideControls
                style={{ flex: 1 }}
                aria-label={`Цена ${AVAILABILITY_FUEL_LABELS[openFuel]}, рублей за литр`}
              />
              <Button
                size="xs"
                radius="md"
                color="teal"
                variant="light"
                disabled={!price}
                loading={sending}
                onClick={() => void send(openFuel, "YES", null)}
              >
                Есть, по этой цене
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

            {/* Подпись к снимку, а не сообщение: длинная не поместится в
                карточке и превратит карту в переписку. */}
            <TextInput
              size="xs"
              radius="md"
              placeholder="Комментарий: очередь, лимит на бак, что-то ещё"
              value={comment}
              onChange={(event) => setComment(event.currentTarget.value.slice(0, 200))}
              disabled={sending}
            />

            {error && <Text size="xs" c="red.6">{error}</Text>}
          </Stack>
        </Paper>
      )}

      {/* Подтверждение чужой отметки одним нажатием.

          Сделать свою отметку — выбрать марку, потом «есть» или «нет».
          Подтвердить чужую — одно нажатие, и человек соглашается охотнее.
          А уверенность от подтверждения растёт так же, как от новой
          отметки: это и есть та самая вторая метка, которой не хватало.

          Показывается, только когда есть что подтверждать и сведения не
          железные: при высокой уверенности лишний вопрос раздражает. */}
      {(() => {
        /* Спрашиваем, только когда сведения по-настоящему устарели.

           Раньше условием была «не высокая» уверенность — а средняя
           бывает почти всегда, и плашка висела постоянно, перекрывая
           поле цены. Вопрос, который задают каждый раз, перестают
           читать.

           Теперь порог другой: отметке больше часа и уверенность низкая.
           Свежую подтверждать незачем — она и так свежая; при средней
           уверенности человек видит проценты и решает сам. */
        const stale = availability.find((item) => {
          if (item.state === "UNKNOWN" || !item.updatedAt) return false
          if (item.confidenceLabel !== "низкая") return false
          return Date.now() - new Date(item.updatedAt).getTime() > 60 * 60 * 1000
        })

        /* Не показываем, пока открыта форма отметки: человек уже отвечает
           на тот же вопрос кнопками выше, и второй вопрос рядом сбивает. */
        if (!stale || openFuel) return null
        const weak = stale

        return (
          <Paper withBorder radius="md" p="xs" bg="var(--market-surface-subtle)">
            <Stack gap={6}>
              <Text size="xs" c="dimmed">
                {weak.label}: {weak.state === "YES" ? "есть" : "нет"} — {weak.confidenceNote}.
                Это всё ещё так?
              </Text>
              <Group grow gap={6}>
                <Button
                  size="xs"
                  radius="md"
                  color="teal"
                  leftSection={<IconCheck size={14} />}
                  loading={sending}
                  onClick={() => void send(weak.fuel, weak.state === "YES" ? "YES" : "NO", null)}
                >
                  Да, подтверждаю
                </Button>
                <Button
                  size="xs"
                  radius="md"
                  variant="default"
                  loading={sending}
                  onClick={() => void send(weak.fuel, weak.state === "YES" ? "NO" : "YES", null)}
                >
                  Уже нет
                </Button>
              </Group>
            </Stack>
          </Paper>
        )
      })()}

      {/* Снимок табло и подпись — там, где они есть. Показывается один,
          самый свежий: галерея из шести фотографий одной колонки не
          говорит больше, чем последняя, а карточку растягивает. */}
      {(() => {
        const withPhoto = availability.find((item) => item.photo)
        if (!withPhoto?.photo) return null
        return (
          <Box>
            <Box
              component="img"
              src={withPhoto.photo}
              alt={`Табло на заправке, отметка про ${withPhoto.label}`}
              loading="lazy"
              style={{ width: "100%", maxHeight: 180, objectFit: "cover", borderRadius: 10, display: "block" }}
            />
            {withPhoto.comment && (
              <Text size="xs" c="dimmed" mt={4}>{withPhoto.comment}</Text>
            )}
          </Box>
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
