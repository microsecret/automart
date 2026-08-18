"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"
import {
  Alert, Badge, Box, Button, Card, Group, Loader, Modal, SegmentedControl, Stack, Text, Textarea, ThemeIcon,
} from "@mantine/core"
import { IconClipboardList, IconPhone, IconMail, IconMapPin, IconX } from "@tabler/icons-react"
import { AsyncErrorState } from "@/components/ui/AsyncStates"
import { fetchJson } from "@/lib/api-client"

type Order = {
  id: string
  contactName: string
  contactPhone: string
  contactEmail: string | null
  city: string | null
  comment: string | null
  quantity: number
  itemName: string
  itemPriceRub: number
  itemOemNumber: string | null
  leadTimeDaysMin: number | null
  leadTimeDaysMax: number | null
  status: string
  sellerNotes: string | null
  createdAt: string
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  NEW: { label: "Новый", color: "orange" },
  CONFIRMED: { label: "Подтверждён", color: "blue" },
  IN_DELIVERY: { label: "В доставке", color: "violet" },
  DONE: { label: "Завершён", color: "teal" },
  CANCELLED: { label: "Отменён", color: "gray" },
}

// Следующий шаг всегда один: продавцу не нужно выбирать из списка статусов,
// достаточно подтвердить, что заказ продвинулся.
const NEXT_STEP: Record<string, { status: string; label: string } | null> = {
  NEW: { status: "CONFIRMED", label: "Подтвердить" },
  CONFIRMED: { status: "IN_DELIVERY", label: "Отправлен" },
  IN_DELIVERY: { status: "DONE", label: "Завершить" },
  DONE: null,
  CANCELLED: null,
}

const EMPTY_ORDERS: Order[] = []

export default function StoreOrdersPanel({ storeId }: { storeId: string }) {
  const { data, error, isLoading, mutate } = useSWR<{ orders: Order[] }>(
    `/api/part-orders?storeId=${storeId}`,
    fetchJson,
    { revalidateOnFocus: false },
  )
  const [filter, setFilter] = useState("ACTIVE")
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null)
  const [reason, setReason] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  // Пустой массив по умолчанию создаётся один раз: иначе `orders` менялся бы
  // на каждом рендере и пересчитывал фильтрацию впустую.
  const orders = useMemo(() => data?.orders || EMPTY_ORDERS, [data])
  const newCount = orders.filter((order) => order.status === "NEW").length

  const visible = useMemo(() => {
    if (filter === "ACTIVE") return orders.filter((order) => order.status !== "DONE" && order.status !== "CANCELLED")
    if (filter === "DONE") return orders.filter((order) => order.status === "DONE")
    return orders.filter((order) => order.status === "CANCELLED")
  }, [orders, filter])

  const changeStatus = async (order: Order, status: string, statusReason?: string) => {
    setIsSaving(true)
    setActionError(null)
    try {
      const response = await fetch(`/api/part-orders/${order.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status, statusReason }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        setActionError(typeof payload?.error === "string" ? payload.error : "Не удалось изменить статус")
        return
      }
      setCancelTarget(null)
      setReason("")
      await mutate()
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card withBorder radius="lg" p="md">
      <Group justify="space-between" align="flex-start" gap="md" mb="sm" wrap="wrap">
        <Group gap="sm">
          <ThemeIcon variant="light" color="orange" size={34} radius="md"><IconClipboardList size={17} /></ThemeIcon>
          <Box>
            <Group gap={6}>
              <Text fw={750} size="sm">Заказы покупателей</Text>
              {newCount > 0 && <Badge size="sm" variant="filled" color="orange">{newCount} новых</Badge>}
            </Group>
            <Text size="xs" c="dimmed">Свяжитесь по телефону, подтвердите наличие и срок.</Text>
          </Box>
        </Group>
        <SegmentedControl
          size="xs"
          value={filter}
          onChange={setFilter}
          data={[
            { value: "ACTIVE", label: "В работе" },
            { value: "DONE", label: "Завершены" },
            { value: "CANCELLED", label: "Отменены" },
          ]}
        />
      </Group>

      {actionError && <Alert color="red" variant="light" mb="sm">{actionError}</Alert>}

      {error ? (
        <AsyncErrorState title="Заказы недоступны" description="Не удалось загрузить список." onRetry={() => mutate()} />
      ) : isLoading ? (
        <Group justify="center" py="lg"><Loader size="sm" /></Group>
      ) : visible.length ? (
        <Stack gap="sm">
          {visible.map((order) => {
            const meta = STATUS_META[order.status] || STATUS_META.NEW
            const next = NEXT_STEP[order.status]
            return (
              <Card key={order.id} withBorder radius="md" p="sm" data-idle={order.status === "CANCELLED" || undefined} className="admin-queue-card">
                <Group justify="space-between" align="flex-start" gap="md" wrap="wrap">
                  <Box style={{ minWidth: 0, flex: 1 }}>
                    <Group gap="xs" wrap="wrap">
                      <Text fw={750} size="sm">{order.itemName}</Text>
                      <Badge size="sm" variant="light" color={meta.color}>{meta.label}</Badge>
                      {order.quantity > 1 && <Badge size="sm" variant="outline" color="gray">{order.quantity} шт</Badge>}
                    </Group>
                    <Text size="xs" c="dimmed" mt={2}>
                      {order.itemOemNumber ? `${order.itemOemNumber} · ` : ""}
                      {(order.itemPriceRub * order.quantity).toLocaleString("ru-RU")} ₽
                      {order.leadTimeDaysMin ? ` · срок ${order.leadTimeDaysMin}–${order.leadTimeDaysMax || order.leadTimeDaysMin} дн` : ""}
                    </Text>

                    {/* Контакты покупателя — главное в заказе: продавец должен
                        позвонить, а не искать номер в переписке. */}
                    <Group gap="sm" mt={8} wrap="wrap">
                      <Text size="sm" fw={700}>{order.contactName}</Text>
                      <Group gap={4}><IconPhone size={13} /><Text size="sm" component="a" href={`tel:${order.contactPhone}`} style={{ color: "inherit" }}>{order.contactPhone}</Text></Group>
                      {order.contactEmail && <Group gap={4}><IconMail size={13} /><Text size="xs" c="dimmed">{order.contactEmail}</Text></Group>}
                      {order.city && <Group gap={4}><IconMapPin size={13} /><Text size="xs" c="dimmed">{order.city}</Text></Group>}
                    </Group>

                    {order.comment && <Text size="xs" c="dimmed" mt={6}>Комментарий: {order.comment}</Text>}
                    <Text size="10px" c="dimmed" mt={6}>{new Date(order.createdAt).toLocaleString("ru-RU")}</Text>
                  </Box>

                  <Group gap="xs" wrap="wrap">
                    {next && (
                      <Button size="compact-sm" color="indigo" onClick={() => changeStatus(order, next.status)} loading={isSaving}>
                        {next.label}
                      </Button>
                    )}
                    {order.status !== "DONE" && order.status !== "CANCELLED" && (
                      <Button size="compact-sm" variant="light" color="red" leftSection={<IconX size={13} />} onClick={() => { setCancelTarget(order); setReason("") }}>
                        Отменить
                      </Button>
                    )}
                  </Group>
                </Group>
              </Card>
            )
          })}
        </Stack>
      ) : (
        <Text size="sm" c="dimmed">
          {filter === "ACTIVE" ? "Активных заказов нет. Новые появятся здесь сразу после оформления." : "В этом разделе пусто."}
        </Text>
      )}

      <Modal opened={Boolean(cancelTarget)} onClose={() => setCancelTarget(null)} title="Отменить заказ" centered>
        <Stack gap="sm">
          <Text size="sm">
            Заказ «{cancelTarget?.itemName}» будет отменён. Причина поможет покупателю понять, что произошло.
          </Text>
          <Textarea
            required
            label="Причина отмены"
            placeholder="Например: позиция закончилась у поставщика"
            autosize
            minRows={2}
            value={reason}
            onChange={(event) => setReason(event.currentTarget.value)}
          />
          <Group gap="xs" justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => setCancelTarget(null)}>Не отменять</Button>
            <Button
              color="red"
              disabled={reason.trim().length < 3}
              loading={isSaving}
              onClick={() => cancelTarget && changeStatus(cancelTarget, "CANCELLED", reason.trim())}
            >
              Отменить заказ
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Card>
  )
}
