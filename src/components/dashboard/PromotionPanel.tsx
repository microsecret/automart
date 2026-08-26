"use client"

import Link from "next/link"
import { ActionIcon, Badge, Button, Center, Group, Paper, SimpleGrid, Stack, Text, ThemeIcon } from "@mantine/core"
import { IconCreditCard, IconExternalLink, IconReceipt, IconTrendingUp } from "@tabler/icons-react"
import { PROMOTION_TARIFFS } from "@/lib/promotion-tariffs"

export type PromotionOrder = {
  id: string
  tariffId: string
  amountRub: number
  durationDays: number
  status: string
  provider: string
  promoUntil: string | null
  paidAt: string | null
  createdAt: string
  listing: { id: string; title: string; status: string }
}

type PromotionPanelProps = {
  spentRub: number
  activePromotions: number
  paidCount: number
  orders: PromotionOrder[]
  onViewListings: () => void
}

const PROMOTION_STATUS_META: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Ожидает оплаты", color: "yellow" },
  PAID: { label: "Оплачено", color: "teal" },
  FAILED: { label: "Ошибка оплаты", color: "red" },
  CANCELED: { label: "Отменено", color: "gray" },
  REFUNDED: { label: "Возврат", color: "blue" },
  REVIEW_REQUIRED: { label: "Нужна проверка", color: "orange" },
}

const PROMOTION_TARIFF_LABELS: Record<string, string> = {
  boost: "Поднятие в топ",
  premium: "Премиум",
  vip: "VIP-размещение",
}

const formatRubles = (value: number) => new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
}).format(value)

const formatOrderDate = (value: string) => new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "medium",
  timeStyle: "short",
}).format(new Date(value))

export default function PromotionPanel({ spentRub, activePromotions, paidCount, orders, onViewListings }: PromotionPanelProps) {
  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
        <Paper radius="md" p="md" withBorder>
          <Group gap="sm" wrap="nowrap">
            <ThemeIcon color="indigo" variant="light" size={40} radius="md"><IconCreditCard size={20} /></ThemeIcon>
            <Stack gap={1}>
              <Text size="xs" c="dimmed">Оплачено за продвижение</Text>
              <Text fw={800} fz="xl">{formatRubles(spentRub)}</Text>
            </Stack>
          </Group>
        </Paper>
        <Paper radius="md" p="md" withBorder>
          <Group gap="sm" wrap="nowrap">
            <ThemeIcon color="teal" variant="light" size={40} radius="md"><IconTrendingUp size={20} /></ThemeIcon>
            <Stack gap={1}>
              <Text size="xs" c="dimmed">Активные продвижения</Text>
              <Text fw={800} fz="xl">{activePromotions}</Text>
            </Stack>
          </Group>
        </Paper>
        <Paper radius="md" p="md" withBorder>
          <Group gap="sm" wrap="nowrap">
            <ThemeIcon color="violet" variant="light" size={40} radius="md"><IconReceipt size={20} /></ThemeIcon>
            <Stack gap={1}>
              <Text size="xs" c="dimmed">Успешные оплаты</Text>
              <Text fw={800} fz="xl">{paidCount}</Text>
            </Stack>
          </Group>
        </Paper>
      </SimpleGrid>

      <Paper radius="md" p={{ base: "md", md: "lg" }} withBorder>
        <Group justify="space-between" align="flex-start" mb="md" gap="sm">
          <Stack gap={1}>
            <Text fw={800} fz="lg">История продвижений</Text>
            <Text size="sm" c="dimmed">Здесь отображаются только реальные заказы и подтверждённые платежи.</Text>
          </Stack>
          <Button component={Link} href="/dashboard?tab=listings" variant="light" color="indigo" size="sm" leftSection={<IconTrendingUp size={16} />}>Выбрать объявление</Button>
        </Group>

        {orders.length === 0 ? (
          /* Пустое состояние показывает тарифы, а не бухгалтерию.

             Прежний текст «после настройки платёжного провайдера» был
             языком разработчика: раздел, куда продавец заходит узнать про
             продвижение, не называл ни цен, ни выгоды — и не продавал. */
          <Stack gap="md" py="sm">
            <Stack align="center" gap={4} ta="center">
              <Text fw={700}>Поднимите объявление — его увидят первым</Text>
              <Text size="sm" c="dimmed" maw={460}>
                Продвинутые объявления показываются выше в поиске. Оплата картой, включение сразу после оплаты.
              </Text>
            </Stack>
            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
              {Object.values(PROMOTION_TARIFFS).map((tariff) => (
                <Paper key={tariff.id} radius="md" p="md" withBorder>
                  <Stack gap={4}>
                    <Text fw={800} fz="sm">{tariff.title}</Text>
                    <Text fw={800} fz="lg" c="indigo" ff="var(--font-display),sans-serif">
                      {tariff.amountRub.toLocaleString("ru-RU")} ₽
                    </Text>
                    <Text size="xs" c="dimmed">{tariff.durationDays} дн. · {tariff.description}</Text>
                  </Stack>
                </Paper>
              ))}
            </SimpleGrid>
            <Center>
              <Button onClick={onViewListings} color="indigo" size="sm" leftSection={<IconTrendingUp size={16} />}>
                Выбрать объявление для продвижения
              </Button>
            </Center>
          </Stack>
        ) : (
          <Stack gap="xs">
            {orders.map((order) => {
              const status = PROMOTION_STATUS_META[order.status] || { label: order.status, color: "gray" }
              return (
                <Paper key={order.id} radius="md" p="sm" withBorder>
                  <Group justify="space-between" align="center" gap="md" wrap="wrap">
                    <Stack gap={2} style={{ flex: 1, minWidth: 220 }}>
                      <Group gap="xs">
                        <Text fw={700} size="sm">{order.listing.title}</Text>
                        <Badge size="xs" color={status.color} variant="light">{status.label}</Badge>
                      </Group>
                      <Text size="xs" c="dimmed">
                        Тариф «{PROMOTION_TARIFF_LABELS[order.tariffId] || order.tariffId}» · {order.durationDays} дн. · заказ от {formatOrderDate(order.createdAt)}
                      </Text>
                      {order.promoUntil && <Text size="xs" c="teal.7">Продвижение до {formatOrderDate(order.promoUntil)}</Text>}
                    </Stack>
                    <Group gap="xs">
                      <Text fw={800}>{formatRubles(order.amountRub)}</Text>
                      <ActionIcon component={Link} href={`/listings/${order.listing.id}/promote`} color="indigo" variant="subtle" aria-label={`Открыть продвижение ${order.listing.title}`}><IconExternalLink size={17} /></ActionIcon>
                    </Group>
                  </Group>
                </Paper>
              )
            })}
          </Stack>
        )}
      </Paper>
    </Stack>
  )
}
