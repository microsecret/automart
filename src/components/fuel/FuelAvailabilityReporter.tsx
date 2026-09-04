"use client"

import { useState } from "react"
import { Badge, Box, Button, Group, NumberInput, Paper, Stack, Text, TextInput, UnstyledButton } from "@mantine/core"
import { IconCamera, IconCheck, IconRefresh } from "@tabler/icons-react"
import {
  AVAILABILITY_FUELS,
  AVAILABILITY_FUEL_LABELS,
  QUEUE_LABELS,
  type AvailabilityFuel,
  type QueueLevel,
} from "@/lib/fuel-availability"
import { nextFuelMark, keepsPrice } from "@/lib/fuel-mark-cycle"
import { tapFeedback } from "@/lib/telegram-webapp"

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
 * Человек стоит у колонки с телефоном в одной руке. Прошлая форма
 * спрашивала по каждой марке отдельной строкой: подпись, кнопка «есть»,
 * кнопка «нет», поле цены — четыре мелких цели в ряд шириной с ладонь.
 * Попасть в такую на ходу нельзя, и отметку бросали на середине.
 *
 * Теперь главный вопрос задаётся одним движением: крупные кнопки марок,
 * которые человек включает по тому, что видит на табло. Нажал 92 и 95 —
 * значит, они есть. Ничего нет вовсе — отдельная кнопка внизу, она
 * гасит все марки разом.
 *
 * Цены, очередь, снимок и комментарий уехали под кнопку «Подробнее»:
 * их заполняет меньшинство, а место они занимали всё.
 */
export default function FuelAvailabilityReporter({
  stationId,
  stationName,
  city,
  latitude,
  longitude,
  availability,
  stationFuels,
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
  /* Что за заправка по данным OpenStreetMap: газовая, бензиновая или
     смешанная. Форма спрашивала все шесть марок подряд, и на газовой
     АЗС человек видел вопрос про 92-й, которого там не бывает. */
  stationFuels?: string[]
  onReported?: (next: StationAvailability[]) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [draft, setDraft] = useState<Record<string, DraftEntry>>({})
  const [queue, setQueue] = useState<QueueLevel | null>(null)
  const [photo, setPhoto] = useState<string | null>(null)
  const [comment, setComment] = useState("")
  const [uploading, setUploading] = useState(false)
  const [sending, setSending] = useState(false)
  /* Подтверждение чужой отметки идёт своим запросом и своим ожиданием:
     кнопка «да» не должна блокировать форму отправки. */
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  /* Цены, очередь, снимок и комментарий свёрнуты по умолчанию: их
     заполняет меньшинство, а разложенными они занимали весь экран и
     отодвигали кнопку отправки за пределы видимого. */
  const [showDetails, setShowDetails] = useState(false)

  const byFuel = new Map(availability.map((item) => [item.fuel, item]))

  /* Какие марки показывать.

     На газовой заправке нет 92-го, на бензиновой — газа, и спрашивать
     про них значит просить человека отвечать на пустое место. Список
     сужается по тегам OpenStreetMap.

     Марка остаётся, если её уже кто-то отмечал: живая отметка вернее
     тега, а теги в OSM часто неполны. И если после сужения не осталось
     ничего — показываем всё: пустая форма хуже лишней марки. */
  const visibleFuels = (() => {
    const tags = (stationFuels || []).join(" ").toLocaleLowerCase("ru-RU")
    if (!tags) return AVAILABILITY_FUELS

    const hasGas = tags.includes("газ") || tags.includes("lpg") || tags.includes("cng")
    const hasPetrol = /аи|92|95|98|100|дт|бензин|дизел/.test(tags)

    const narrowed = AVAILABILITY_FUELS.filter((fuel) => {
      /* Ассортимент важнее прошлых отметок.

         Раньше марка оставалась, если её кто-то когда-то отмечал, — и
         на бензиновой Башнефти висел газ только потому, что кто-то
         однажды нажал по нему «нет». Отметка «нет газа» на заправке,
         где газа не бывает, ничего не сообщает и место занимает.

         Тег в OpenStreetMap описывает, что за колонки на станции
         вообще стоят, и это не меняется от нажатий. Он и решает. */
      if (fuel === "GAS") return hasGas
      /* Марку бензина оставляем и по прошлой отметке: теги бензина в
         OSM неполны — часто указан только «дизель», хотя 92-й и 95-й
         на станции есть. С газом такой беды нет: его отмечают, потому
         что он редкость. */
      if (byFuel.get(fuel)?.state && byFuel.get(fuel)?.state !== "UNKNOWN") return true
      return hasPetrol
    })

    return narrowed.length ? narrowed : AVAILABILITY_FUELS
  })()

  /* Что можно подтвердить: марки с известным состоянием и отметкой не
     новее получаса.

     Полчаса — граница, за которой подтверждение начинает что-то
     значить. Раньше него человек подтверждал бы отметку, сделанную
     почти одновременно с ним, и накручивал уверенность вместо того,
     чтобы её проверять. */
  const CONFIRM_AFTER_MS = 30 * 60 * 1000
  const confirmable = availability.filter((item) => (
    item.state !== "UNKNOWN"
    && item.updatedAt
    && Date.now() - new Date(item.updatedAt).getTime() > CONFIRM_AFTER_MS
  ))

  /** Подтвердить то, что уже написано: те же марки, текущее время. */
  const confirmCurrent = async () => {
    if (confirmable.length === 0) return
    tapFeedback("medium")
    setConfirming(true)
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
          queue: null,
          photo: null,
          comment: "",
          entries: confirmable.map((item) => ({ fuel: item.fuel, state: item.state, price: null })),
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || "Не удалось подтвердить")

      onReported?.(payload.availability || [])
      setSaved(true)
      window.setTimeout(() => setSaved(false), 2500)
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : "Не удалось подтвердить")
    } finally {
      setConfirming(false)
    }
  }

  const entryOf = (fuel: AvailabilityFuel) => draft[fuel] || EMPTY_DRAFT

  const setEntry = (fuel: AvailabilityFuel, patch: Partial<DraftEntry>) => {
    setDraft((current) => ({ ...current, [fuel]: { ...(current[fuel] || EMPTY_DRAFT), ...patch } }))
  }

  /* Отмеченные марки: только они уходят на сервер. Пустые строки — это
     «не смотрел», а не «нет», и присылать их нельзя. */
  const filled = visibleFuels
    .map((fuel) => ({ fuel, ...entryOf(fuel) }))
    .filter((row) => row.state !== null)

  const hasAnyYes = filled.some((row) => row.state === "YES")
  /* «Нет вообще» — когда все марки помечены как отсутствующие. Кнопка
     показывает своё состояние, а не притворяется обычной. */
  const isNothingAtAll = filled.length === visibleFuels.length && !hasAnyYes

  /* Касание по марке идёт по кругу: пусто → есть → нет → пусто.

     Отметить можно было только наличие. А на колонке обычная картина
     другая: 92-й есть, 95-го нет. Сказать про это было нечем — «нет
     вообще» гасит все марки разом и врёт, а промолчать про 95-й значит
     оставить следующего водителя в неведении ровно о том, за чем он
     едет.

     Третье состояние стоит того же одного касания: человек и так стоит у
     колонки с телефоном в одной руке. */
  const toggleFuel = (fuel: AvailabilityFuel) => {
    tapFeedback("light")
    const next = nextFuelMark(entryOf(fuel).state)
    /* Цена держится только у того, что есть: цена отсутствующего осталась
       бы от прошлого нажатия и ушла бы на сервер вместе с «нет». */
    setEntry(fuel, keepsPrice(next) ? { state: next } : { state: next, price: "" })
  }

  /* Отмечена ли заправка как закрытая: по этому признаку кнопка
     показывает своё состояние, а в комментарий уходит пояснение. */
  const CLOSED_NOTE = "Заправка не работает"
  const isClosed = comment.trim() === CLOSED_NOTE

  /** «Заправка не работает»: то же «нет всего» плюс пояснение. */
  const markClosed = () => {
    tapFeedback("medium")
    if (isClosed) {
      setDraft({})
      setComment("")
      return
    }
    setDraft(Object.fromEntries(visibleFuels.map((fuel) => [fuel, { state: "NO" as const, price: "" }])))
    setComment(CLOSED_NOTE)
  }

  /** «Нет вообще»: гасит все марки разом, повторное нажатие снимает. */
  const markNothing = () => {
    tapFeedback("medium")
    if (isNothingAtAll) {
      setDraft({})
      if (isClosed) setComment("")
      return
    }
    /* Пометка о закрытии снимается: колонки пусты — это не то же
       самое, что запертые ворота. */
    if (isClosed) setComment("")
    setDraft(Object.fromEntries(visibleFuels.map((fuel) => [fuel, { state: "NO" as const, price: "" }])))
  }

  const send = async () => {
    if (filled.length === 0) {
      setError("Отметьте, что есть на колонке")
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
      setShowDetails(false)
      setDraft({})
      setQueue(null)
      setPhoto(null)
      setComment("")
      tapFeedback("medium")

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
      {/* Сетка «есть ли топливо» убрана из формы.

          Она повторяла бейджи марок, которые стоят выше в карточке:
          там «92 · 63,20 ₽» зелёным, здесь «92 / есть / 14 мин
          назад» — одно и то же двумя способами, на два экрана
          прокрутки. Возраст и уверенность теперь в статусной строке
          над бейджами, а форма занимается только вводом. */}

      {/* Подтверждение чужой отметки одним нажатием.

          Отметка стареет молча: «есть 92» часовой давности выглядит так
          же уверенно, как пятиминутная, хотя за час бензин разбирают.
          Просить человека заново заполнять форму ради того же ответа
          бессмысленно — он видит ровно то, что уже написано, и ему
          достаточно кивнуть.

          «Да» отправляет те же марки с текущим временем: отметка
          молодеет, уверенность растёт. «Изменилось» открывает форму,
          потому что тут уже надо сказать, что именно стало другим.

          Блок показывается только при живой чужой отметке: подтверждать
          пустоту нечего, а свежую минутную — незачем. */}
      {!isOpen && confirmable.length > 0 && (
        <Paper withBorder radius="md" p="xs" className="fuel-report__confirm">
          <Text size="xs" fw={600} mb={6}>Это всё ещё актуально?</Text>
          <Group gap={6} grow>
            <Button
              size="sm"
              color="teal"
              leftSection={<IconCheck size={15} />}
              loading={confirming}
              onClick={() => void confirmCurrent()}
            >
              Да, подтверждаю
            </Button>
            <Button
              size="sm"
              variant="default"
              leftSection={<IconRefresh size={15} />}
              onClick={() => { tapFeedback("light"); setIsOpen(true) }}
            >
              Изменилось
            </Button>
          </Group>
        </Paper>
      )}

      {!isOpen ? (
        <Button
          className="fuel-report__open"
          size="md"
          color={saved ? "teal" : undefined}
          variant={saved ? "light" : "filled"}
          leftSection={saved ? <IconCheck size={18} /> : undefined}
          onClick={() => { tapFeedback("light"); setIsOpen(true) }}
          fullWidth
        >
          {saved ? "Записали, спасибо" : "Внести данные"}
        </Button>
      ) : (
        <Paper withBorder radius="md" p="sm" className="fuel-report">
          <Stack gap={10}>
            <Text size="sm" fw={700}>Какое топливо есть сейчас</Text>
            {/* Правило круга сказано словами: без подписи третье
                состояние находят случайно, дважды промахнувшись. */}
            <Text size="xs" c="dimmed" mt={-6}>
              Нажмите марку: есть → нет → снять
            </Text>

            {/* Марки крупными кнопками: человек смотрит на колонку и
                отмечает то, что видит, одним касанием на каждую. Прошлая
                форма требовала попасть в одну из четырёх мелких целей в
                строке — на ходу это не выходило. */}
            <Box className="fuel-report__grid">
              {visibleFuels.map((fuel) => {
                const entry = entryOf(fuel)
                return (
                  <UnstyledButton
                    key={fuel}
                    className="fuel-report__fuel"
                    data-active={entry.state === "YES" || undefined}
                    data-off={entry.state === "NO" || undefined}
                    onClick={() => toggleFuel(fuel)}
                    /* Состояний три, а aria-pressed знает два. Поэтому
                       ответ называется словами: незрячий человек слышит
                       «95: нет», а не «кнопка не нажата». */
                    aria-label={`${AVAILABILITY_FUEL_LABELS[fuel]}: ${
                      entry.state === "YES" ? "есть" : entry.state === "NO" ? "нет" : "не отмечено"
                    }`}
                  >
                    {AVAILABILITY_FUEL_LABELS[fuel]}
                  </UnstyledButton>
                )
              })}
            </Box>

            {/* Отдельная кнопка вместо шести нажатий «нет»: пустая
                заправка — частый и самый ценный отчёт, и он не должен
                стоить дороже, чем отметить наличие. */}
            <Box className="fuel-report__nothing-row">
              <UnstyledButton
                className="fuel-report__nothing"
                data-active={isNothingAtAll && !isClosed || undefined}
                onClick={markNothing}
                aria-pressed={isNothingAtAll && !isClosed}
              >
                Топлива нет вообще
              </UnstyledButton>

              {/* «Заправка закрыта» — отдельный ответ.

                  Пустые колонки и закрытая станция для человека за рулём
                  означают разное: в первом случае можно подождать
                  подвоза, во втором ехать сюда бессмысленно вовсе. Раньше
                  оба случая сводились к «топлива нет», и приехавший к
                  запертым воротам не мог предупредить остальных.

                  Отдельного состояния в базе нет и заводить его ради
                  этого не нужно: закрытая заправка — это «нет всего» с
                  пояснением, а пояснение и так уходит комментарием. */}
              <UnstyledButton
                className="fuel-report__closed"
                data-active={isClosed || undefined}
                onClick={markClosed}
                aria-pressed={isClosed}
              >
                Заправка не работает
              </UnstyledButton>
            </Box>

            {/* Подробности свёрнуты: цену, очередь и снимок заполняет
                меньшинство, а места они занимали столько же, сколько
                главный вопрос. */}
            {!showDetails ? (
              <UnstyledButton
                className="fuel-report__more"
                onClick={() => { tapFeedback("light"); setShowDetails(true) }}
              >
                Добавить цены, очередь и снимок
              </UnstyledButton>
            ) : (
              <Stack gap={10}>
                {/* Цена только к тем маркам, что человек отметил: у
                    отсутствующего топлива её не бывает, а спрашивать
                    цену того, чего он не видел, бессмысленно. */}
                {hasAnyYes && (
                  <Box>
                    <Text size="xs" c="dimmed" mb={6}>Цены, ₽/л</Text>
                    <Box className="fuel-report__prices">
                      {filled.filter((row) => row.state === "YES").map(({ fuel }) => (
                        <NumberInput
                          key={fuel}
                          size="sm"
                          radius="md"
                          label={AVAILABILITY_FUEL_LABELS[fuel]}
                          placeholder="—"
                          value={entryOf(fuel).price}
                          onChange={(value) => setEntry(fuel, { price: value })}
                          min={10}
                          max={300}
                          decimalScale={2}
                          step={0.5}
                          hideControls
                          inputMode="decimal"
                          aria-label={`Цена ${AVAILABILITY_FUEL_LABELS[fuel]}, рублей за литр`}
                        />
                      ))}
                    </Box>
                  </Box>
                )}

                {/* Очередь одна на заправку: она не бывает разной у 92-го и
                    95-го — машины стоят в общую. */}
                <Box>
                  <Text size="xs" c="dimmed" mb={6}>Очередь</Text>
                  <Box className="fuel-report__queue">
                    {(["NONE", "SMALL", "BIG"] as QueueLevel[]).map((level) => (
                      <UnstyledButton
                        key={level}
                        className="fuel-report__queue-option"
                        data-active={queue === level || undefined}
                        onClick={() => { tapFeedback("light"); setQueue(queue === level ? null : level) }}
                        aria-pressed={queue === level}
                      >
                        {QUEUE_LABELS[level]}
                      </UnstyledButton>
                    ))}
                  </Box>
                </Box>

                {/* Снимок табло — доказательство к отметке. Спорная отметка
                    обычна, когда топливо кончается на глазах, и фотография
                    снимает спор быстрее любого счётчика подтверждений.

                    capture="environment" открывает на телефоне заднюю камеру
                    сразу: человек снимает колонку, а не ищет её в галерее. */}
                <Group gap={6} align="center">
                  <Button
                    size="sm"
                    variant={photo ? "light" : "default"}
                    color={photo ? "teal" : "gray"}
                    leftSection={photo ? <IconCheck size={16} /> : <IconCamera size={16} />}
                    loading={uploading}
                    onClick={() => document.getElementById(`fuel-photo-${stationId}`)?.click()}
                    style={{ flex: 1 }}
                  >
                    {photo ? "Снимок добавлен" : "Сфотографировать колонку"}
                  </Button>
                  {photo && (
                    <Button size="sm" variant="subtle" color="gray" onClick={() => setPhoto(null)}>
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
                  size="sm"
                  radius="md"
                  placeholder="Комментарий: лимит на бак, что-то ещё"
                  value={comment}
                  onChange={(event) => setComment(event.currentTarget.value.slice(0, 200))}
                  disabled={sending}
                />
              </Stack>
            )}

            {error && <Text size="xs" c="red.6">{error}</Text>}

            {/* Почему кнопка не нажимается.

                Заблокированная кнопка без объяснения читается как
                поломка: человек жмёт «Отправить», ничего не происходит,
                и он уходит, решив, что сервис не работает. Отметить надо
                хотя бы одну марку — об этом и говорим. */}
            {filled.length === 0 && (
              <Text size="xs" c="dimmed" ta="center">
                Отметьте хотя бы одну марку — есть она или нет
              </Text>
            )}
            {/* Отправка внизу и во всю ширину: это последнее действие, и
                на телефоне оно должно попадать под большой палец. */}
            <Button
              className="fuel-report__send"
              size="md"
              loading={sending}
              disabled={filled.length === 0}
              onClick={() => void send()}
              fullWidth
            >
              Отправить
            </Button>
            <UnstyledButton
              className="fuel-report__cancel"
              onClick={() => { setIsOpen(false); setShowDetails(false); setError(null) }}
            >
              Отмена
            </UnstyledButton>
          </Stack>
        </Paper>
      )}

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
