"use client"

import { useState } from "react"
import { Alert, Badge, Button, Group, Modal, NumberInput, Stack, Text, TextInput, Textarea, ThemeIcon } from "@mantine/core"
import { IconCheck, IconShoppingCart, IconTruckDelivery } from "@tabler/icons-react"

type Props = {
  partId: string
  itemName: string
  priceRub: number
  supplyMode: string
  leadTimeDaysMin: number | null
  leadTimeDaysMax: number | null
  storeName: string
}

/**
 * Оформление заказа прямо с витрины.
 *
 * Покупателю показываются те же цена и срок, что и в карточке: заказ должен
 * подтверждать условия, а не открывать их заново.
 */
export default function PartOrderButton({ partId, itemName, priceRub, supplyMode, leadTimeDaysMin, leadTimeDaysMax, storeName }: Props) {
  const [opened, setOpened] = useState(false)
  const [form, setForm] = useState({ contactName: "", contactPhone: "", contactEmail: "", city: "", comment: "" })
  const [quantity, setQuantity] = useState<string | number>(1)
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle")
  const [error, setError] = useState<string | null>(null)

  const total = priceRub * (Number(quantity) || 1)

  const submit = async () => {
    setState("sending")
    setError(null)
    try {
      const response = await fetch("/api/part-orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, partId, quantity: Number(quantity) || 1 }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        setError(typeof payload?.error === "string" ? payload.error : "Не удалось отправить заказ")
        setState("idle")
        return
      }
      setState("sent")
    } catch {
      setError("Нет связи с сервером. Попробуйте ещё раз.")
      setState("idle")
    }
  }

  const close = () => {
    setOpened(false)
    if (state === "sent") {
      setState("idle")
      setForm({ contactName: "", contactPhone: "", contactEmail: "", city: "", comment: "" })
      setQuantity(1)
    }
  }

  return (
    <>
      <Button
        fullWidth
        mt="sm"
        color="indigo"
        leftSection={<IconShoppingCart size={16} />}
        onClick={(event) => { event.preventDefault(); event.stopPropagation(); setOpened(true) }}
      >
        Заказать
      </Button>

      {/* Промах мимо окна не стирает заполненное: в форме несколько
          полей, и на телефоне палец легко попадает по фону. Крестик и
          «Отмена» никуда не делись — закрыть можно осознанно. */}
      <Modal opened={opened} onClose={close} title={state === "sent" ? "Заказ отправлен" : "Заказ позиции"} centered closeOnClickOutside={state === "sent"}>
        {state === "sent" ? (
          <Stack gap="sm" align="center" ta="center" py="sm">
            <ThemeIcon size={52} radius="xl" color="teal" variant="light"><IconCheck size={26} /></ThemeIcon>
            <Text fw={700}>Заказ передан магазину</Text>
            <Text size="sm" c="dimmed">
              {storeName} свяжется с вами по указанному телефону, чтобы подтвердить наличие, срок и способ оплаты.
            </Text>
            <Button variant="light" color="gray" onClick={close}>Закрыть</Button>
          </Stack>
        ) : (
          <Stack gap="sm">
            <Alert color="indigo" variant="light">
              <Text size="sm" fw={700}>{itemName}</Text>
              <Group gap={6} mt={4} wrap="wrap">
                <Badge size="sm" variant="light" color={supplyMode === "STOCK" ? "teal" : "orange"} leftSection={<IconTruckDelivery size={11} />}>
                  {supplyMode === "STOCK"
                    ? "В наличии"
                    : leadTimeDaysMin
                      ? `Под заказ ${leadTimeDaysMin}–${leadTimeDaysMax || leadTimeDaysMin} дн`
                      : "Под заказ"}
                </Badge>
                <Text size="sm">{priceRub.toLocaleString("ru-RU")} ₽ за штуку</Text>
              </Group>
            </Alert>

            <Group gap="sm" align="flex-end" wrap="nowrap">
              <NumberInput
                label="Количество"
                min={1}
                max={999}
                value={quantity}
                onChange={setQuantity}
                style={{ width: 120 }}
              />
              <Text size="sm" c="dimmed" pb={8}>
                Итого: <Text component="span" fw={800} c="var(--market-ink)">{total.toLocaleString("ru-RU")} ₽</Text>
              </Text>
            </Group>

            <TextInput required label="Ваше имя" placeholder="Иван" value={form.contactName} onChange={(event) => setForm({ ...form, contactName: event.currentTarget.value })} />
            <TextInput required label="Телефон" placeholder="+7 900 000-00-00" description="По нему магазин подтвердит заказ" value={form.contactPhone} onChange={(event) => setForm({ ...form, contactPhone: event.currentTarget.value })} />
            <Group gap="sm" grow>
              <TextInput label="Email" placeholder="ivan@example.ru" value={form.contactEmail} onChange={(event) => setForm({ ...form, contactEmail: event.currentTarget.value })} />
              <TextInput label="Город доставки" placeholder="Москва" value={form.city} onChange={(event) => setForm({ ...form, city: event.currentTarget.value })} />
            </Group>
            <Textarea label="Комментарий" placeholder="VIN автомобиля, уточнения по детали" autosize minRows={2} value={form.comment} onChange={(event) => setForm({ ...form, comment: event.currentTarget.value })} />

            {error && <Alert color="red" variant="light">{error}</Alert>}

            <Text size="xs" c="dimmed">
              Заказ — это обращение к магазину, а не оплаченная покупка. Цену, наличие и условия доставки
              продавец подтверждает при связи с вами.
            </Text>

            <Group gap="xs" justify="flex-end">
              <Button variant="subtle" color="gray" onClick={close}>Отмена</Button>
              <Button
                color="indigo"
                onClick={submit}
                loading={state === "sending"}
                disabled={form.contactName.trim().length < 2 || form.contactPhone.replace(/\D/g, "").length < 10}
              >
                Отправить заказ
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </>
  )
}
