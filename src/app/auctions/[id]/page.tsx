"use client"
export const dynamic = "force-dynamic"
import { useEffect, useMemo, useState, Suspense } from "react"
import { useParams, useRouter } from "next/navigation"
import useSWR from "swr"
import Link from "next/link"
import { Container, Stack, Group, Text, Paper, Box, Badge, Button, SimpleGrid, TextInput, Textarea, ThemeIcon, Center, Loader, Anchor, Progress, UnstyledButton } from "@mantine/core"
import { useMediaQuery } from "@mantine/hooks"
import { IconGavel, IconCheck, IconMapPin, IconCalendar, IconGauge, IconCar, IconEye, IconGasStation, IconManualGearbox, IconPalette, IconShieldCheck, IconTruckDelivery, IconX, IconArrowLeft, IconHome } from "@tabler/icons-react"
import { notifications } from "@mantine/notifications"
import AuctionCalculator from "@/components/auctions/AuctionCalculator"
import { fetchJson } from "@/lib/api-client"
import { AsyncErrorState } from "@/components/ui/AsyncStates"
import VehicleFallback from "@/components/listings/VehicleFallback"
import { auctionCardImageUrl, auctionThumbnailImageUrl, highQualityAuctionImageUrl, isSafeMediaUrl, parseAuctionImages } from "@/lib/media-url"
import { auctionMakeLabel, isCustomerFacingRussianText, normalizeAuctionModel } from "@/lib/auction-normalization"
import { auctionSourceLabel } from "@/lib/auction-sources"
import type { AuctionListing } from "@prisma/client"
import styles from "./auction-detail.module.css"

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
          return isCustomerFacingRussianText(record.label) && typeof record.available === "boolean"
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
  newCarPriceRatioPct: number | null
  verifiedItems: Array<{ label: string; status: string }>
}

function parseAuctionConditionInfo(value: string | null): AuctionConditionInfo | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as { insuranceRecordCount?: unknown; inspectionSummary?: unknown; newCarPriceRatioPct?: unknown; verifiedItems?: unknown }
    const insuranceRecordCount = typeof parsed.insuranceRecordCount === "number" && Number.isInteger(parsed.insuranceRecordCount) && parsed.insuranceRecordCount >= 0
      ? parsed.insuranceRecordCount
      : null
    const inspectionSummary = isCustomerFacingRussianText(parsed.inspectionSummary) ? parsed.inspectionSummary.trim() : null
    const newCarPriceRatioPct = typeof parsed.newCarPriceRatioPct === "number" && Number.isInteger(parsed.newCarPriceRatioPct) && parsed.newCarPriceRatioPct >= 0 && parsed.newCarPriceRatioPct <= 100
      ? parsed.newCarPriceRatioPct
      : null
    const verifiedItems = Array.isArray(parsed.verifiedItems)
      ? parsed.verifiedItems.flatMap((item) => {
          if (!item || typeof item !== "object") return []
          const record = item as { label?: unknown; status?: unknown }
          return isCustomerFacingRussianText(record.label) && record.label.trim().length <= 80 && isCustomerFacingRussianText(record.status) && record.status.trim().length <= 100
            ? [{ label: record.label.trim(), status: record.status.trim() }]
            : []
        }).slice(0, 4)
      : []
    return insuranceRecordCount !== null || inspectionSummary || newCarPriceRatioPct !== null || verifiedItems.length
      ? { insuranceRecordCount, inspectionSummary, newCarPriceRatioPct, verifiedItems }
      : null
  } catch {
    return null
  }
}

function AuctionDetail() {
  const params = useParams()
  const router = useRouter()
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
  const [loadedImageUrls, setLoadedImageUrls] = useState<Set<string>>(() => new Set())
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
  const activeImageThumbnail = auctionThumbnailImageUrl(activeImage)
  const activeImagePreview = auctionCardImageUrl(activeImage)
  const activeImageHighQuality = highQualityAuctionImageUrl(activeImage)
  const isActiveImageLoading = Boolean(activeImageHighQuality) && !loadedImageUrls.has(activeImageHighQuality)
  // Render a sharp card-sized rendition immediately, then replace it only
  // after the 1600px image is fully decoded. This avoids the old blank/spinner
  // wait for visitors who open a listing before the remote CDN is warm.
  const displayedActiveImage = isActiveImageLoading ? activeImagePreview : activeImageHighQuality
  const equipment = listing ? parseAuctionEquipment(listing.equipment) : null
  const conditionInfo = listing ? parseAuctionConditionInfo(listing.conditionInfo) : null
  const isRentalTransfer = conditionInfo?.verifiedItems.some((item) => item.label === "Тип предложения" && /аренд/i.test(item.status)) || false
  const publicModel = listing ? normalizeAuctionModel(listing.model) || "Модель уточняется" : ""
  const publicLotNumber = listing && isCustomerFacingRussianText(listing.lotNumber) ? listing.lotNumber : null
  const publicDescription = listing && isCustomerFacingRussianText(listing.descriptionRu) ? listing.descriptionRu : null

  useEffect(() => {
    setActiveImageIndex(0)
    setFailedImageUrls(new Set())
    setLoadedImageUrls(new Set())
  }, [listing?.id])

  useEffect(() => {
    if (galleryImages.length < 2 || typeof window === "undefined") return

    // Warm both browsing directions. A visitor often checks the previous
    // inspection photo after zooming into a detail, so preloading only the
    // following images made backwards navigation depend on the remote CDN.
    // Images stay only in the browser cache; our server stores URLs, not files.
    const preloadUrls = [
      activeImageHighQuality,
      ...[-1, 1, 2].map((offset) => highQualityAuctionImageUrl(galleryImages[(activeImageIndex + offset + galleryImages.length) % galleryImages.length])),
    ].filter((imageUrl) => imageUrl && !loadedImageUrls.has(imageUrl))

    let cancelled = false
    const preloadedImages = preloadUrls.map((imageUrl) => {
      const preloaded = new window.Image()
      preloaded.decoding = "async"
      preloaded.onload = () => {
        if (cancelled) return
        setLoadedImageUrls((previous) => previous.has(imageUrl) ? previous : new Set(previous).add(imageUrl))
      }
      preloaded.src = imageUrl
      return preloaded
    })

    return () => {
      cancelled = true
      preloadedImages.forEach((image) => {
        image.onload = null
      })
    }
  }, [activeImageHighQuality, activeImageIndex, galleryImages, loadedImageUrls])

  const warmGalleryImage = (imageUrl: string) => {
    if (typeof window === "undefined") return

    const highQualityUrl = highQualityAuctionImageUrl(imageUrl)
    for (const renditionUrl of [auctionCardImageUrl(imageUrl), highQualityUrl]) {
      if (!renditionUrl || (renditionUrl === highQualityUrl && loadedImageUrls.has(highQualityUrl))) continue
      const preloaded = new window.Image()
      preloaded.decoding = "async"
      if (renditionUrl === highQualityUrl) {
        preloaded.onload = () => {
          setLoadedImageUrls((previous) => previous.has(highQualityUrl) ? previous : new Set(previous).add(highQualityUrl))
        }
      }
      preloaded.src = renditionUrl
    }
  }

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
        <Group gap="xs" align="center" wrap="wrap">
          <Button
            variant="filled"
            color="indigo"
            radius="xl"
            size="compact-sm"
            leftSection={<IconArrowLeft size={15} />}
            onClick={() => window.history.length > 1 ? router.back() : router.push("/auctions")}
          >
            Вернуться назад
          </Button>
          <Button component={Link} href="/" variant="default" radius="xl" size="compact-sm" leftSection={<IconHome size={14} />}>Главная</Button>
          <Button component={Link} href="/auctions" variant="light" color="indigo" radius="xl" size="compact-sm" leftSection={<IconGavel size={14} />}>Все аукционы</Button>
          <Paper px="sm" py={5} radius="xl" withBorder style={{ minWidth: 0, background: "#f8fafc" }}>
            <Text size="xs" fw={700} c="dark.7" lineClamp={1}>{auctionMakeLabel(listing.make)} {publicModel}</Text>
          </Paper>
        </Group>

        <Box className="auction-detail-layout" style={hasWideAuctionLayout ? undefined : { gridTemplateColumns: "minmax(0, 1fr)" }}>
          {/* Левая — фото + характеристики */}
          <Box className="auction-detail-layout__main">
            <Stack gap="md">
              <Paper radius="md" withBorder style={{ overflow: "hidden" }}>
                <Box style={{ position: "relative", background: "var(--mantine-color-gray-1)", aspectRatio: "16/10" }}>
                  {(!activeImage || failedImageUrls.has(activeImage)) && <VehicleFallback type="CAR" />}
                  {activeImage && !failedImageUrls.has(activeImage) && (
                    <>
                      {/* The rail thumbnail is normally already cached. Keep it
                          below the larger rendition so a click changes the photo
                          immediately even during a cold ENCAR CDN response. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        key={`instant-${activeImage}`}
                        src={activeImageThumbnail}
                        alt=""
                        aria-hidden="true"
                        decoding="sync"
                        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "blur(1px)", transform: "scale(1.005)" }}
                      />
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        key={displayedActiveImage}
                        className={styles.galleryImage}
                        src={displayedActiveImage}
                        alt={`${auctionMakeLabel(listing.make)} ${publicModel}, фото ${activeImageIndex + 1}`}
                        decoding="async"
                        fetchPriority={activeImageIndex === 0 ? "high" : "auto"}
                        onLoad={() => {
                          if (displayedActiveImage !== activeImageHighQuality) return
                          setLoadedImageUrls((previous) => new Set(previous).add(activeImageHighQuality))
                        }}
                        onError={() => {
                          setFailedImageUrls((previous) => new Set(previous).add(activeImage))
                          setLoadedImageUrls((previous) => new Set(previous).add(activeImageHighQuality))
                        }}
                        style={{ position: "absolute", zIndex: 1, inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    </>
                  )}
                  <Badge pos="absolute" top={16} left={16} color="orange" variant="filled" size="lg">{publicLotNumber ? `${auctionSourceLabel(listing.source)} · ${publicLotNumber}` : auctionSourceLabel(listing.source)}</Badge>
                  <Stack pos="absolute" top={16} right={16} gap={6} align="flex-end">
                    <Badge color="dark" variant="filled" size="lg">{COUNTRY_LABELS[listing.country] || listing.country}</Badge>
                    <Badge color="gray" variant="filled" leftSection={<IconEye size={13} />}>{listing.viewCount.toLocaleString("ru")} просмотров</Badge>
                  </Stack>
                </Box>
                {galleryImages.length > 1 && (
                  <Box p="sm" style={{ borderTop: "1px solid var(--mantine-color-gray-2)" }}>
                    <Group gap="xs" wrap="nowrap" style={{ overflowX: "auto", paddingBottom: 2 }}>
                      {galleryImages.map((image, index) => (
                        <UnstyledButton
                          key={image}
                          onClick={() => setActiveImageIndex(index)}
                          onPointerEnter={() => warmGalleryImage(image)}
                          onPointerDown={() => warmGalleryImage(image)}
                          onFocus={() => warmGalleryImage(image)}
                          aria-label={`Показать фото ${index + 1}`}
                          aria-current={index === activeImageIndex ? "true" : undefined}
                          style={{ flex: "0 0 auto", width: 76, height: 56, padding: 0, border: index === activeImageIndex ? "2px solid var(--mantine-color-orange-6)" : "1px solid var(--mantine-color-gray-3)", borderRadius: 8, background: "var(--mantine-color-gray-1)", overflow: "hidden", cursor: "pointer" }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={auctionThumbnailImageUrl(image)} alt="" loading="lazy" decoding="async" onError={(event) => { event.currentTarget.style.opacity = "0.25" }} style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }} />
                        </UnstyledButton>
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
                    {listing.engineVolume && <SpecRow icon={<IconCar size={16} />} label="Объём" value={`${Math.round(listing.engineVolume).toLocaleString("ru-RU")} см³`} />}
                    <SpecRow icon={<IconCar size={16} />} label="Мощность" value={listing.power ? `${listing.power} л.с.` : "Не опубликована источником"} multiline={!listing.power} />
                    {listing.location && <SpecRow icon={<IconMapPin size={16} />} label="Локация" value={listing.location} multiline />}
                  </SimpleGrid>
                  <Group gap={6} mt={2}>
                    <Text size="xs" c="dimmed">Данные автомобиля:</Text>
                    <Anchor href={listing.sourceUrl} target="_blank" rel="noreferrer" size="xs" fw={600}>
                      Открыть оригинальное объявление на {auctionSourceLabel(listing.source)}
                    </Anchor>
                  </Group>
                </Stack>
              </Paper>

              {equipment && (
                <Paper radius="md" p="md" withBorder style={{ background: "linear-gradient(135deg, #f8fafc 0%, #fff 56%)" }}>
                  <Stack gap="sm">
                    <Group justify="space-between" align="flex-start" gap="sm" wrap="wrap">
                      <Group gap="sm"><ThemeIcon variant="light" color="indigo" radius="md"><IconCheck size={18} /></ThemeIcon><Box><Text fw={750} c="dark.9">Оснащение автомобиля</Text><Text size="xs" c="dimmed">Ключевые опции, отмеченные в открытой карточке {auctionSourceLabel(listing.source)}</Text></Box></Group>
                      {equipment.totalReported && <Badge variant="light" color="indigo">Опций в источнике: {equipment.totalReported}</Badge>}
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
                      <Group gap="sm"><ThemeIcon variant="light" color={isRentalTransfer ? "blue" : "teal"} radius="md"><IconShieldCheck size={18} /></ThemeIcon><Box><Text fw={750} c="dark.9">{isRentalTransfer ? "Условия договора по данным" : "Проверка и история по данным"} {auctionSourceLabel(listing.source)}</Text><Text size="xs" c="dimmed">Показатели из открытой карточки источника</Text></Box></Group>
                      <Badge variant="light" color={isRentalTransfer ? "blue" : "teal"}>{isRentalTransfer ? "Не является ценой продажи" : "Проверяйте перед сделкой"}</Badge>
                    </Group>
                    <SimpleGrid cols={{ base: 1, sm: conditionInfo.newCarPriceRatioPct !== null ? 3 : 2 }} spacing="xs">
                      {conditionInfo.newCarPriceRatioPct !== null && <Paper p="xs" radius="md" withBorder style={{ background: "rgba(255,255,255,.76)" }}><Text size="xs" c="dimmed">Цена относительно нового авто</Text><Group justify="space-between" mt={3}><Text fw={800} c="teal.8">{conditionInfo.newCarPriceRatioPct}%</Text><Text size="xs" c="dimmed">сравнение {auctionSourceLabel(listing.source)}</Text></Group><Progress value={conditionInfo.newCarPriceRatioPct} color="teal" size="sm" radius="xl" mt={6} /></Paper>}
                      {conditionInfo.inspectionSummary && <Paper p="xs" radius="md" withBorder style={{ background: "rgba(255,255,255,.76)" }}><Text size="xs" c="dimmed">Техосмотр</Text><Text fw={700} size="sm" mt={4}>{conditionInfo.inspectionSummary}</Text></Paper>}
                      {conditionInfo.insuranceRecordCount !== null && <Paper p="xs" radius="md" withBorder style={{ background: "rgba(255,255,255,.76)" }}><Text size="xs" c="dimmed">Страховые записи</Text><Text fw={800} size="lg" c="teal.8" mt={1}>{conditionInfo.insuranceRecordCount}</Text></Paper>}
                    </SimpleGrid>
                    {conditionInfo.verifiedItems.length > 0 && <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
                      {conditionInfo.verifiedItems.map((item) => <Paper key={`${item.label}-${item.status}`} p="xs" radius="md" withBorder style={{ background: "#f0fdf4", borderColor: "#bbf7d0" }}><Group gap={8} wrap="nowrap"><ThemeIcon size="sm" radius="xl" color="teal" variant="light"><IconCheck size={13} /></ThemeIcon><Box><Text size="xs" c="dimmed">{item.label}</Text><Text fw={750} size="sm" c="teal.9">{item.status}</Text></Box></Group></Paper>)}
                    </SimpleGrid>}
                    <Text size="xs" c="dimmed">{isRentalTransfer ? `Показаны опубликованные условия переоформления аренды ${auctionSourceLabel(listing.source)}. Право выкупа, переход собственности и экспорт подтверждаются отдельно.` : `Карточки состояния — только открытые подтверждения ${auctionSourceLabel(listing.source)}. Сравнение с ценой нового авто и количество страховых записей не описывают повреждения или ремонт; для перечня работ нужен полный отчёт/акт осмотра из первоисточника.`}</Text>
                  </Stack>
                </Paper>
              )}

              {publicDescription && (
                <Paper radius="md" p="md" withBorder>
                  <Stack gap="xs">
                    <Group gap="sm"><IconCheck size={18} color="#059669" /><Text fw={700} c="dark.9">Описание объявления</Text></Group>
                    <Text size="sm" c="gray.6" lh={1.6}>{publicDescription}</Text>
                  </Stack>
                </Paper>
              )}

              {/* Умный калькулятор */}
              <AuctionCalculator
                make={auctionMakeLabel(listing.make)}
                model={publicModel}
                year={listing.year}
                manufacturedMonth={listing.manufacturedMonth}
                engineVolume={listing.engineVolume}
                power={listing.power}
                fuelType={listing.fuelType}
                sourcePrice={listing.sourcePrice}
                sourceCurrency={listing.sourceCurrency}
                priceRub={listing.priceRub}
                country={listing.country}
                pricingMode={isRentalTransfer ? "RENTAL_TRANSFER" : "PURCHASE"}
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
                    <Text size="xs" c="gray.5">{auctionMakeLabel(listing.make)} {publicModel} · {listing.year} · {COUNTRY_LABELS[listing.country]}</Text>
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

function SpecRow({ icon, label, value, multiline = false }: { icon: React.ReactNode; label: string; value: string; multiline?: boolean }) {
  return (
    <Box className="auction-detail-spec">
      <Group gap={6}><Box c="indigo.5">{icon}</Box><Text className="auction-detail-spec__label">{label}</Text></Group>
      <Text className="auction-detail-spec__value" title={value} style={multiline ? { whiteSpace: "normal", overflowWrap: "anywhere" } : undefined}>{value}</Text>
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
