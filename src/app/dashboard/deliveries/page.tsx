"use client"

import { FormEvent, Suspense, useEffect, useState } from "react"
import useSWR from "swr"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Badge, Box, Button, Center, Group, Loader, Modal, Paper, Progress, Select, SimpleGrid, Stack, Text, TextInput, Textarea, ThemeIcon, Title } from "@mantine/core"
import { notifications } from "@mantine/notifications"
import { IconArrowRight, IconCar, IconChevronRight, IconFileInvoice, IconMapPin, IconPackage, IconPlus, IconRoute, IconShieldCheck, IconTruckDelivery } from "@tabler/icons-react"
import { DELIVERY_COUNTRIES, DELIVERY_STATUS_META, deliveryProgress } from "@/lib/delivery"

const fetcher = async (url: string) => {
  const response = await fetch(url)
  if (!response.ok) throw new Error("Не удалось загрузить данные")
  return response.json()
}

const sourceOptions = [
  { value: "AUCTION", label: "Аукцион" },
  { value: "DIRECT_IMPORT", label: "Прямой импорт" },
  { value: "PARTS_ORDER", label: "Запчасть под заказ" },
]

export default function DeliveriesPage() {
  return <Suspense fallback={<Center py={100}><Loader color="indigo" /></Center>}><DeliveriesWorkspace /></Suspense>
}

function DeliveriesWorkspace() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data, error, isLoading, mutate } = useSWR("/api/delivery-orders", fetcher)
  const [opened, setOpened] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ title: "", kind: "VEHICLE", sourceType: "AUCTION", originCountry: "CN", destinationCity: "", originCity: "", description: "", auctionListingId: "" })

  useEffect(() => {
    const auctionListingId = searchParams.get("auctionListingId")
    if (!auctionListingId || form.auctionListingId === auctionListingId) return

    fetch(`/api/auctions/${auctionListingId}`)
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => {
        const listing = payload?.listing
        if (!listing) return
        const originCountry = DELIVERY_COUNTRIES.some((country) => country.value === listing.country) ? listing.country : "OTHER"
        setForm((current) => ({
          ...current,
          auctionListingId,
          title: `${listing.make} ${listing.model} ${listing.year}${listing.lotNumber ? ` · лот ${listing.lotNumber}` : ""}`,
          originCountry,
          originCity: listing.location || "",
          sourceType: "AUCTION",
        }))
        setOpened(true)
      })
      .catch(() => undefined)
  }, [form.auctionListingId, searchParams])

  const createOrder = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    try {
      const response = await fetch("/api/delivery-orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Не удалось создать заявку")
      notifications.show({ title: "Заявка создана", message: "Сделка появилась в вашем кабинете. Счёт появится только после согласования условий.", color: "teal" })
      await mutate()
      router.push(`/dashboard/deliveries/${payload.order.id}`)
    } catch (err: any) {
      notifications.show({ title: "Не удалось создать заявку", message: err.message || "Попробуйте ещё раз", color: "red" })
    } finally {
      setSubmitting(false)
    }
  }

  if (isLoading) return <Center py={100}><Loader color="indigo" /></Center>
  if (error) return <Center py={100}><Text c="red">Не удалось загрузить сделки. Обновите страницу.</Text></Center>

  const orders = data?.orders || []
  const summary = data?.summary || { total: 0, active: 0, pendingPayments: 0, needsAttention: 0 }

  return (
    <Box p={{ base: "sm", md: "lg" }}>
      <Stack gap="md">
        <Paper radius="lg" p={{ base: "md", md: "xl" }} style={{ color: "white", overflow: "hidden", background: "linear-gradient(126deg, #0c1834 0%, #182f64 52%, #5146c9 100%)", boxShadow: "0 18px 42px rgba(25, 48, 103, .18)" }}>
          <Group justify="space-between" align="flex-start" wrap="wrap" gap="lg">
            <Stack gap="xs" maw={650}>
              <Group gap="xs"><ThemeIcon size={34} radius="md" variant="white" color="indigo"><IconRoute size={18} /></ThemeIcon><Badge color="indigo" variant="white">Кабинет сделки</Badge></Group>
              <Title order={1} fz={{ base: 25, md: 34 }} lh={1.08} ff="var(--font-display), sans-serif">Доставка без тёмных зон</Title>
              <Text c="rgba(255,255,255,.78)" size="sm" maw={590}>От заявки на аукционный автомобиль или запчасть до выдачи в вашем городе: этапы, счета, документы и общий чат — в одной защищённой сделке.</Text>
              <Group gap="xs" mt="xs"><Badge color="cyan" variant="light">Статусы с автором</Badge><Badge color="violet" variant="light">Отдельные платежи</Badge><Badge color="teal" variant="light">Закрытые документы</Badge></Group>
            </Stack>
            <Button onClick={() => setOpened(true)} color="white" c="indigo" leftSection={<IconPlus size={17} />} radius="md">Новая заявка</Button>
          </Group>
        </Paper>

        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
          <Metric label="Всего сделок" value={summary.total} icon={<IconPackage size={18} />} color="indigo" />
          <Metric label="В работе" value={summary.active} icon={<IconTruckDelivery size={18} />} color="blue" />
          <Metric label="Счета и квитанции" value={summary.pendingPayments} icon={<IconFileInvoice size={18} />} color="orange" />
          <Metric label="Требует внимания" value={summary.needsAttention} icon={<IconShieldCheck size={18} />} color={summary.needsAttention ? "red" : "teal"} />
        </SimpleGrid>

        <Group justify="space-between" align="center">
          <Stack gap={0}><Title order={2} fz="h3">Мои доставки</Title><Text size="sm" c="dimmed">Только сделки, в которых вы участвуете.</Text></Stack>
          {orders.length > 0 && <Button variant="light" color="indigo" size="xs" onClick={() => setOpened(true)} leftSection={<IconPlus size={14} />}>Создать</Button>}
        </Group>

        {orders.length === 0 ? (
          <Paper withBorder radius="lg" p="xl">
            <Center><Stack align="center" gap="sm" maw={420}><ThemeIcon size={54} radius="xl" variant="light" color="indigo"><IconTruckDelivery size={28} /></ThemeIcon><Text fw={700}>Пока нет заявок на доставку</Text><Text size="sm" c="dimmed" ta="center">Создайте первую заявку. Менеджер сначала согласует маршрут и партнёра — реквизиты для оплаты не появляются автоматически.</Text><Button onClick={() => setOpened(true)} leftSection={<IconPlus size={16} />} color="indigo">Создать заявку</Button></Stack></Center>
          </Paper>
        ) : (
          <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }} spacing="sm">
            {orders.map((order: any) => {
              const meta = DELIVERY_STATUS_META[order.status as keyof typeof DELIVERY_STATUS_META] || DELIVERY_STATUS_META.REQUEST_CREATED
              return <Paper key={order.id} component={Link} href={`/dashboard/deliveries/${order.id}`} withBorder radius="lg" p="md" style={{ textDecoration: "none", color: "inherit", transition: "transform .18s ease, box-shadow .18s ease" }}>
                <Stack gap="sm">
                  <Group justify="space-between" gap="xs" wrap="nowrap"><Badge variant="light" color={meta.color}>{meta.shortLabel}</Badge><Text size="xs" c="dimmed" fw={600}>{order.code}</Text></Group>
                  <Stack gap={2}><Text fw={800} lineClamp={2}>{order.title}</Text><Text size="xs" c="dimmed">{order.kind === "PART" ? "Запчасть" : "Транспорт"} · {order.sourceType === "AUCTION" ? "аукцион" : order.sourceType === "PARTS_ORDER" ? "под заказ" : "прямой импорт"}</Text></Stack>
                  <Group gap={6} wrap="nowrap"><IconMapPin size={15} color="#64748b" /><Text size="sm" c="dimmed" lineClamp={1}>{countryLabel(order.originCountry)}{order.originCity ? `, ${order.originCity}` : ""}</Text><IconArrowRight size={14} color="#94a3b8" /><Text size="sm" fw={600} lineClamp={1}>{order.destinationCity}</Text></Group>
                  <Box><Group justify="space-between" mb={4}><Text size="xs" c="dimmed">{meta.label}</Text><Text size="xs" fw={700}>{deliveryProgress(order.status)}%</Text></Group><Progress value={deliveryProgress(order.status)} color={meta.color} size="sm" radius="xl" /></Box>
                  <Group justify="space-between"><Text size="xs" c="dimmed" lineClamp={1}>{order.nextAction || meta.description}</Text><IconChevronRight size={17} color="#64748b" /></Group>
                </Stack>
              </Paper>
            })}
          </SimpleGrid>
        )}
      </Stack>

      <Modal opened={opened} onClose={() => setOpened(false)} title="Заявка на международную доставку" centered radius="lg">
        <form onSubmit={createOrder}><Stack gap="sm">
          <Text size="sm" c="dimmed">Это заявка на сопровождение, а не платёж. Сначала согласуем маршрут, партнёра и документы.</Text>
          {form.auctionListingId && <Badge color="orange" variant="light">Выбран лот аукциона — он будет привязан к сделке</Badge>}
          <TextInput required label="Что нужно доставить" placeholder="Например, Toyota RAV4 2023, лот 1842" value={form.title} onChange={(e) => setForm({ ...form, title: e.currentTarget.value })} />
          <SimpleGrid cols={2}><Select label="Тип" data={[{ value: "VEHICLE", label: "Транспорт" }, { value: "PART", label: "Запчасть" }]} value={form.kind} onChange={(value) => setForm({ ...form, kind: value || "VEHICLE" })} /><Select label="Источник" data={sourceOptions} value={form.sourceType} onChange={(value) => setForm({ ...form, sourceType: value || "AUCTION" })} /></SimpleGrid>
          <SimpleGrid cols={2}><Select required label="Страна отправления" data={DELIVERY_COUNTRIES} value={form.originCountry} onChange={(value) => setForm({ ...form, originCountry: value || "CN" })} /><TextInput label="Город / порт отправления" placeholder="Например, Суйфэньхэ" value={form.originCity} onChange={(e) => setForm({ ...form, originCity: e.currentTarget.value })} /></SimpleGrid>
          <TextInput required label="Город доставки в России" placeholder="Например, Екатеринбург" value={form.destinationCity} onChange={(e) => setForm({ ...form, destinationCity: e.currentTarget.value })} />
          <Textarea label="Комментарий" placeholder="Нужен маршрут, бюджет, номер лота, особые условия" minRows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.currentTarget.value })} />
          <Button type="submit" loading={submitting} color="indigo" rightSection={<IconArrowRight size={16} />}>Создать защищённую сделку</Button>
        </Stack></form>
      </Modal>
    </Box>
  )
}

function Metric({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return <Paper withBorder radius="lg" p="sm"><Group gap="sm"><ThemeIcon variant="light" color={color} radius="md" size={38}>{icon}</ThemeIcon><Stack gap={0}><Text fw={800} fz="lg">{value}</Text><Text size="xs" c="dimmed">{label}</Text></Stack></Group></Paper>
}

function countryLabel(code: string) {
  return DELIVERY_COUNTRIES.find((country) => country.value === code)?.label || code
}
