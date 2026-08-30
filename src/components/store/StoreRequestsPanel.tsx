"use client"

import { useState } from "react"
import useSWR from "swr"
import {
  Alert, Badge, Box, Button, Card, Group, Loader, Modal, NumberInput, Select, Stack, Text, Textarea, ThemeIcon,
} from "@mantine/core"
import { IconSearch, IconSend } from "@tabler/icons-react"
import { fetchJson } from "@/lib/api-client"

type PartRequest = {
  id: string
  partName: string | null
  oemNumber: string | null
  make: string | null
  model: string | null
  year: number | null
  condition: string
  comment: string | null
  city: string | null
  clarity: number
  status: string
  createdAt: string
  _count: { offers: number }
}

const CONDITION_LABELS: Record<string, string> = {
  NEW: "новая",
  USED: "б/у",
  ANY: "любая",
}

function formatAge(value: string) {
  const created = new Date(value)
  if (Number.isNaN(created.getTime())) return null
  const hours = Math.round((Date.now() - created.getTime()) / 3_600_000)
  if (hours < 1) return "только что"
  if (hours < 24) return `${hours} ч назад`
  const days = Math.round(hours / 24)
  return days === 1 ? "вчера" : `${days} дн назад`
}

/**
 * Заявки покупателей «ищу деталь» в кабинете магазина.
 *
 * Заявка была дорогой в один конец: форма обещала, что «магазины
 * увидят её и свяжутся в течение дня», человек оставлял телефон и
 * ждал. На деле заявка ложилась в базу и умирала — в кабинете магазина
 * её не было видно, уведомления тоже не приходило. Список на сервере
 * при этом давно написан, и его никто не запрашивал.
 *
 * Понятные заявки идут первыми: с номером детали продавец отвечает за
 * минуту, «фильтр на японку» требует переписки — вперемешку хорошие
 * заявки хоронятся под плохими. Порядок задаёт сервер.
 */
export default function StoreRequestsPanel() {
  const { data, error, isLoading, mutate } = useSWR<{ requests: PartRequest[] }>(
    "/api/parts/requests?limit=30",
    fetchJson,
    /* Заявки приходят в течение дня, а не ежеминутно: частый опрос
       здесь только дёргал бы сервер. */
    { revalidateOnFocus: true, dedupingInterval: 30_000 },
  )

  const [target, setTarget] = useState<PartRequest | null>(null)
  const [form, setForm] = useState({ price: "" as string | number, condition: "", leadTimeDays: "" as string | number, comment: "" })
  const [sending, setSending] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const requests = data?.requests || []

  const send = async () => {
    if (!target || sending) return
    setSending(true)
    setFormError(null)
    try {
      const response = await fetch(`/api/parts/requests/${target.id}/offers`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          price: form.price === "" ? null : Number(form.price),
          condition: form.condition || null,
          leadTimeDays: form.leadTimeDays === "" ? null : Number(form.leadTimeDays),
          comment: form.comment,
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        setFormError(typeof payload?.error === "string" ? payload.error : "Не удалось отправить предложение")
        return
      }
      setTarget(null)
      setForm({ price: "", condition: "", leadTimeDays: "", comment: "" })
      await mutate()
    } catch {
      setFormError("Нет связи с сервером. Попробуйте ещё раз.")
    } finally {
      setSending(false)
    }
  }

  return (
    <Card withBorder radius="md" p="md">
      <Group justify="space-between" align="flex-start" gap="md" mb="sm" wrap="wrap">
        <Group gap="sm">
          <ThemeIcon variant="light" color="indigo" size={34} radius="md"><IconSearch size={17} /></ThemeIcon>
          <Box>
            <Text fw={700} size="sm">Заявки покупателей</Text>
            <Text size="xs" c="dimmed">Люди ищут детали, которых нет в каталоге. Ответьте ценой и сроком.</Text>
          </Box>
        </Group>
        {requests.length > 0 && <Badge variant="light" color="indigo">{requests.length}</Badge>}
      </Group>

      {isLoading ? (
        <Group justify="center" py="lg"><Loader size="sm" /></Group>
      ) : error ? (
        <Stack align="center" py="lg" gap="sm">
          <Text size="sm" c="dimmed">Не удалось загрузить заявки</Text>
          <Button size="xs" variant="light" onClick={() => void mutate()}>Повторить</Button>
        </Stack>
      ) : requests.length === 0 ? (
        <Text size="sm" c="dimmed" py="sm">
          Пока никто не искал деталей. Заявки появятся здесь, как только покупатели их оставят.
        </Text>
      ) : (
        <Stack gap="xs">
          {requests.map((request) => {
            const age = formatAge(request.createdAt)
            const vehicle = [request.make, request.model, request.year].filter(Boolean).join(" ")
            return (
              <Card key={request.id} withBorder radius="md" p="sm">
                <Group justify="space-between" align="flex-start" gap="sm" wrap="nowrap">
                  <Box style={{ minWidth: 0, flex: 1 }}>
                    <Group gap={6} wrap="wrap" mb={2}>
                      <Text fw={700} size="sm">{request.partName || "Деталь без названия"}</Text>
                      {request.oemNumber && <Badge size="xs" variant="light" color="teal">{request.oemNumber}</Badge>}
                      <Badge size="xs" variant="outline" color="gray">{CONDITION_LABELS[request.condition] || "любая"}</Badge>
                    </Group>
                    {vehicle && <Text size="xs" c="dimmed">{vehicle}</Text>}
                    {request.comment && <Text size="xs" c="var(--market-ink)" mt={4} lineClamp={2}>{request.comment}</Text>}
                    <Text size="10px" c="dimmed" mt={4}>
                      {[request.city, age, request._count.offers > 0 ? `предложений: ${request._count.offers}` : null]
                        .filter(Boolean).join(" · ")}
                    </Text>
                  </Box>
                  <Button
                    size="compact-sm"
                    color="indigo"
                    leftSection={<IconSend size={14} />}
                    onClick={() => { setTarget(request); setFormError(null) }}
                  >
                    Ответить
                  </Button>
                </Group>
              </Card>
            )
          })}
        </Stack>
      )}

      {/* Форма предложения.

          Ничего обязательного: магазин отвечает тем, что знает. Но
          пустое предложение сервер не примет — человеку нужен хотя бы
          один ответ на его вопрос. */}
      <Modal
        opened={Boolean(target)}
        onClose={() => setTarget(null)}
        title={target?.partName || "Ответ на заявку"}
        centered
        closeOnClickOutside={false}
      >
        <Stack gap="sm">
          <Text size="xs" c="dimmed">
            Покупатель получит уведомление и увидит ваш магазин. Это не заказ — дальше вы договариваетесь напрямую.
          </Text>
          <Group gap="sm" grow>
            <NumberInput
              label="Цена, ₽"
              placeholder="Если знаете"
              min={1}
              value={form.price}
              onChange={(value) => setForm({ ...form, price: value })}
              thousandSeparator=" "
            />
            <NumberInput
              label="Срок, дней"
              placeholder="0 — в наличии"
              min={0}
              max={365}
              value={form.leadTimeDays}
              onChange={(value) => setForm({ ...form, leadTimeDays: value })}
            />
          </Group>
          <Select
            label="Состояние"
            placeholder="Не указано"
            data={[{ value: "NEW", label: "Новая" }, { value: "USED", label: "Б/у" }]}
            value={form.condition || null}
            onChange={(value) => setForm({ ...form, condition: value || "" })}
            clearable
          />
          <Textarea
            label="Пояснение"
            placeholder="Есть аналог, привезу под заказ, нужен VIN для подбора"
            minRows={3}
            value={form.comment}
            onChange={(event) => setForm({ ...form, comment: event.currentTarget.value.slice(0, 1000) })}
          />
          {formError && <Alert color="red" variant="light">{formError}</Alert>}
          <Group gap="xs" justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => setTarget(null)}>Отмена</Button>
            <Button color="indigo" loading={sending} onClick={() => void send()}>Отправить предложение</Button>
          </Group>
        </Stack>
      </Modal>
    </Card>
  )
}
