"use client"
export const dynamic = "force-dynamic"
import { useState, Suspense } from "react"
import { useParams } from "next/navigation"
import useSWR from "swr"
import Link from "next/link"
import { Container, Stack, Group, Text, Paper, Box, Badge, Button, SimpleGrid, Divider, TextInput, Textarea, ThemeIcon, Center, Loader, Breadcrumbs, Anchor } from "@mantine/core"
import { IconGavel, IconCheck, IconMapPin, IconCalendar, IconGauge, IconCar, IconGasStation, IconManualGearbox, IconPalette, IconChevronRight, IconShieldCheck, IconTruckDelivery } from "@tabler/icons-react"
import { notifications } from "@mantine/notifications"
import { formatPrice } from "@/lib/format"
import AuctionCalculator from "@/components/auctions/AuctionCalculator"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

function AuctionDetail() {
  const params = useParams()
  const id = params.id as string
  const { data, isLoading } = useSWR(`/api/auctions/${id}`, fetcher)
  const [form, setForm] = useState({ name: "", phone: "", email: "", city: "", comment: "" })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const listing = data?.listing

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.phone) return
    setSubmitting(true)
    try {
      await fetch(`/api/auctions/${id}/inquiry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      setSubmitted(true)
      notifications.show({ title: "Заявка отправлена!", message: "Менеджер свяжется с вами в течение 1 часа", color: "green" })
    } catch {
      notifications.show({ title: "Ошибка", message: "Попробуйте ещё раз", color: "red" })
    } finally { setSubmitting(false) }
  }

  if (isLoading) return <Container py={80}><Center><Loader size="sm" color="orange" /></Center></Container>
  if (!listing) return <Container py={80}><Center><Text c="gray.5">Лот не найден</Text></Center></Container>

  const COUNTRY_LABELS: Record<string, string> = { JP: "🇯🇵 Япония", KR: "🇰🇷 Корея", US: "🇺🇸 США", DE: "🇩🇪 Германия", CN: "🇨🇳 Китай", AE: "🇦🇪 ОАЭ", EU: "🇪🇺 Европа" }

  return (
    <Container size="xl" py="lg">
      <Stack gap="md">
        <Breadcrumbs separator={<IconChevronRight size={14} color="gray.4" />}>
          <Anchor component={Link} href="/" size="sm" c="gray.5">Главная</Anchor>
          <Anchor component={Link} href="/auctions" size="sm" c="gray.5">Аукционы</Anchor>
          <Text size="sm" c="dark.9">{listing.make} {listing.model}</Text>
        </Breadcrumbs>

        <Group gap="md" align="flex-start" wrap="nowrap">
          {/* Левая — фото + характеристики */}
          <Box style={{ flex: 1, minWidth: 0 }}>
            <Stack gap="md">
              <Paper radius="md" withBorder style={{ overflow: "hidden" }}>
                <Box style={{ position: "relative", background: "var(--mantine-color-gray-1)", aspectRatio: "16/10" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={listing.imageUrl || "/placeholder.svg"} alt={listing.make} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <Badge pos="absolute" top={16} left={16} color="orange" variant="filled" size="lg">{listing.source} · {listing.lotNumber}</Badge>
                  <Badge pos="absolute" top={16} right={16} color="dark" variant="filled" size="lg">{COUNTRY_LABELS[listing.country] || listing.country}</Badge>
                </Box>
              </Paper>

              <Paper radius="md" p="md" withBorder>
                <Stack gap="sm">
                  <Group gap="sm"><IconCar size={18} color="#4f46e5" /><Text fw={700} c="dark.9">Характеристики</Text></Group>
                  <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="xs">
                    <SpecRow icon={<IconCalendar size={16} />} label="Год" value={String(listing.year)} />
                    {listing.mileage && <SpecRow icon={<IconGauge size={16} />} label="Пробег" value={`${listing.mileage.toLocaleString("ru")} км`} />}
                    {listing.fuelType && <SpecRow icon={<IconGasStation size={16} />} label="Топливо" value={listing.fuelType} />}
                    {listing.transmission && <SpecRow icon={<IconManualGearbox size={16} />} label="КПП" value={listing.transmission} />}
                    {listing.bodyType && <SpecRow icon={<IconCar size={16} />} label="Кузов" value={listing.bodyType} />}
                    {listing.color && <SpecRow icon={<IconPalette size={16} />} label="Цвет" value={listing.color} />}
                    {listing.engineVolume && <SpecRow icon={<IconCar size={16} />} label="Объём" value={`${listing.engineVolume} л`} />}
                    {listing.power && <SpecRow icon={<IconCar size={16} />} label="Мощность" value={`${listing.power} л.с.`} />}
                    {listing.location && <SpecRow icon={<IconMapPin size={16} />} label="Локация" value={listing.location} />}
                  </SimpleGrid>
                </Stack>
              </Paper>

              {listing.descriptionRu && (
                <Paper radius="md" p="md" withBorder>
                  <Stack gap="xs">
                    <Group gap="sm"><IconCheck size={18} color="#059669" /><Text fw={700} c="dark.9">Описание (ИИ-перевод)</Text></Group>
                    <Text size="sm" c="gray.6" lh={1.6}>{listing.descriptionRu}</Text>
                  </Stack>
                </Paper>
              )}

              {/* Умный калькулятор */}
              <AuctionCalculator
                make={listing.make}
                model={listing.model}
                year={listing.year}
                engineVolume={listing.engineVolume}
                power={listing.power}
                fuelType={listing.fuelType}
                sourcePrice={listing.sourcePrice}
                sourceCurrency={listing.sourceCurrency}
                priceRub={listing.priceRub}
                country={listing.country}
              />
            </Stack>
          </Box>

          {/* Правая — заявка */}
          <Box style={{ width: 340, flexShrink: 0 }}>
            <Paper radius="md" p="lg" withBorder style={{ position: "sticky", top: 80, borderColor: "#fed7aa", background: "linear-gradient(135deg, #fff7ed 0%, #fff 100%)" }}>
              {submitted ? (
                <Stack gap="md" align="center" py="md">
                  <ThemeIcon size={56} radius="xl" color="green" variant="light"><IconCheck size={28} /></ThemeIcon>
                  <Stack gap={0} align="center">
                    <Text fw={700} fz="lg" c="dark.9">Заявка отправлена!</Text>
                    <Text size="sm" c="gray.5" ta="center">Менеджер свяжется с вами<br />в течение 1 часа</Text>
                  </Stack>
                </Stack>
              ) : (
                <form onSubmit={handleSubmit}>
                  <Stack gap="sm">
                    <Group gap="sm"><IconGavel size={20} color="#ea580c" /><Text fw={800} fz="lg" c="dark.9">Заказать авто</Text></Group>
                    <Text size="xs" c="gray.5">{listing.make} {listing.model} · {listing.year} · {COUNTRY_LABELS[listing.country]}</Text>
                    <Button component={Link} href={`/dashboard/deliveries?auctionListingId=${listing.id}`} variant="light" color="indigo" radius="md" size="sm" leftSection={<IconTruckDelivery size={16} />} fullWidth>Открыть сделку в кабинете</Button>
                    <Text size="xs" c="gray.5" ta="center">Для отслеживания маршрута, счетов и документов после входа.</Text>
                    <TextInput label="Ваше имя" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} size="sm" />
                    <TextInput label="Телефон" required placeholder="+7 (___) ___-__-__" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} size="sm" />
                    <TextInput label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} size="sm" />
                    <TextInput label="Город доставки" placeholder="Москва" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} size="sm" />
                    <Textarea label="Комментарий" placeholder="Вопросы, пожелания..." value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} size="sm" minRows={2} />
                    <Button type="submit" color="orange" radius="md" size="md" loading={submitting} leftSection={<IconCheck size={18} />} fullWidth>Отправить заявку</Button>
                    <Group gap={6}><IconShieldCheck size={14} color="#059669" /><Text size="xs" c="gray.5">Без предоплаты. Консультация бесплатно.</Text></Group>
                    <Group gap={6}><IconTruckDelivery size={14} color="#4f46e5" /><Text size="xs" c="gray.5">Доставка во все регионы РФ</Text></Group>
                  </Stack>
                </form>
              )}
            </Paper>
          </Box>
        </Group>
      </Stack>
    </Container>
  )
}

function SpecRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Group gap="sm" justify="space-between">
      <Group gap={6}><Box c="gray.5">{icon}</Box><Text size="xs" c="gray.5">{label}</Text></Group>
      <Text size="xs" fw={600} c="dark.9">{value}</Text>
    </Group>
  )
}

export default function AuctionDetailPage() {
  return (
    <Suspense fallback={<Container py={80}><Center><Loader size="sm" color="orange" /></Center></Container>}>
      <AuctionDetail />
    </Suspense>
  )
}
