"use client"
export const dynamic = "force-dynamic"
import { useEffect, useMemo, useState, Suspense } from "react"
import { useParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import useSWR from "swr"
import Link from "next/link"
import { ActionIcon, Alert, Anchor, Badge, Box, Button, Center, Container, Group, Loader, Paper, Progress, SimpleGrid, Stack, Text, Textarea, TextInput, ThemeIcon, UnstyledButton } from "@mantine/core"
import { useMediaQuery } from "@mantine/hooks"
import { IconArrowLeft, IconArrowRight, IconCheck, IconChevronLeft, IconChevronRight, IconEye, IconGavel, IconHome, IconListDetails, IconPhotoOff, IconShieldCheck, IconTruckDelivery, IconX } from "@tabler/icons-react"
import { notifications } from "@mantine/notifications"
import AuctionCalculator from "@/components/auctions/AuctionCalculator"
import AuctionDamageReport from "@/components/auctions/AuctionDamageReport"
import { fetchJson } from "@/lib/api-client"
import { AsyncErrorState } from "@/components/ui/AsyncStates"
import { auctionCardImageUrl, auctionThumbnailImageUrl, highQualityAuctionImageUrl, isSafeMediaUrl, parseAuctionImages } from "@/lib/media-url"
import { auctionVehicleIdentity, isCustomerFacingRussianText } from "@/lib/auction-normalization"
import { auctionSourceLabel } from "@/lib/auction-sources"
import { AUCTION_DAMAGE_KINDS, type AuctionDamageKind, type AuctionDamageReport as AuctionDamageReportValue } from "@/lib/auction-damage"
import { buildAuctionSourceSpecs } from "@/lib/auction-source-details"
import { formatPriceShort } from "@/lib/format"
import BrandIcon from "@/components/brands/BrandIcon"
import type { AuctionListing } from "@prisma/client"
import styles from "./auction-detail.module.css"

type AuctionDetailResponse = { listing: AuctionListing; similar: AuctionListing[] }
type AuctionInquiryResponse = { success: true; inquiry: { id: string; createdAt: string } }

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
  damageReport: AuctionDamageReportValue | null
}

const VALID_DAMAGE_KINDS = new Set<string>(AUCTION_DAMAGE_KINDS)

function parseDamageKinds(value: unknown): AuctionDamageKind[] {
  return Array.isArray(value)
    ? Array.from(new Set(value.filter((kind): kind is AuctionDamageKind => typeof kind === "string" && VALID_DAMAGE_KINDS.has(kind))))
    : []
}

function parseAuctionDamageReport(value: unknown): AuctionDamageReportValue | null {
  if (!value || typeof value !== "object") return null
  const report = value as { sourceLabel?: unknown; sections?: unknown }
  if (!isCustomerFacingRussianText(report.sourceLabel) || !Array.isArray(report.sections)) return null

  let totalItems = 0
  const sections = report.sections.flatMap((sectionValue) => {
    if (!sectionValue || typeof sectionValue !== "object" || totalItems >= 80) return []
    const section = sectionValue as { code?: unknown; label?: unknown; diagramUrl?: unknown; items?: unknown }
    if (typeof section.code !== "string" || !section.code.trim() || !isCustomerFacingRussianText(section.label) || !Array.isArray(section.items)) return []
    const items = section.items.flatMap((itemValue) => {
      if (!itemValue || typeof itemValue !== "object" || totalItems >= 80) return []
      const item = itemValue as { id?: unknown; part?: unknown; note?: unknown; kinds?: unknown; x?: unknown; y?: unknown; photos?: unknown }
      const kinds = parseDamageKinds(item.kinds)
      if (typeof item.id !== "string" || !item.id.trim() || !isCustomerFacingRussianText(item.part) || !isCustomerFacingRussianText(item.note) || kinds.length === 0) return []
      const photos = Array.isArray(item.photos) ? item.photos.flatMap((photoValue) => {
        if (!photoValue || typeof photoValue !== "object") return []
        const photo = photoValue as { url?: unknown; note?: unknown; kinds?: unknown }
        const photoKinds = parseDamageKinds(photo.kinds)
        return isSafeMediaUrl(photo.url) && isCustomerFacingRussianText(photo.note) && photoKinds.length > 0
          ? [{ url: photo.url, note: photo.note.trim(), kinds: photoKinds }]
          : []
      }).slice(0, 8) : []
      const x = typeof item.x === "number" && item.x >= 0 && item.x <= 1 ? item.x : null
      const y = typeof item.y === "number" && item.y >= 0 && item.y <= 1 ? item.y : null
      totalItems += 1
      return [{ id: item.id.trim(), part: item.part.trim(), note: item.note.trim(), kinds, x, y, photos }]
    })
    if (!items.length) return []
    return [{
      code: section.code.trim(),
      label: section.label.trim(),
      diagramUrl: isSafeMediaUrl(section.diagramUrl) ? section.diagramUrl : null,
      items,
    }]
  }).slice(0, 12)

  return sections.length ? { sourceLabel: report.sourceLabel.trim(), sections } : null
}

function parseAuctionConditionInfo(value: string | null): AuctionConditionInfo | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as { insuranceRecordCount?: unknown; inspectionSummary?: unknown; newCarPriceRatioPct?: unknown; verifiedItems?: unknown; damageReport?: unknown }
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
    const damageReport = parseAuctionDamageReport(parsed.damageReport)
    return insuranceRecordCount !== null || inspectionSummary || newCarPriceRatioPct !== null || verifiedItems.length || damageReport
      ? { insuranceRecordCount, inspectionSummary, newCarPriceRatioPct, verifiedItems, damageReport }
      : null
  } catch {
    return null
  }
}

function AuctionDetail() {
  const params = useParams()
  const router = useRouter()
  const { data: session, status: authStatus } = useSession()
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
  const identity = listing ? auctionVehicleIdentity(listing.make, listing.model) : null
  const publicLotNumber = listing && isCustomerFacingRussianText(listing.lotNumber) ? listing.lotNumber : null
  const publicDescription = listing && isCustomerFacingRussianText(listing.descriptionRu) ? listing.descriptionRu : null
  const publicSpecs = listing ? buildAuctionSourceSpecs({
    sourceId: listing.sourceId,
    year: listing.year,
    manufacturedMonth: listing.manufacturedMonth,
    mileage: listing.mileage,
    lotNumber: listing.lotNumber,
    sourcePrice: listing.sourcePrice,
    sourceCurrency: listing.sourceCurrency,
    engineVolume: listing.engineVolume,
    power: listing.power,
    fuelType: listing.fuelType,
    transmission: listing.transmission,
    bodyType: listing.bodyType,
    driveType: listing.driveType,
    color: listing.color,
    vin: listing.vin,
    location: listing.location,
    conditionInfo: listing.conditionInfo,
  }, listing.specsRu) : []
  const thumbnailIndexes = useMemo(() => {
    if (galleryImages.length <= 30) return galleryImages.map((_, index) => index)
    const start = Math.max(0, Math.min(activeImageIndex - 12, galleryImages.length - 30))
    return Array.from({ length: 30 }, (_, offset) => start + offset)
  }, [activeImageIndex, galleryImages])

  useEffect(() => {
    setActiveImageIndex(0)
    setFailedImageUrls(new Set())
    setLoadedImageUrls(new Set())
  }, [listing?.id])

  useEffect(() => {
    if (!session?.user) return
    setForm((current) => ({
      ...current,
      name: current.name || session.user.name || "",
      email: current.email || session.user.email || "",
    }))
  }, [session?.user])

  useEffect(() => {
    if (galleryImages.length < 2 || typeof window === "undefined") return

    // Decode only the active full-size image and one card-size neighbour.
    // Damage reports often contain dozens of remote photos; preloading several
    // 1600px renditions per click made the gallery compete with the UI itself.
    const nextImage = galleryImages[(activeImageIndex + 1) % galleryImages.length]
    const preloadUrls = [
      activeImageHighQuality,
      auctionCardImageUrl(nextImage),
    ].filter((imageUrl) => imageUrl && !loadedImageUrls.has(imageUrl))

    let cancelled = false
    const preloadedImages = preloadUrls.map((imageUrl) => {
      const preloaded = new window.Image()
      preloaded.decoding = "async"
      preloaded.referrerPolicy = "no-referrer"
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
      preloaded.referrerPolicy = "no-referrer"
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
      notifications.show({ title: "Заявка отправлена", message: "После назначения партнёра сделка и защищённый чат появятся в кабинете.", color: "green" })
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

  const COUNTRY_LABELS: Record<string, string> = { JP: "🇯🇵 Япония", KR: "🇰🇷 Корея", US: "🇺🇸 США", DE: "🇪🇺 Европа", CN: "🇨🇳 Китай", AE: "🇦🇪 ОАЭ", EU: "🇪🇺 Европа" }
  const publicIdentity = identity || auctionVehicleIdentity(listing.make, listing.model)

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
          <Paper px="sm" py={5} radius="xl" withBorder className={styles.identityPill}>
            <Text size="xs" fw={700} c="var(--market-ink)" lineClamp={1}>{publicIdentity.title}</Text>
          </Paper>
        </Group>

        <Box className="auction-detail-layout" style={hasWideAuctionLayout ? undefined : { gridTemplateColumns: "minmax(0, 1fr)" }}>
          {/* Левая — фото + характеристики */}
          <Box className="auction-detail-layout__main">
            <Stack gap="md">
              <Paper radius="md" withBorder style={{ overflow: "hidden" }}>
                <Box style={{ position: "relative", background: "var(--mantine-color-gray-1)", aspectRatio: "16/10" }}>
                  {(!activeImage || failedImageUrls.has(activeImage)) && (
                    <Center h="100%" px="lg">
                      <Stack gap="xs" align="center" ta="center" maw={420}>
                        <ThemeIcon variant="light" color="indigo" radius="xl" size={58}><IconPhotoOff size={28} /></ThemeIcon>
                        <Text fw={800} c="var(--market-ink)">Фото временно недоступны</Text>
                        <Text size="sm" c="dimmed">Источник не передал изображение или временно запретил его загрузку. Характеристики ниже уже доступны.</Text>
                        <Button component="a" href={listing.sourceUrl} target="_blank" rel="noreferrer" variant="light" color="indigo" size="compact-sm" radius="xl">Проверить фото у источника</Button>
                      </Stack>
                    </Center>
                  )}
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
                        referrerPolicy="no-referrer"
                        decoding="sync"
                        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "blur(1px)", transform: "scale(1.005)" }}
                      />
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        key={displayedActiveImage}
                        className={styles.galleryImage}
                        src={displayedActiveImage}
                        alt={`${publicIdentity.title}, фото ${activeImageIndex + 1}`}
                        referrerPolicy="no-referrer"
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
                  {galleryImages.length > 1 && (
                    <>
                      <ActionIcon aria-label="Предыдущее фото" variant="filled" color="dark" radius="xl" size="lg" pos="absolute" left={12} top="50%" style={{ zIndex: 3, transform: "translateY(-50%)", opacity: 0.82 }} onClick={() => setActiveImageIndex((activeImageIndex - 1 + galleryImages.length) % galleryImages.length)}><IconChevronLeft size={20} /></ActionIcon>
                      <ActionIcon aria-label="Следующее фото" variant="filled" color="dark" radius="xl" size="lg" pos="absolute" right={12} top="50%" style={{ zIndex: 3, transform: "translateY(-50%)", opacity: 0.82 }} onClick={() => setActiveImageIndex((activeImageIndex + 1) % galleryImages.length)}><IconChevronRight size={20} /></ActionIcon>
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
                      {thumbnailIndexes.map((index) => {
                        const image = galleryImages[index]
                        return (
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
                          <img src={auctionThumbnailImageUrl(image)} alt="" referrerPolicy="no-referrer" loading="lazy" decoding="async" onError={(event) => { event.currentTarget.style.opacity = "0.25" }} style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }} />
                        </UnstyledButton>
                        )
                      })}
                    </Group>
                    <Text size="xs" c="dimmed" mt={6}>Фото {activeImageIndex + 1} из {galleryImages.length}{galleryImages.length > 30 ? " · показаны ближайшие миниатюры" : ""}</Text>
                  </Box>
                )}
              </Paper>

              <Paper radius="md" p="md" withBorder>
                  <Stack gap="sm">
                    <Group gap="sm"><ThemeIcon variant="light" color="indigo" radius="md"><IconListDetails size={18} /></ThemeIcon><Box><Text fw={700} c="var(--market-ink)">Подробные данные источника</Text><Text size="xs" c="dimmed">Параметры собраны из открытой карточки и приведены к единому формату для всех площадок</Text></Box></Group>
                    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={0} verticalSpacing={0}>
                      {publicSpecs.map((item) => (
                        <Group key={`${item.label}-${item.detail}`} justify="space-between" align="flex-start" gap="md" py="xs" px={{ base: 0, sm: "xs" }} wrap="nowrap" style={{ borderBottom: "1px solid var(--mantine-color-gray-2)" }}>
                          <Text size="sm" c="dimmed">{item.label}</Text>
                          <Text size="sm" fw={item.available ? 700 : 500} ta="right" c={item.available ? "var(--market-ink)" : "dimmed"} style={{ overflowWrap: "anywhere" }}>{item.detail}</Text>
                        </Group>
                      ))}
                    </SimpleGrid>
                    <Group gap={6} mt={2}>
                      <Text size="xs" c="dimmed">Первоисточник:</Text>
                      <Anchor href={listing.sourceUrl} target="_blank" rel="noreferrer" size="xs" fw={600}>
                        Открыть объявление на {auctionSourceLabel(listing.source)}
                      </Anchor>
                    </Group>
                  </Stack>
                </Paper>

              {equipment && (
                <Paper radius="md" p="md" withBorder className={styles.equipmentPanel}>
                  <Stack gap="sm">
                    <Group justify="space-between" align="flex-start" gap="sm" wrap="wrap">
                      <Group gap="sm"><ThemeIcon variant="light" color="indigo" radius="md"><IconCheck size={18} /></ThemeIcon><Box><Text fw={700} c="var(--market-ink)">Оснащение автомобиля</Text><Text size="xs" c="dimmed">Ключевые опции, отмеченные в открытой карточке {auctionSourceLabel(listing.source)}</Text></Box></Group>
                      {equipment.totalReported && <Badge variant="light" color="indigo">Опций в источнике: {equipment.totalReported}</Badge>}
                    </Group>
                    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
                      {equipment.items.map((item) => (
                        <Group key={item.label} gap="sm" justify="space-between" wrap="nowrap" p="xs" style={{ border: `1px solid ${item.available ? "var(--market-success-line)" : "var(--market-line)"}`, borderRadius: 10, background: item.available ? "var(--market-success-surface)" : "var(--market-surface-subtle)" }}>
                          <Group gap={7} wrap="nowrap"><ThemeIcon size="sm" radius="xl" color={item.available ? "teal" : "gray"} variant="light">{item.available ? <IconCheck size={13} /> : <IconX size={13} />}</ThemeIcon><Text size="sm" fw={600}>{item.label}</Text></Group>
                          <Badge size="xs" color={item.available ? "teal" : "gray"} variant="light">{item.available ? "Есть" : "Нет"}</Badge>
                        </Group>
                      ))}
                    </SimpleGrid>
                    <Text size="xs" c="dimmed">Статусы взяты из первоисточника на момент обновления. Комплектацию и её состояние подтвердим перед сделкой.</Text>
                  </Stack>
                </Paper>
              )}

              {conditionInfo?.damageReport && <AuctionDamageReport report={conditionInfo.damageReport} />}

              {conditionInfo && (
                <Paper radius="md" p="md" withBorder className={styles.conditionPanel}>
                  <Stack gap="sm">
                    <Group justify="space-between" align="flex-start" gap="sm" wrap="wrap">
                      <Group gap="sm"><ThemeIcon variant="light" color={isRentalTransfer ? "blue" : "teal"} radius="md"><IconShieldCheck size={18} /></ThemeIcon><Box><Text fw={700} c="var(--market-ink)">{isRentalTransfer ? "Условия договора по данным" : "Проверка и история по данным"} {auctionSourceLabel(listing.source)}</Text><Text size="xs" c="dimmed">Показатели из открытой карточки источника</Text></Box></Group>
                      <Badge variant="light" color={isRentalTransfer ? "blue" : "teal"}>{isRentalTransfer ? "Не является ценой продажи" : "Проверяйте перед сделкой"}</Badge>
                    </Group>
                    <SimpleGrid cols={{ base: 1, sm: conditionInfo.newCarPriceRatioPct !== null ? 3 : 2 }} spacing="xs">
                      {conditionInfo.newCarPriceRatioPct !== null && <Paper p="xs" radius="md" withBorder className={styles.conditionMetric}><Text size="xs" c="dimmed">Цена относительно нового авто</Text><Group justify="space-between" mt={3}><Text fw={800} c="var(--market-success-text)">{conditionInfo.newCarPriceRatioPct}%</Text><Text size="xs" c="dimmed">сравнение {auctionSourceLabel(listing.source)}</Text></Group><Progress value={conditionInfo.newCarPriceRatioPct} color="teal" size="sm" radius="xl" mt={6} /></Paper>}
                      {conditionInfo.inspectionSummary && <Paper p="xs" radius="md" withBorder className={styles.conditionMetric}><Text size="xs" c="dimmed">Техосмотр</Text><Text fw={700} size="sm" mt={4}>{conditionInfo.inspectionSummary}</Text></Paper>}
                      {conditionInfo.insuranceRecordCount !== null && <Paper p="xs" radius="md" withBorder className={styles.conditionMetric}><Text size="xs" c="dimmed">Страховые записи</Text><Text fw={800} size="lg" c="var(--market-success-text)" mt={1}>{conditionInfo.insuranceRecordCount}</Text></Paper>}
                    </SimpleGrid>
                    {conditionInfo.verifiedItems.length > 0 && <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
                      {conditionInfo.verifiedItems.map((item) => <Paper key={`${item.label}-${item.status}`} p="xs" radius="md" withBorder style={{ background: "var(--market-success-surface)", borderColor: "var(--market-success-line)" }}><Group gap={8} wrap="nowrap"><ThemeIcon size="sm" radius="xl" color="teal" variant="light"><IconCheck size={13} /></ThemeIcon><Box><Text size="xs" c="dimmed">{item.label}</Text><Text fw={700} size="sm" c="var(--mantine-color-teal-text)">{item.status}</Text></Box></Group></Paper>)}
                    </SimpleGrid>}
                    <Text size="xs" c="dimmed">{isRentalTransfer ? `Показаны опубликованные условия переоформления аренды ${auctionSourceLabel(listing.source)}. Право выкупа, переход собственности и экспорт подтверждаются отдельно.` : `Карточки состояния — только открытые подтверждения ${auctionSourceLabel(listing.source)}. Сравнение с ценой нового авто и количество страховых записей не описывают повреждения или ремонт; для перечня работ нужен полный отчёт/акт осмотра из первоисточника.`}</Text>
                  </Stack>
                </Paper>
              )}

              {publicDescription && (
                <Paper radius="md" p="md" withBorder>
                  <Stack gap="xs">
                    <Group gap="sm"><IconCheck size={18} color="#059669" /><Text fw={700} c="var(--market-ink)">Описание объявления</Text></Group>
                    <Text size="sm" c="gray.6" lh={1.6}>{publicDescription}</Text>
                  </Stack>
                </Paper>
              )}

              {/* Умный калькулятор. Якорь используется кнопкой «Расчёт под
                  ключ» в Telegram-ленте, поэтому переименование ломает ссылки
                  в уже опубликованных постах. */}
              <div id="calculator" style={{ scrollMarginTop: "var(--app-header-height, 68px)" }} />
              <AuctionCalculator
                make={publicIdentity.make}
                model={publicIdentity.model}
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
            <Paper id="order" radius="md" p="lg" withBorder className={styles.orderCard} style={{ position: hasWideAuctionLayout ? undefined : "static", scrollMarginTop: 96 }}>
              {submitted ? (
                <Stack gap="md" align="center" py="md">
                  <ThemeIcon size={56} radius="xl" color="green" variant="light"><IconCheck size={28} /></ThemeIcon>
                  <Stack gap={0} align="center">
                    <Text fw={700} fz="lg" c="var(--market-ink)">Заявка отправлена!</Text>
                    <Text size="sm" c="gray.5" ta="center">После проверки лота и назначения партнёра<br />сделка появится в личном кабинете.</Text>
                    <Button component={Link} href="/dashboard/deliveries" variant="light" color="indigo" fullWidth>Перейти к сделкам</Button>
                  </Stack>
                </Stack>
              ) : (
                authStatus !== "authenticated" ? (
                  <Stack gap="md">
                    <Group gap="sm"><IconGavel size={20} color="#ea580c" /><Text fw={800} fz="lg" c="var(--market-ink)">Заказать авто</Text></Group>
                    <Text size="sm" c="dimmed">Войдите, чтобы заявка была привязана к вам, а партнёр общался с вами без доступа к телефону и почте.</Text>
                    <Alert color="indigo" variant="light" icon={<IconShieldCheck size={18} />} title="Все этапы внутри LeWheel">После назначения партнёра здесь появятся чат, счета, договоры и маршрут доставки.</Alert>
                    <Button component={Link} href={`/auth/signin?callbackUrl=${encodeURIComponent(`/auctions/${listing.id}#order`)}`} color="indigo" size="md" fullWidth loading={authStatus === "loading"}>Войти и оставить заявку</Button>
                  </Stack>
                ) : <form onSubmit={handleSubmit}>
                  <Stack gap="sm">
                    <Group gap="sm"><IconGavel size={20} color="#ea580c" /><Text fw={800} fz="lg" c="var(--market-ink)">Заказать авто</Text></Group>
                    <Text size="xs" c="gray.5">{publicIdentity.title} · {listing.year} · {COUNTRY_LABELS[listing.country]}</Text>
                    <TextInput label="Ваше имя" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} size="sm" />
                    <TextInput label="Телефон" required placeholder="+7 (___) ___-__-__" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} size="sm" />
                    <TextInput label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} size="sm" />
                    <TextInput label="Город доставки" required placeholder="Москва" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} size="sm" />
                    <Textarea label="Комментарий" placeholder="Вопросы, пожелания..." value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} size="sm" minRows={2} />
                    <Button type="submit" color="orange" radius="md" size="md" loading={submitting} leftSection={<IconCheck size={18} />} fullWidth>Отправить заявку</Button>
                    <Group gap={6}><IconShieldCheck size={14} color="#059669" /><Text size="xs" c="gray.5">Контакты видит только администратор. Партнёру — имя и город.</Text></Group>
                    <Group gap={6}><IconTruckDelivery size={14} color="#1c4291" /><Text size="xs" c="gray.5">Доставка во все регионы РФ</Text></Group>
                  </Stack>
                </form>
              )}
            </Paper>
          </Box>
        </Box>

        {data?.similar && data.similar.length > 0 && (
          <Stack gap="sm" mt="md">
            <Group justify="space-between" align="flex-end" gap="sm">
              <Box>
                <Text component="h2" fz={{ base: 21, sm: 25 }} fw={800} c="var(--market-ink)">Похожие автомобили</Text>
                <Text size="sm" c="dimmed">Близкие по марке, году и бюджету предложения из той же страны</Text>
              </Box>
              <Button component={Link} href={`/auctions?make=${encodeURIComponent(publicIdentity.make)}&country=${listing.country}`} variant="subtle" color="indigo" radius="xl" rightSection={<IconArrowRight size={16} />}>Смотреть все</Button>
            </Group>
            <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} spacing="md">
              {data.similar.map((similarListing) => {
                const similarIdentity = auctionVehicleIdentity(similarListing.make, similarListing.model)
                const similarImages = parseAuctionImages(similarListing.images) || []
                const similarImage = isSafeMediaUrl(similarListing.imageUrl) ? similarListing.imageUrl : similarImages[0]
                return (
                  <Paper key={similarListing.id} component={Link} href={`/auctions/${similarListing.id}`} radius="md" withBorder className={styles.similarCard}>
                    <Box h={150} bg="gray.1" pos="relative" style={{ overflow: "hidden" }}>
                      {similarImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={auctionCardImageUrl(similarImage)} alt={similarIdentity.title} loading="lazy" decoding="async" referrerPolicy="no-referrer" className={styles.similarImage} />
                      ) : <Center h="100%"><IconPhotoOff size={28} color="var(--mantine-color-gray-5)" /></Center>}
                      <Badge pos="absolute" top={10} left={10} color="dark" variant="filled">{similarListing.year}</Badge>
                      <Badge pos="absolute" top={10} right={10} color="orange" variant="filled">{auctionSourceLabel(similarListing.source)}</Badge>
                    </Box>
                    <Stack gap={8} p="md" className={styles.similarContent}>
                      <Group gap="xs" wrap="nowrap"><BrandIcon brand={similarIdentity.make} size={30} /><Text fw={800} c="var(--market-ink)" lineClamp={2} className={styles.similarTitle}>{similarIdentity.title}</Text></Group>
                      <Group gap={5} wrap="wrap" className={styles.similarFacts}>
                        {similarListing.mileage != null && <Badge size="xs" variant="light" color="gray">{similarListing.mileage.toLocaleString("ru")} км</Badge>}
                        {similarListing.fuelType && <Badge size="xs" variant="light" color="orange">{similarListing.fuelType === "GASOLINE" ? "Бензин" : similarListing.fuelType === "DIESEL" ? "Дизель" : similarListing.fuelType === "HYBRID" ? "Гибрид" : similarListing.fuelType === "ELECTRIC" ? "Электро" : similarListing.fuelType}</Badge>}
                        {similarListing.bodyType && <Badge size="xs" variant="light" color="indigo">{similarListing.bodyType === "SUV" ? "Кроссовер" : similarListing.bodyType === "SEDAN" ? "Седан" : similarListing.bodyType}</Badge>}
                        {similarListing.engineVolume && <Badge size="xs" variant="light" color="gray">{Math.round(similarListing.engineVolume).toLocaleString("ru")} см³</Badge>}
                      </Group>
                      <Group justify="space-between" gap="xs" wrap="nowrap" className={styles.similarPriceRow}>
                        <Box>
                          <Text fw={800} c="var(--market-primary)">{formatPriceShort(similarListing.finalPrice)}</Text>
                          <Text size="10px" c="dimmed">предварительно под ключ</Text>
                        </Box>
                        <ThemeIcon variant="light" color="indigo" radius="xl" size={30}><IconArrowRight size={16} /></ThemeIcon>
                      </Group>
                    </Stack>
                  </Paper>
                )
              })}
            </SimpleGrid>
          </Stack>
        )}
      </Stack>
      {/* Полоса действия на телефоне.

          Замер обхода: кнопка «Войти и оставить заявку» лежала на 5227
          пикселях при экране 844 — шесть экранов прокрутки через параметры,
          оснащение, историю и калькулятор. На десктопе блок заявки
          прилипает и виден почти сразу, на телефоне не прилипал вовсе.
          До единственного действия страницы человек просто не доходил.

          Прилепить саму форму нельзя — она высокая и закроет собой лот.
          Полоса же занимает шестьдесят пикселей и всегда под рукой.

          Здесь же названа природа цены: вверху стоит «2,0 млн», а под ключ
          выходит около трёх — и настоящая цифра лежала на 5.6 экрана ниже. */}
      {!hasWideAuctionLayout && !submitted && (
        <Box className="auction-action-bar">
          <Box className="auction-action-bar__price">
            <Text className="auction-action-bar__amount">{formatPriceShort(listing.finalPrice)}</Text>
            <Anchor
              href="#calculator"
              className="auction-action-bar__note"
              onClick={(event) => {
                event.preventDefault()
                document.getElementById("calculator")?.scrollIntoView({ behavior: "smooth", block: "start" })
              }}
            >
              лот + комиссия · расчёт под ключ
            </Anchor>
          </Box>
          <Button
            color="orange"
            size="md"
            onClick={() => document.getElementById("order")?.scrollIntoView({ behavior: "smooth", block: "center" })}
          >
            Заказать
          </Button>
        </Box>
      )}
    </Container>
  )
}

export default function AuctionDetailPage() {
  return (
    <Suspense fallback={<Container py={80}><Center><Loader size="sm" color="orange" /></Center></Container>}>
      <AuctionDetail />
    </Suspense>
  )
}
