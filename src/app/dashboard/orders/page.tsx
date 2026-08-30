"use client"

import { useState } from "react"
import useSWR from "swr"
import Link from "next/link"
import {
  Alert, Badge, Box, Button, Card, Container, Group, Loader, Modal, Stack, Text, Textarea, ThemeIcon, Timeline, Title,
} from "@mantine/core"
import {
  IconBuildingStore, IconCheck, IconClipboardList, IconMail, IconPhone, IconTruckDelivery, IconX,
} from "@tabler/icons-react"
import { AsyncErrorState } from "@/components/ui/AsyncStates"
import { fetchJson } from "@/lib/api-client"

type BuyerOrder = {
  id: string
  itemName: string
  itemPriceRub: number
  itemOemNumber: string | null
  quantity: number
  leadTimeDaysMin: number | null
  leadTimeDaysMax: number | null
  status: string
  statusReason: string | null
  city: string | null
  comment: string | null
  createdAt: string
  updatedAt: string
  store: {
    name: string
    slug: string
    city: string | null
    contactPhone: string | null
    contactEmail: string | null
  } | null
}

const STATUS_META: Record<string, { label: string; color: string; hint: string }> = {
  NEW: { label: "Отправлен", color: "orange", hint: "Магазин получил заявку и скоро свяжется с вами." },
  CONFIRMED: { label: "Подтверждён", color: "blue", hint: "Наличие подтверждено, магазин готовит отправку." },
  IN_DELIVERY: { label: "В доставке", color: "violet", hint: "Заказ в пути. Срок уточняйте у магазина." },
  DONE: { label: "Завершён", color: "teal", hint: "Заказ закрыт магазином." },
  CANCELLED: { label: "Отменён", color: "gray", hint: "Магазин отменил заказ." },
}

// Порядок шагов показывает покупателю, где сейчас его заказ и что будет
// дальше: статус сам по себе не отвечает на вопрос «сколько ещё ждать».
const FLOW = ["NEW", "CONFIRMED", "IN_DELIVERY", "DONE"]

export default function BuyerOrdersPage() {
  const { data, error, isLoading, mutate } = useSWR<{ orders: BuyerOrder[] }>("/api/my-orders", fetchJson, { revalidateOnFocus: false })

  /* Отмена заказа покупателем.

     Раньше её не было вовсе: передумал, нашёл дешевле, ошибся с
     количеством — оставалось звонить в магазин и просить отменить, а
     пока продавец не нажмёт кнопку, заказ висел в работе.

     Причина обязательна: магазин по ней понимает, стоит ли предложить
     что-то взамен, и это та же причина, которую требуют от продавца
     при его отмене. */
  const [cancelTarget, setCancelTarget] = useState<BuyerOrder | null>(null)
  const [cancelReason, setCancelReason] = useState("")
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)

  const cancelOrder = async () => {
    if (!cancelTarget || cancelling) return
    setCancelling(true)
    setCancelError(null)
    try {
      const response = await fetch(`/api/part-orders/${cancelTarget.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED", statusReason: cancelReason.trim() }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        setCancelError(typeof payload?.error === "string" ? payload.error : "Не удалось отменить заказ")
        return
      }
      setCancelTarget(null)
      setCancelReason("")
      await mutate()
    } catch {
      setCancelError("Нет связи с сервером. Попробуйте ещё раз.")
    } finally {
      setCancelling(false)
    }
  }

  if (error) {
    return (
      <Container size="lg" py="xl">
        <AsyncErrorState title="Заказы недоступны" description="Не удалось загрузить список заказов." onRetry={() => mutate()} />
      </Container>
    )
  }

  if (isLoading) {
    return <Container size="lg" py="xl"><Group justify="center"><Loader /></Group></Container>
  }

  const orders = data?.orders || []

  return (
    <Container size="lg" py={{ base: "md", md: "xl" }}>
      <Stack gap="lg">
        <Group gap="sm" align="center">
          <ThemeIcon variant="light" color="indigo" size={44} radius="md"><IconClipboardList size={22} /></ThemeIcon>
          <Box>
            <Title order={1} size="h3" ff="var(--font-display),sans-serif">Мои заказы</Title>
            <Text size="sm" c="dimmed">Заказы запчастей из магазинов площадки.</Text>
          </Box>
        </Group>

        {orders.length === 0 ? (
          <Card withBorder radius="md" p="xl">
            <Stack align="center" gap="sm" ta="center" maw={460} mx="auto">
              <ThemeIcon variant="light" color="indigo" size={52} radius="md"><IconClipboardList size={26} /></ThemeIcon>
              <Text fw={700}>Заказов пока нет</Text>
              <Text size="sm" c="dimmed">
                Найдите деталь в каталоге запчастей и оформите заказ — он появится здесь вместе со статусом и контактами магазина.
              </Text>
              <Button component={Link} href="/parts-finder" color="indigo">Подобрать запчасть</Button>
            </Stack>
          </Card>
        ) : (
          <Stack gap="sm">
            {orders.map((order) => {
              const meta = STATUS_META[order.status] || STATUS_META.NEW
              const isCancelled = order.status === "CANCELLED"
              const activeStep = isCancelled ? -1 : FLOW.indexOf(order.status)
              return (
                <Card key={order.id} withBorder radius="md" p="md">
                  <Group justify="space-between" align="flex-start" gap="md" wrap="wrap">
                    <Box style={{ minWidth: 0, flex: 1 }}>
                      <Group gap="xs" wrap="wrap">
                        <Text fw={800}>{order.itemName}</Text>
                        <Badge variant="light" color={meta.color}>{meta.label}</Badge>
                        {order.quantity > 1 && <Badge variant="outline" color="gray">{order.quantity} шт</Badge>}
                      </Group>
                      <Text size="xs" c="dimmed" mt={2}>
                        {order.itemOemNumber ? `${order.itemOemNumber} · ` : ""}
                        {(order.itemPriceRub * order.quantity).toLocaleString("ru-RU")} ₽
                        {order.leadTimeDaysMin ? ` · срок ${order.leadTimeDaysMin}–${order.leadTimeDaysMax || order.leadTimeDaysMin} дн` : ""}
                      </Text>
                      <Text size="sm" c="dimmed" mt={6}>{meta.hint}</Text>
                      {order.statusReason && (
                        <Alert color="red" variant="light" mt="sm" icon={<IconX size={15} />}>{order.statusReason}</Alert>
                      )}
                      {/* Отменить можно, пока заказ не уехал: после
                          отправки товар уже в пути, и решение остаётся
                          за магазином. */}
                      {(order.status === "NEW" || order.status === "CONFIRMED") && (
                        <Button
                          size="compact-sm"
                          variant="subtle"
                          color="red"
                          mt="sm"
                          leftSection={<IconX size={14} />}
                          onClick={() => { setCancelTarget(order); setCancelReason(""); setCancelError(null) }}
                        >
                          Отменить заказ
                        </Button>
                      )}
                    </Box>

                    {order.store && (
                      <Card withBorder radius="md" p="sm" miw={{ base: 0, sm: 240 }}>
                        <Group gap={6} mb={4}>
                          <IconBuildingStore size={14} />
                          <Text size="sm" fw={700}>{order.store.name}</Text>
                        </Group>
                        {order.store.contactEmail && (
                          <Group gap={5} mt={2}><IconMail size={13} /><Text size="xs" c="dimmed">{order.store.contactEmail}</Text></Group>
                        )}
                        {/* Звонок — то, ради чего человек сюда смотрит:
                            заказ едет, и вопрос «где он» решается голосом.
                            Телефон был мелкой строкой в десять пикселей,
                            по которой пальцем не попасть, а полноширинная
                            кнопка вела на витрину — разглядывать её в этот
                            момент незачем. */}
                        {order.store.contactPhone && (
                          <Button
                            component="a"
                            href={`tel:${order.store.contactPhone.replace(/[^\d+]/g, "")}`}
                            size="sm"
                            variant="light"
                            color="teal"
                            leftSection={<IconPhone size={16} />}
                            mt={8}
                            fullWidth
                          >
                            Позвонить
                          </Button>
                        )}
                        <Button component={Link} href={`/store/${order.store.slug}`} size="compact-sm" variant="subtle" color="indigo" mt={6} fullWidth>
                          Витрина магазина
                        </Button>
                      </Card>
                    )}
                  </Group>

                  {!isCancelled && (
                    <Timeline active={activeStep} bulletSize={18} lineWidth={2} mt="md">
                      <Timeline.Item bullet={<IconClipboardList size={10} />} title="Отправлен" />
                      <Timeline.Item bullet={<IconCheck size={10} />} title="Подтверждён" />
                      <Timeline.Item bullet={<IconTruckDelivery size={10} />} title="В доставке" />
                      <Timeline.Item bullet={<IconCheck size={10} />} title="Завершён" />
                    </Timeline>
                  )}

                  {/* Дата последнего движения. Заказ мог висеть
                      «подтверждён» неделю, и человек не понимал, вчера
                      это случилось или месяц назад: шкала шагов
                      показывает, где заказ, но не когда он туда попал —
                      а именно это решает, звонить сейчас или подождать. */}
                  <Text size="10px" c="dimmed" mt="sm">
                    Оформлен {new Date(order.createdAt).toLocaleString("ru-RU")}
                    {order.updatedAt !== order.createdAt && (
                      <> · {meta.label.toLowerCase()} {new Date(order.updatedAt).toLocaleString("ru-RU")}</>
                    )}
                  </Text>
                </Card>
              )
            })}
          </Stack>
        )}
      </Stack>

      {/* Подтверждение отмены.

          Отмена необратима — заказ из неё уже не вернуть, — поэтому она
          спрашивает причину и не закрывается промахом мимо окна. */}
      <Modal
        opened={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        title="Отменить заказ"
        centered
        closeOnClickOutside={false}
      >
        <Stack gap="sm">
          <Text size="sm">
            {cancelTarget ? `«${cancelTarget.itemName}»` : ""} — заказ будет отменён, и магазин получит уведомление.
          </Text>
          <Textarea
            label="Причина отмены"
            description="Магазин по ней поймёт, стоит ли предложить что-то взамен"
            placeholder="Нашёл дешевле, ошибся с количеством, передумал"
            minRows={3}
            value={cancelReason}
            onChange={(event) => setCancelReason(event.currentTarget.value.slice(0, 500))}
          />
          {cancelError && <Alert color="red" variant="light">{cancelError}</Alert>}
          <Group gap="xs" justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => setCancelTarget(null)}>Не отменять</Button>
            <Button
              color="red"
              loading={cancelling}
              disabled={!cancelReason.trim()}
              onClick={() => void cancelOrder()}
            >
              Отменить заказ
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  )
}
