"use client"
export const dynamic = "force-dynamic"
import { useEffect, useMemo, useState, Suspense } from "react"
import { useParams } from "next/navigation"
import useSWR from "swr"
import Link from "next/link"
import { Container, Stack, Group, Text, Paper, Box, Badge, Button, SimpleGrid, Divider, TextInput, Textarea, ThemeIcon, Center, Loader, Breadcrumbs, Anchor, Progress } from "@mantine/core"
import { useMediaQuery } from "@mantine/hooks"
import { IconGavel, IconCheck, IconMapPin, IconCalendar, IconGauge, IconCar, IconGasStation, IconManualGearbox, IconPalette, IconChevronRight, IconShieldCheck, IconTruckDelivery, IconX } from "@tabler/icons-react"
import { notifications } from "@mantine/notifications"
import AuctionCalculator from "@/components/auctions/AuctionCalculator"
import { fetchJson } from "@/lib/api-client"
import { AsyncErrorState } from "@/components/ui/AsyncStates"
import VehicleFallback from "@/components/listings/VehicleFallback"
import { isSafeMediaUrl, parseAuctionImages } from "@/lib/media-url"
import type { AuctionListing } from "@prisma/client"

type AuctionDetailResponse = { listing: AuctionListing }
type AuctionInquiryResponse = { success: true; inquiry: { id: string; createdAt: string } }

const AUCTION_VALUE_LABELS = {
  fuel: {
    GASOLINE: "Бензин",
    DIESEL: "Дизель",
    ELECTRIC: "Электро",
    HYBRID: "Гибрид",
    GAS: "Газ",
    OTHER: "Другое",
  },
  transmission: {
    MANUAL: "Механика",
    AUTOMATIC: "Автомат",
    VARIATOR: "Вариатор",
    ROBOTIC: "Роботизированная",
  },
  body: {
    SEDAN: "Седан",
    HATCHBACK: "Хэтчбек",
    SUV: "Кроссовер / внедорожник",
    COUPE: "Купе",
    CONVERTIBLE: "Кабриолет",
    WAGON: "Универсал",
    MINIVAN: "Минивэн",
    PICKUP: "Пикап",
    OTHER: "Другой",
  },
} as const

function auctionValueLabel(value: string, group: keyof typeof AUCTION_VALUE_LABELS) {
  const labels = AUCTION_VALUE_LABELS[group] as Record<string, string>
  return labels[value] || value
}

type AuctionEquipment = {
  totalReported: number | null
  items: Array<{ label: string; available: boolean }>
}

function parseAuctionEquipment(value: string | null): AuctionEquipment | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as { totalReported?: unknown; items?: unknown }
    const items = Array.isArray(parsed.items)
      ? parsed.items.flatMap((item) => {
          if (!item || typeof item !== "object") return []
          const record = item as { label?: unknown; available?: unknown }
          return typeof record.label === "string" && record.label.trim() && typeof record.available === "boolean"
            ? [{ label: record.label.trim(), available: record.available }]
            : []
        })
      : []
    if (!items.length) return null
    return { totalReported: typeof parsed.totalReported === "number" && Number.isInteger(parsed.totalReported) ? parsed.totalReported : null, items }
  } catch {
    return null
  }
}

type AuctionConditionInfo = {
  insuranceRecordCount: number | null
  inspectionSummary: string | null
  newCarComparisonPct: number | null
}

function parseAuctionConditionInfo(value: string | null): AuctionConditionInfo | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as { insuranceRecordCount?: unknown; inspectionSummary?: unknown; newCarComparisonPct?: unknown }
    const insuranceRecordCount = typeof parsed.insuranceRecordCount === "number" && Number.isInteger(parsed.insuranceRecordCount) && parsed.insuranceRecordCount >= 0
      ? parsed.insuranceRecordCount
      : null
    const inspectionSummary = typeof parsed.inspectionSummary === "string" && parsed.inspectionSummary.trim() ? parsed.inspectionSummary.trim() : null
    const newCarComparisonPct = typeof parsed.newCarComparisonPct === "number" && Number.isInteger(parsed.newCarComparisonPct) && parsed.newCarComparisonPct >= 0 && parsed.newCarComparisonPct <= 100
      ? parsed.newCarComparisonPct
      : null
    return insuranceRecordCount !== null || inspectionSummary || newCarComparisonPct !== null
      ? { insuranceRecordCount, inspectionSummary, newCarComparisonPct }
      : null
  } catch {
    return null
  }
}

function AuctionDetail() {
  const params = useParams()
  const id = params.id as string
  const { data, error, isLoading, mutate } = useSWR<AuctionDetailResponse>(
    `/api/auctions/${id}`,
    fetchJson<AuctionDetailResponse>,
  )
  const [form, setForm] = useState({ name: "", phone: "", email: "", city: "", comment: "" })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [failedImageUrls, setFailedImageUrls] = useState<Set<string>>(() => new Set())
  // Keep the detail usable even if a webview reports an unusual viewport to
  // CSS: the 340px enquiry panel must never squeeze the vehicle content.
  const hasWideAuctionLayout = useMediaQuery("(min-width: 62em)", false, { getInitialValueInEffect: false })

  const listing = data?.listing
  const listingImageUrl = listing?.imageUrl
  const listingImages = listing?.images
  const galleryImages = useMemo(() => Array.from(new Set([
    ...(isSafeMediaUrl(listingImageUrl) ? [listingImageUrl] : []),
    ...(parseAuctionImages(listingImages) || []),
  ])), [listingImageUrl, listingImages])
  const activeImage = galleryImages[activeImageIndex] || ""
  const equipment = listing ? parseAuctionEquipment(listing.equipment) : null
  const conditionInfo = listing ? parseAuctionConditionInfo(listing.conditionInfo) : null

  useEffect(() => {
    setActiveImageIndex(0)
    setFailedImageUrls(new Set())
  }, [listing?.id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.phone) return
    setSubmitting(true)
    try {
      await fetchJson<AuctionInquiryResponse>(`/api/auctions/${id}/inquiry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      setSubmitted(true)
      notifications.show({ title: "Заявка отправлена!", message: "Менеджер свяжется с вами в течение 1 часа", color: "green" })
    } catch (error) {
      notifications.show({
        title: "Не удалось отправить заявку",
        message: error instanceof Error ? error.message : "Проверьте соединение и попробуйте ещё раз",
        color: "red",
      })
    } finally { setSubmitting(false) }
  }

  if (isLoading) return <Container py={80}><Center><Loader size="sm" color="orange" /></Center></Container>
  if (error) return <Container py={80}><AsyncErrorState title="Лот недоступен" description="Возможно, он уже завершён или снят с публикации." onRetry={() => void mutate()} /></Container>
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

        <Box className="auction-detail-layout" style={hasWideAuctionLayout ? undefined : { gridTemplateColumns: "minmax(0, 1fr)" }}>
          {/* Левая — фото + характеристики */}
          <Box className="auction-detail-layout__main">
            <Stack gap="md">
              <Paper radius="md" withBorder style={{ overflow: "hidden" }}>
                <Box style={{ position: "relative", background: "var(--mantine-color-gray-1)", aspectRatio: "16/10" }}>
                  <VehicleFallback type="CAR" />
                  {activeImage && !failedImageUrls.has(activeImage) && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={activeImage} alt={`${listing.make} ${listing.model}, фото ${activeImageIndex + 1}`} onError={() => setFailedImageUrls((previous) => new Set(previous).add(activeImage))} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                  )}
                  <Badge pos="absolute" top={16} left={16} color="orange" variant="filled" size="lg">{listing.lotNumber ? `${listing.source} · ${listing.lotNumber}` : listing.source}</Badge>
                  <Badge pos="absolute" top={16} right={16} color="dark" variant="filled" size="lg">{COUNTRY_LABELS[listing.country] || listing.country}</Badge>
                </Box>
                {galleryImages.length > 1 && (
                  <Box p="sm" style={{ borderTop: "1px solid var(--mantine-color-gray-2)" }}>
                    <Group gap="xs" wrap="nowrap" style={{ overflowX: "auto", paddingBottom: 2 }}>
                      {galleryImages.map((image, index) => (
                        <button
                          key={image}
                          type="button"
                          onClick={() => setActiveImageIndex(index)}
                          aria-label={`Показать фото ${index + 1}`}
                          aria-current={index === activeImageIndex ? "true" : undefined}
                          style={{ flex: "0 0 auto", width: 76, height: 56, padding: 0, border: index === activeImageIndex ? "2px solid var(--mantine-color-orange-6)" : "1px solid var(--mantine-color-gray-3)", borderRadius: 8, background: "var(--mantine-color-gray-1)", overflow: "hidden", cursor: "pointer" }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={image} alt="" loading="lazy" onError={(event) => { event.currentTarget.style.opacity = "0.25" }} style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }} />
                        </button>
                      ))}
                    </Group>
                    <Text size="xs" c="dimmed" mt={6}>Фото {activeImageIndex + 1} из {galleryImages.length}</Text>
                  </Box>
                )}
              </Paper>

              <Paper radius="md" p="md" withBorder>
                <Stack gap="sm">
                  <Group gap="sm"><IconCar size={18} color="#4f46e5" /><Text fw={700} c="dark.9">Характеристики</Text></Group>
                  <SimpleGrid className="auction-detail-specs" cols={{ base: 1, sm: 2, md: 3 }} spacing="xs">
                    <SpecRow icon={<IconCalendar size={16} />} label="Выпуск" value={listing.manufacturedMonth ? `${listing.manufacturedMonth.slice(5)}.${listing.manufacturedMonth.slice(0, 4)}` : String(listing.year)} />
                    {listing.mileage && <SpecRow icon={<IconGauge size={16} />} label="Пробег" value={`${listing.mileage.toLocaleString("ru")} км`} />}
                    {listing.fuelType && <SpecRow icon={<IconGasStation size={16} />} label="Топливо" value={auctionValueLabel(listing.fuelType, "fuel")} />}
                    {listing.transmission && <SpecRow icon={<IconManualGearbox size={16} />} label="КПП" value={auctionValueLabel(listing.transmission, "transmission")} />}
                    {listing.bodyType && <SpecRow icon={<IconCar size={16} />} label="Кузов" value={auctionValueLabel(listing.bodyType, "body")} />}
                    {listing.color && <SpecRow icon={<IconPalette size={16} />} label="Цвет" value={listing.color} />}
                    {listing.engineVolume && <SpecRow icon={<IconCar size={16} />} label="Объём" value={`${listing.engineVolume} л`} />}
                    <SpecRow icon={<IconCar size={16} />} label="Мощность" value={listing.power ? `${listing.power} л.с.` : "Не опубликована источником"} />
                    {listing.location && <SpecRow icon={<IconMapPin size={16} />} label="Локация" value={listing.location} />}
                  </SimpleGrid>
                  <Group gap={6} mt={2}>
                    <Text size="xs" c="dimmed">Данные автомобиля:</Text>
                    <Anchor href={listing.sourceUrl} target="_blank" rel="noreferrer" size="xs" fw={600}>
                      Открыть оригинальное объявление на {listing.source}
                    </Anchor>
                  </Group>
                </Stack>
              </Paper>

              {equipment && (
                <Paper radius="md" p="md" withBorder style={{ background: "linear-gradient(135deg, #f8fafc 0%, #fff 56%)" }}>
                  <Stack gap="sm">
                    <Group justify="space-between" align="flex-start" gap="sm" wrap="wrap">
                      <Group gap="sm"><ThemeIcon variant="light" color="indigo" radius="md"><IconCheck size={18} /></ThemeIcon><Box><Text fw={750} c="dark.9">Оснащение автомобиля</Text><Text size="xs" c="dimmed">Ключевые опции, отмеченные в открытой карточке {listing.source}</Text></Box></Group>
                      {equipment.totalReported && <Badge variant="light" color="indigo">В источнике: {equipment.totalReported} опции</Badge>}
                    </Group>
                    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
                      {equipment.items.map((item) => (
                        <Group key={item.label} gap="sm" justify="space-between" wrap="nowrap" p="xs" style={{ border: `1px solid ${item.available ? "#bbf7d0" : "#e2e8f0"}`, borderRadius: 10, background: item.available ? "#f0fdf4" : "#f8fafc" }}>
                          <Group gap={7} wrap="nowrap"><ThemeIcon size="sm" radius="xl" color={item.available ? "teal" : "gray"} variant="light">{item.available ? <IconCheck size={13} /> : <IconX size={13} />}</ThemeIcon><Text size="sm" fw={600}>{item.label}</Text></Group>
                          <Badge size="xs" color={item.available ? "teal" : "gray"} variant="light">{item.available ? "Есть" : "Нет"}</Badge>
                        </Group>
                      ))}
                    </SimpleGrid>
                    <Text size="xs" c="dimmed">Статусы взяты из первоисточника на момент обновления. Комплектацию и её состояние подтвердим перед сделкой.</Text>
                  </Stack>
                </Paper>
              )}

              {conditionInfo && (
                <Paper radius="md" p="md" withBorder style={{ background: "linear-gradient(135deg, #f0fdfa 0%, #fff 58%)", borderColor: "#99f6e4" }}>
                  <Stack gap="sm">
                    <Group justify="space-between" align="flex-start" gap="sm" wrap="wrap">
                      <Group gap="sm"><ThemeIcon variant="light" color="teal" radius="md"><IconShieldCheck size={18} /></ThemeIcon><Box><Text fw={750} c="dark.9">Состояние по данным Encar</Text><Text size="xs" c="dimmed">Показатели из открытой карточки источника</Text></Box></Group>
                      <Badge variant="light" color="teal">Проверяйте перед сделкой</Badge>
                    </Group>
                    <SimpleGrid cols={{ base: 1, sm: conditionInfo.newCarComparisonPct !== null ? 3 : 2 }} spacing="xs">
                      {conditionInfo.newCarComparisonPct !== null && <Paper p="xs" radius="md" withBorder style={{ background: "rgba(255,255,255,.76)" }}><Text size="xs" c="dimmed">Сходство с новым авто</Text><Group justify="space-between" mt={3}><Text fw={800} c="teal.8">{conditionInfo.newCarComparisonPct}%</Text><Text size="xs" c="dimmed">оценка Encar</Text></Group><Progress value={conditionInfo.newCarComparisonPct} color="teal" size="sm" radius="xl" mt={6} /></Paper>}
                      {conditionInfo.inspectionSummary && <Paper p="xs" radius="md" withBorder style={{ background: "rgba(255,255,255,.76)" }}><Text size="xs" c="dimmed">Техосмотр</Text><Text fw={700} size="sm" mt={4}>{conditionInfo.inspectionSummary}</Text></Paper>}
                      {conditionInfo.insuranceRecordCount !== null && <Paper p="xs" radius="md" withBorder style={{ background: "rgba(255,255,255,.76)" }}><Text size="xs" c="dimmed">Страховые записи</Text><Text fw={800} size="lg" c="teal.8" mt={1}>{conditionInfo.insuranceRecordCount}</Text></Paper>}
                    </SimpleGrid>
                    <Text size="xs" c="dimmed">Количество страховых записей само по себе не описывает повреждения или ремонт. Детали и актуальность сведений сверяются с первоисточником перед заказом.</Text>
                  </Stack>
                </Paper>
              )}

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
                manufacturedMonth={listing.manufacturedMonth}
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
          <Box className="auction-detail-layout__aside">
            <Paper radius="md" p="lg" withBorder style={{ position: hasWideAuctionLayout ? undefined : "static", borderColor: "#fed7aa", background: "linear-gradient(135deg, #fff7ed 0%, #fff 100%)" }}>
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
        </Box>
      </Stack>
    </Container>
  )
}

function SpecRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Box className="auction-detail-spec">
      <Group gap={6}><Box c="indigo.5">{icon}</Box><Text className="auction-detail-spec__label">{label}</Text></Group>
      <Text className="auction-detail-spec__value">{value}</Text>
    </Box>
  )
}

export default function AuctionDetailPage() {
  return (
    <Suspense fallback={<Container py={80}><Center><Loader size="sm" color="orange" /></Center></Container>}>
      <AuctionDetail />
    </Suspense>
  )
}
