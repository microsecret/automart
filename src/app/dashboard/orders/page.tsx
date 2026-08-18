"use client"

import useSWR from "swr"
import Link from "next/link"
import {
  Alert, Badge, Box, Button, Card, Container, Group, Loader, Stack, Text, ThemeIcon, Timeline, Title,
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
          <Card withBorder radius="lg" p="xl">
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
                <Card key={order.id} withBorder radius="lg" p="md">
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
                    </Box>

                    {order.store && (
                      <Card withBorder radius="md" p="sm" miw={{ base: 0, sm: 240 }}>
                        <Group gap={6} mb={4}>
                          <IconBuildingStore size={14} />
                          <Text size="sm" fw={700}>{order.store.name}</Text>
                        </Group>
                        {order.store.contactPhone && (
                          <Group gap={5}><IconPhone size={13} /><Text size="xs" component="a" href={`tel:${order.store.contactPhone}`} style={{ color: "inherit" }}>{order.store.contactPhone}</Text></Group>
                        )}
                        {order.store.contactEmail && (
                          <Group gap={5} mt={2}><IconMail size={13} /><Text size="xs" c="dimmed">{order.store.contactEmail}</Text></Group>
                        )}
                        <Button component={Link} href={`/store/${order.store.slug}`} size="compact-xs" variant="light" color="indigo" mt={8} fullWidth>
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

                  <Text size="10px" c="dimmed" mt="sm">
                    Оформлен {new Date(order.createdAt).toLocaleString("ru-RU")}
                  </Text>
                </Card>
              )
            })}
          </Stack>
        )}
      </Stack>
    </Container>
  )
}
