"use client"

import { useEffect, useRef, useState } from "react"
import { Button, Divider, Modal, SimpleGrid, Stack, Text } from "@mantine/core"
import { IconBell, IconCheck } from "@tabler/icons-react"
import { AVAILABILITY_FUEL_LABELS, AVAILABILITY_FUELS, type AvailabilityFuel } from "@/lib/fuel-availability"

/**
 * Подписка на появление топлива.
 *
 * Отметки отвечают «есть ли сейчас», а человеку с пустым баком нужно
 * знать, когда появится: иначе он открывает карту двадцать раз за день
 * или не открывает вовсе.
 *
 * Три вида подписки идут от узкого к широкому — так человек читает сверху
 * вниз и останавливается на первом подходящем: сначала «вся заправка»,
 * потом «эта марка здесь», потом «марка по городу».
 */
/* Марки, на которые можно подписаться.

   Список был свой, руками: сначала три — 92, 95 и ДТ, потом к ним
   дописали сотый и газ. И каждый раз он отставал от того, о чём в чат
   приходят новости: человек нажимал «сообщать мне о таком», открывал
   окно и своей марки не находил. Последним так потерялся АИ-98.

   Поэтому список общий — тот же, по которому размечается наличие и
   принимает подписку API. Разойтись он больше не может.

   Порядок свой: по распространённости, а не по коду. На 95-м ездит
   большинство, сотый и газ нужны меньшинству и стоят последними. */
/* Порядок объявлен раньше, чем используется: `const` не поднимается, и
   обратный порядок падает в собранном коде — «Cannot access before
   initialization», ровно как это уже случилось с фильтром на карте. */
const SUBSCRIBE_ORDER: AvailabilityFuel[] = ["AI92", "AI95", "DT", "AI98", "AI100", "GAS"]

const SUBSCRIBABLE_FUELS: AvailabilityFuel[] = [...AVAILABILITY_FUELS]
  .sort((a, b) => SUBSCRIBE_ORDER.indexOf(a) - SUBSCRIBE_ORDER.indexOf(b))

export default function FuelSubscribeButton({
  stationId,
  stationName,
  city,
  highlightFuel = null,
  autoOpen = false,
}: {
  stationId: string
  stationName: string
  city: string
  /* Марка, ради которой человек пришёл: он нажал «сообщать мне о 95-м»,
     и 95 в окне должен быть виден сразу, а не теряться среди прочих. */
  highlightFuel?: AvailabilityFuel | null
  /* Пришли по кнопке «Сообщать мне о таком» из чата.

     Человек нажал именно на подписку, а попадал на карточку заправки, где
     подписка — одна кнопка среди прочих: приходилось искать глазами то,
     ради чего он и перешёл. Окно раскрывается само. */
  autoOpen?: boolean
}) {
  const [opened, setOpened] = useState(false)

  /* Один раз: закрыв окно, человек не должен получать его снова при
     каждой перерисовке карты. */
  const autoOpenedRef = useRef(false)
  useEffect(() => {
    if (!autoOpen || autoOpenedRef.current) return
    autoOpenedRef.current = true
    setOpened(true)
  }, [autoOpen])
  const [sending, setSending] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const subscribe = async (
    kind: "STATION" | "STATION_FUEL" | "CITY_FUEL",
    fuel: AvailabilityFuel | null,
  ) => {
    const key = `${kind}:${fuel ?? ""}`
    setSending(key)
    setError(null)
    try {
      const response = await fetch("/api/fuel-subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, stationId, stationName, fuel, city }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || "Не удалось подписаться")

      setDone(key)
      /* Подтверждение держится недолго: человек уже понял, что подписан, а
         постоянная галочка мешает подписаться на другую марку. */
      window.setTimeout(() => setDone(null), 2500)
    } catch (subscribeError) {
      setError(subscribeError instanceof Error ? subscribeError.message : "Не удалось подписаться")
    } finally {
      setSending(null)
    }
  }

  const label = (kind: string, fuel: string | null) => {
    const key = `${kind}:${fuel ?? ""}`
    return done === key ? <IconCheck size={16} /> : null
  }

  return (
    <>
      <Button
        size="compact-sm"
        variant="light"
        color="indigo"
        leftSection={<IconBell size={14} />}
        onClick={() => setOpened(true)}
      >
        Уведомить, когда появится
      </Button>

      <Modal
        opened={opened}
        onClose={() => setOpened(false)}
        title="Подписка на уведомления"
        radius="md"
        centered
      >
        <Stack gap="sm">
          <Text size="sm" c="dimmed">{stationName}</Text>

          <Stack gap={4}>
            <Text size="sm" fw={600}>Вся заправка</Text>
            <Text size="xs" c="dimmed">Сообщим, когда тут появится любое топливо</Text>
            <Button
              variant="default"
              loading={sending === "STATION:"}
              rightSection={label("STATION", null)}
              onClick={() => void subscribe("STATION", null)}
            >
              Подписаться на заправку
            </Button>
          </Stack>

          <Divider />

          <Stack gap={4}>
            <Text size="sm" fw={600}>Конкретная марка здесь</Text>
            <Text size="xs" c="dimmed">Когда на этом адресе появится выбранная марка</Text>
            {/* Три в ряд, а не все подряд.

                Марок стало шесть, и `Group grow` растягивал их в одну
                строку: на телефоне подписи сжимались до нечитаемых. Три —
                та же сетка, что у кнопок марок в посте для чата. */}
            <SimpleGrid cols={3} spacing={6}>
              {SUBSCRIBABLE_FUELS.map((fuel) => (
                <Button
                  key={fuel}
                  /* Марка из ссылки залита цветом: человек пришёл именно
                     за ней и должен увидеть её с одного взгляда. */
                  variant={fuel === highlightFuel ? "filled" : "default"}
                  loading={sending === `STATION_FUEL:${fuel}`}
                  rightSection={label("STATION_FUEL", fuel)}
                  onClick={() => void subscribe("STATION_FUEL", fuel)}
                >
                  {AVAILABILITY_FUEL_LABELS[fuel]}
                </Button>
              ))}
            </SimpleGrid>
          </Stack>

          <Divider />

          <Stack gap={4}>
            <Text size="sm" fw={600}>Марка по всему городу</Text>
            <Text size="xs" c="dimmed">
              {city ? `Когда выбранная марка появится в любой АЗС города ${city}` : "Город не определён"}
            </Text>
            {/* Три в ряд, а не все подряд.

                Марок стало шесть, и `Group grow` растягивал их в одну
                строку: на телефоне подписи сжимались до нечитаемых. Три —
                та же сетка, что у кнопок марок в посте для чата. */}
            <SimpleGrid cols={3} spacing={6}>
              {SUBSCRIBABLE_FUELS.map((fuel) => (
                <Button
                  key={fuel}
                  variant={fuel === highlightFuel ? "filled" : "default"}
                  disabled={!city}
                  loading={sending === `CITY_FUEL:${fuel}`}
                  rightSection={label("CITY_FUEL", fuel)}
                  onClick={() => void subscribe("CITY_FUEL", fuel)}
                >
                  {AVAILABILITY_FUEL_LABELS[fuel]}
                </Button>
              ))}
            </SimpleGrid>
          </Stack>

          {error && <Text size="xs" c="red.6">{error}</Text>}

          {/* Уведомление приходит в бот: сказать об этом надо здесь, иначе
              человек ждёт его на сайте и не понимает, почему не приходит. */}
          <Text size="xs" c="dimmed">
            Уведомления приходят в Telegram-бот. Не чаще раза в час по одной подписке.
          </Text>

          <Button onClick={() => setOpened(false)} radius="md">Готово</Button>
        </Stack>
      </Modal>
    </>
  )
}
