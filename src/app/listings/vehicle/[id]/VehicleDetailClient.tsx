"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { isAdmin } from "@/lib/permissions"
import ListingModerationActions from "@/components/listings/ListingModerationActions"
import {
  Container,
  Stack,
  Group,
  Tooltip,
  Text,
  Title,
  Button,
  Badge,
  Card,
  Paper,
  Avatar,
  ActionIcon,
  Box,
  Divider,
  Rating,
  ThemeIcon,
  Breadcrumbs,
  Anchor,
  Textarea,
  Modal,
  Select,
  UnstyledButton,
} from "@mantine/core"
import { notifications } from "@mantine/notifications"
import { Carousel } from "@mantine/carousel"
import {
  IconHeart,
  IconGitCompare,
  IconFlag,
  IconPhone,
  IconMessageCircle2,
  IconShieldCheck,
  IconCheck,
  IconMapPin,
  IconCalendar,
  IconGauge,
  IconGasStation,
  IconManualGearbox,
  IconCar,
  IconBolt,
  IconPalette,
  IconEngine,
  IconUsers,
  IconRoute,
  IconChevronLeft,
  IconChevronRight,
  IconEye,
  IconSteeringWheel,
  IconTruckDelivery,
  IconCircleCheck,
  IconPlane,
  IconSpeedboat,
  IconMotorbike,
  IconTractor,
  IconEdit,
} from "@tabler/icons-react"
import Link from "next/link"
import { formatDate, formatPrice, formatMileage, formatPriceShort, parseImages, formatRelativeDate } from "@/lib/format"
import CreditCalculator from "@/components/listings/CreditCalculator"
import { getUsageMeta, getVehicleIdentityMeta, supportsTransmission } from "@/lib/constants"
import { useFavorites } from "@/hooks/useFavorites"
import { useRouter } from "next/navigation"
import { fetchJson, getApiClientErrorMessage } from "@/lib/api-client"
import ListingViewTracker from "@/components/analytics/ListingViewTracker"

interface VehicleData {
  id: string
  make: string
  model: string
  year: number
  price: number
  vehicleType: string
  typeDetails: string | null
  mileage: number | null
  operatingHours: number | null
  flightHours: number | null
  vin: string | null
  serialNumber: string | null
  registrationNumber: string | null
  fuelType: string | null
  fuelTypeLabel: string
  transmission: string | null
  transmissionLabel: string | null
  bodyType: string | null
  bodyTypeLabel: string | null
  color: string | null
  doors: number | null
  engineVolume: number | null
  power: number | null
  driveType: string | null
  driveTypeLabel: string | null
  condition: string
  conditionLabel: string
  steeringWheel: string | null
  steeringWheelLabel: string | null
  ownersCount: number | null
  documentsStatus: string | null
  documentsStatusLabel: string | null
  damageInfo: string | null
  damageInfoLabel: string | null
  sellerType: string | null
  sellerTypeLabel: string | null
  availability: string | null
  availabilityLabel: string | null
  customsCleared: boolean | null
  generation: string | null
  keywords: string | null
  location: string
  lat: number | null
  lng: number | null
  description: string | null
  images: string | null
  createdAt: Date
  listingId?: string
  views: number
  seller: {
    id: string
    name: string | null
    image: string | null
    memberSince: Date
    otherVehicles: { id: string; make: string; model: string; year: number; price: number }[]
  }
  reviews: { id: string; rating: number; comment: string | null; createdAt: Date; user: { name: string | null; image: string | null } }[]
  similar: { id: string; title: string; price: number; year: number; listingId?: string }[]
}

const VEHICLE_META: Record<string, { label: string; detailLabel: string; icon: React.ReactNode }> = {
  CAR: { label: "Автомобили", detailLabel: "Кузов", icon: <IconCar size={20} /> },
  MOTORCYCLE: { label: "Мотоциклы", detailLabel: "Тип мотоцикла", icon: <IconMotorbike size={20} /> },
  TRUCK: { label: "Грузовики", detailLabel: "Надстройка", icon: <IconTruckDelivery size={20} /> },
  SPECIAL: { label: "Спецтехника", detailLabel: "Тип техники", icon: <IconTractor size={20} /> },
  WATER: { label: "Водный транспорт", detailLabel: "Тип судна", icon: <IconSpeedboat size={20} /> },
  AIR: { label: "Воздушный транспорт", detailLabel: "Тип воздушного судна", icon: <IconPlane size={20} /> },
}

function parseTypeDetails(value: string | null): Record<string, string | number | boolean> {
  if (!value) return {}
  try {
    const parsed: unknown = JSON.parse(value)
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, string | number | boolean>
    }
  } catch {
    // Старые объявления могут содержать невалидный JSON. Детальная страница
    // всё равно должна открываться и показывать основные характеристики.
  }
  return {}
}

function formatDetailLabel(value: string) {
  const labels: Record<string, string> = {
    crewCapacity: "Экипаж", flightRange: "Дальность полёта",
    payloadCapacity: "Грузоподъёмность", payloadKg: "Грузоподъёмность, кг", grossWeightKg: "Полная масса, кг", axleFormula: "Колёсная формула",
    ecoClass: "Экологический класс", transmissionVariant: "Серия КПП", motorcycleType: "Класс мотоцикла", finalDrive: "Главная передача", strokeCycle: "Тактность",
    specialType: "Вид спецтехники", operatingWeightKg: "Эксплуатационная масса, кг", bucketVolumeM3: "Объём ковша, м³", diggingDepthM: "Глубина копания, м",
    waterType: "Тип судна", hullMaterial: "Материал корпуса", hullLengthM: "Длина корпуса, м", waterEngineType: "Тип мотора",
    airType: "Категория ВС", airEngineType: "Тип двигателя", engineCount: "Количество двигателей", mtowKg: "МВМ, кг", passengerCapacity: "Пассажировместимость",
  }
  if (labels[value]) return labels[value]
  return value
    .replace(/([a-zа-я])([A-ZА-Я])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^./, (letter) => letter.toUpperCase())
}

function formatDetailValue(key: string, value: string | number | boolean) {
  const values: Record<string, Record<string, string>> = {
    airType: { AIRPLANE: "Самолёт", HELICOPTER: "Вертолёт", JET: "Реактивный самолёт", TURBOPROP: "Турбовинтовой" },
    waterType: { BOAT: "Катер", YACHT: "Яхта", JETSKI: "Гидроцикл", SAILBOAT: "Парусное судно" },
    specialType: { EXCAVATOR: "Экскаватор", LOADER: "Погрузчик", BULLDOZER: "Бульдозер", CRANE: "Кран", OTHER: "Другая техника" },
    motorcycleType: { SPORT: "Спортбайк", ADVENTURE: "Турэндуро", SCOOTER: "Скутер", CRUISER: "Круизер" },
    truckBodyType: { DUMP: "Самосвал", VAN: "Фургон", TRACTOR: "Седельный тягач", REFRIGERATOR: "Рефрижератор" },
  }
  return values[key]?.[String(value)] || String(value)
}

export default function VehicleDetailClient({ data }: { data: VehicleData }) {
  const [viewCount, setViewCount] = useState(data.views)
  const [phone, setPhone] = useState<string | null>(null)
  const [contactRevealing, setContactRevealing] = useState(false)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewText, setReviewText] = useState("")
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [reportOpened, setReportOpened] = useState(false)
  const [reportReason, setReportReason] = useState("MISLEADING")
  const [reportComment, setReportComment] = useState("")
  const [reportSubmitting, setReportSubmitting] = useState(false)
  const { data: session } = useSession()
  const [activeImage, setActiveImage] = useState(0)
  const [imageFailed, setImageFailed] = useState(false)
  const router = useRouter()
  const { favoriteIds, isAuthenticated, isPending, toggleFavorite } = useFavorites()
  const isFav = Boolean(data.listingId && favoriteIds.has(data.listingId))
  const toggleDetailFavorite = () => {
    if (!data.listingId) return
    if (!isAuthenticated) {
      notifications.show({
        title: "Войдите, чтобы сохранить объявление",
        message: "После входа вы вернётесь к этому автомобилю, а избранное будет доступно на всех устройствах.",
        color: "indigo",
      })
      router.push(`/auth/signin?callbackUrl=${encodeURIComponent(`/listings/vehicle/${data.id}`)}`)
      return
    }
    void toggleFavorite(data.listingId)
  }
  const revealPhone = async () => {
    if (!data.listingId || phone || contactRevealing) return
    if (!session) {
      notifications.show({
        title: "Войдите, чтобы увидеть телефон",
        message: "Так контакты продавцов защищены от автоматического сбора.",
        color: "indigo",
      })
      router.push(`/auth/signin?callbackUrl=${encodeURIComponent(`/listings/vehicle/${data.id}`)}`)
      return
    }

    setContactRevealing(true)
    try {
      const response = await fetch(`/api/listings/${data.listingId}`, { method: "POST" })
      const payload = await response.json().catch(() => null) as { phone?: string; error?: string } | null
      if (!response.ok || !payload?.phone) {
        throw new Error(payload?.error || "Не удалось получить номер")
      }
      setPhone(payload.phone)
      notifications.show({ title: "Контакт продавца открыт", message: "Нажмите на номер, чтобы позвонить.", color: "green" })
    } catch (contactError) {
      notifications.show({
        title: "Не удалось открыть телефон",
        message: getApiClientErrorMessage(contactError, "Повторите попытку позже."),
        color: "red",
      })
    } finally {
      setContactRevealing(false)
    }
  }
  const selectImage = (index: number) => {
    setActiveImage(index)
    setImageFailed(false)
  }
  const submitReview = async () => {
    if (!session) return
    if (!data.listingId) return
    setReviewSubmitting(true)
    try {
      await fetchJson<{ id?: string }>("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: reviewRating, comment: reviewText, listingId: data.listingId }),
      })
      setReviewText("")
      setReviewRating(5)
      notifications.show({ title: "Спасибо!", message: "Отзыв добавлен", color: "green" })
      router.refresh()
    } catch (reviewError) {
      notifications.show({
        title: "Не удалось добавить отзыв",
        message: getApiClientErrorMessage(reviewError, "Проверьте подключение и повторите попытку."),
        color: "red",
      })
    } finally {
      setReviewSubmitting(false)
    }
  }
  const openReport = () => {
    if (!data.listingId) return
    if (!session) {
      notifications.show({
        title: "Войдите, чтобы пожаловаться",
        message: "Так мы защищаем модерацию от автоматических и анонимных жалоб.",
        color: "indigo",
      })
      router.push(`/auth/signin?callbackUrl=${encodeURIComponent(`/listings/vehicle/${data.id}`)}`)
      return
    }
    setReportOpened(true)
  }
  const submitReport = async () => {
    if (!data.listingId || reportSubmitting) return
    setReportSubmitting(true)
    try {
      await fetchJson<{ id: string }>(`/api/listings/${data.listingId}/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reportReason, comment: reportComment }),
      })
      setReportOpened(false)
      setReportComment("")
      notifications.show({
        title: "Жалоба принята",
        message: "Она сохранена и передана в очередь модерации.",
        color: "orange",
      })
    } catch (reportError) {
      notifications.show({
        title: "Не удалось отправить жалобу",
        message: getApiClientErrorMessage(reportError, "Повторите попытку позже."),
        color: "red",
      })
    } finally {
      setReportSubmitting(false)
    }
  }

  const images = parseImages(data.images)
  const hasImages = images.length > 0
  const moveImage = (direction: number) => {
    selectImage((activeImage + direction + images.length) % images.length)
  }
  const typeMeta = VEHICLE_META[data.vehicleType] || VEHICLE_META.CAR
  const hasRoadVehicleDetails = ["CAR", "MOTORCYCLE", "TRUCK"].includes(data.vehicleType)
  const identityMeta = getVehicleIdentityMeta(data.vehicleType)
  const identityValue = identityMeta.field === "vin" ? data.vin : identityMeta.field === "serialNumber" ? data.serialNumber : data.registrationNumber
  const usageMeta = getUsageMeta(data.vehicleType)
  const usageValue = usageMeta.field === "flightHours" ? data.flightHours
    : usageMeta.field === "operatingHours" ? data.operatingHours
    : data.mileage
  const numericUsage = typeof usageValue === "number" && Number.isFinite(usageValue)
    ? usageValue
    : null
  const usageDisplay = numericUsage === null ? null
    : usageMeta.field === "mileage" ? formatMileage(numericUsage)
    : `${new Intl.NumberFormat("ru-RU").format(numericUsage)} ${usageMeta.unit}`
  const typeDetails = parseTypeDetails(data.typeDetails)
  const typeDetailKey: Partial<Record<string, string>> = {
    MOTORCYCLE: "motorcycleType", TRUCK: "truckBodyType", SPECIAL: "specialType", WATER: "waterType", AIR: "airType",
  }
  const additionalSpecs = Object.entries(typeDetails).filter(([key, value]) => value !== null && value !== "" && key !== typeDetailKey[data.vehicleType])
  const primaryTypeKey = typeDetailKey[data.vehicleType]
  const primaryTypeSource = primaryTypeKey ? typeDetails[primaryTypeKey] || data.bodyTypeLabel : data.bodyTypeLabel
  const primaryTypeValue = primaryTypeKey && primaryTypeSource
    ? formatDetailValue(primaryTypeKey, primaryTypeSource)
    : data.bodyTypeLabel || "—"
  const statusItems = [
    { label: "Документы", value: data.documentsStatusLabel || "Не указано", state: data.documentsStatusLabel === "В порядке" ? "positive" : "attention" },
    { label: hasRoadVehicleDetails ? "Состояние кузова" : "Состояние", value: data.damageInfoLabel || "Не указано", state: data.damageInfoLabel === "Не битая" ? "positive" : "attention" },
    { label: "Таможенный статус", value: data.customsCleared === null ? "Не указано" : data.customsCleared ? "Растаможен" : "Не растаможен", state: data.customsCleared ? "positive" : "neutral" },
    { label: hasRoadVehicleDetails ? "Владельцев по ПТС" : "Владельцев", value: data.ownersCount ? String(data.ownersCount) : "Не указано", state: "neutral" },
    { label: "Продавец", value: data.sellerTypeLabel || "Не указан", state: "neutral" },
    { label: "Наличие", value: data.availabilityLabel || "Уточните у продавца", state: data.availabilityLabel === "В наличии" ? "positive" : "neutral" },
  ]

  const specs = [
    { icon: <IconCalendar size={20} />, label: "Год", value: String(data.year) },
    ...(usageDisplay ? [{ icon: <IconGauge size={20} />, label: usageMeta.label, value: usageDisplay }] : []),
    { icon: typeMeta.icon, label: typeMeta.detailLabel, value: primaryTypeValue },
    { icon: <IconGasStation size={20} />, label: "Топливо", value: data.fuelTypeLabel || "—" },
    ...(supportsTransmission(data.vehicleType) ? [
      { icon: <IconManualGearbox size={20} />, label: "Коробка", value: data.transmissionLabel },
    ] : []),
    ...(hasRoadVehicleDetails ? [
      { icon: <IconRoute size={20} />, label: "Привод", value: data.driveTypeLabel || "—" },
    ] : []),
    { icon: <IconEngine size={20} />, label: "Объём", value: data.engineVolume ? `${data.engineVolume} л` : "—" },
    { icon: <IconBolt size={20} />, label: "Мощность", value: data.power ? `${data.power} л.с.` : "—" },
    { icon: <IconPalette size={20} />, label: "Цвет", value: data.color || "—" },
    ...(hasRoadVehicleDetails ? [
      { icon: <IconUsers size={20} />, label: "Дверей", value: data.doors ? String(data.doors) : "—" },
      { icon: <IconSteeringWheel size={20} />, label: "Руль", value: data.steeringWheelLabel || "—" },
    ] : []),
    ...additionalSpecs.map(([label, value]) => ({ icon: <IconCircleCheck size={20} />, label: formatDetailLabel(label), value: formatDetailValue(label, value) })),
  ]

  return (
    <>
    <ListingViewTracker listingId={data.listingId} onCount={setViewCount} />
    <Container size="xl" py="lg">
      {/* Хлебные крошки */}
      <Breadcrumbs mb="md" separator={<IconChevronRight size={14} color="var(--market-muted)" />}>
        <Anchor component={Link} href="/" size="sm" c="var(--market-muted)">Главная</Anchor>
        <Anchor component={Link} href={`/search?type=vehicle&vehicleType=${data.vehicleType}`} size="sm" c="var(--market-muted)">{typeMeta.label}</Anchor>
        <Text size="sm" c="var(--market-ink)">{data.make} {data.model}</Text>
      </Breadcrumbs>

      <Box className="vehicle-detail-layout">
        {/* Левая колонка — галерея + характеристики */}
        <Box className="vehicle-detail-layout__main">
          <Stack gap="md">
            {/* Галерея */}
            <Card p={0} radius="lg" withBorder className={`vehicle-detail-gallery${hasImages ? "" : " vehicle-detail-gallery--empty"}`}>
              {hasImages ? (
                <>
                  {/* Главное изображение */}
                  <Box className="vehicle-detail-gallery__media">
                    {imageFailed ? (
                      <Stack align="center" justify="center" gap="xs" h="100%" c="dimmed">
                        <IconCar size={42} stroke={1.5} />
                        <Text size="sm">Фото недоступно</Text>
                      </Stack>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={images[activeImage]}
                        alt={`${data.make} ${data.model} — фото ${activeImage + 1}`}
                        onError={() => setImageFailed(true)}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    )}
                    <Badge
                      pos="absolute"
                      top={16}
                      left={16}
                      color="indigo"
                      variant="filled"
                      size="md"
                      style={{ backdropFilter: "blur(4px)" }}
                    >
                      {data.conditionLabel}
                    </Badge>
                    {images.length > 1 && <>
                      <ActionIcon aria-label="Предыдущее фото" variant="filled" color="dark" radius="xl" pos="absolute" left={14} top="50%" style={{ transform: "translateY(-50%)" }} onClick={() => moveImage(-1)}><IconChevronLeft size={18} /></ActionIcon>
                      <ActionIcon aria-label="Следующее фото" variant="filled" color="dark" radius="xl" pos="absolute" right={14} top="50%" style={{ transform: "translateY(-50%)" }} onClick={() => moveImage(1)}><IconChevronRight size={18} /></ActionIcon>
                      <Badge pos="absolute" bottom={14} right={14} variant="filled" color="dark" size="sm">{activeImage + 1} / {images.length}</Badge>
                    </>}
                  </Box>
                  {/* Thumbnails */}
                  {images.length > 1 && (
                    <Carousel
                      slideSize="120px"
                      slideGap="xs"
                      withControls={false}
                      style={{ padding: 8 }}
                    >
                      {images.map((img, i) => (
                        <Carousel.Slide key={i}>
                          <UnstyledButton
                            type="button"
                            aria-label={`Показать фото ${i + 1}`}
                            aria-current={activeImage === i ? "true" : undefined}
                            style={{
                              width: 110,
                              height: 80,
                              borderRadius: 8,
                              overflow: "hidden",
                              cursor: "pointer",
                              border: activeImage === i ? "2px solid #4f46e5" : "2px solid transparent",
                              transition: "border-color 150ms ease",
                            }}
                            onClick={() => selectImage(i)}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={img} alt="" onError={(event) => { event.currentTarget.style.opacity = "0" }} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          </UnstyledButton>
                        </Carousel.Slide>
                      ))}
                    </Carousel>
                  )}
                </>
              ) : (
                <Box className="vehicle-detail-gallery__empty-state">
                  <Stack align="center" gap={6}>
                    <Box className="vehicle-detail-gallery__empty-icon">{typeMeta.icon}</Box>
                    <Text size="sm" fw={700} c="var(--market-ink)">Фотографии ещё не добавлены</Text>
                    <Text size="xs" c="dimmed" ta="center">Запросите фото у продавца перед договорённостью.</Text>
                  </Stack>
                </Box>
              )}
            </Card>

            {/* Характеристики */}
            <Card withBorder radius="lg" p="lg" className="vehicle-detail-specs">
              <Group justify="space-between" mb="md" align="center" gap="sm" wrap="wrap">
                <Group gap="sm" wrap="nowrap">
                  <ThemeIcon variant="light" color="indigo" size={34} radius="md"><IconEngine size={18} /></ThemeIcon>
                  <Box>
                    <Title order={3} size="h4">Характеристики</Title>
                    <Text size="xs" c="dimmed">Параметры, указанные продавцом</Text>
                  </Box>
                </Group>
                {identityValue && <Badge variant="light" color="gray" radius="xl" className="vehicle-detail-specs__identity">{identityMeta.badgeLabel}: {identityValue}</Badge>}
              </Group>
              <Box className="vehicle-detail-specs__grid">
                {specs.map((spec, i) => (
                  <Box key={`${spec.label}-${i}`} className="vehicle-detail-specs__item">
                    <Group gap={5} wrap="nowrap" className="vehicle-detail-specs__label">
                      <Box className="vehicle-detail-specs__icon">{spec.icon}</Box>
                      <Text size="xs">{spec.label}</Text>
                    </Group>
                    <Text className="vehicle-detail-specs__value">{spec.value}</Text>
                  </Box>
                ))}
              </Box>
            </Card>

            {/* Состояние и документы */}
            <Card withBorder radius="lg" p="lg" className="vehicle-detail-statuses">
              <Stack gap="md">
                <Group justify="space-between" align="center" gap="sm" wrap="wrap">
                  <Group gap="sm" wrap="nowrap">
                    <ThemeIcon variant="light" color="indigo" size={34} radius="md"><IconShieldCheck size={18} /></ThemeIcon>
                    <Box>
                      <Title order={3} size="h4">Состояние и документы</Title>
                      <Text size="xs" c="dimmed">Ключевые сведения из объявления продавца</Text>
                    </Box>
                  </Group>
                  <Badge variant="light" color="gray" radius="xl">Данные объявления</Badge>
                </Group>
                <Box className="vehicle-detail-statuses__grid">
                  {statusItems.map((item) => (
                    <Box key={item.label} className="vehicle-detail-statuses__item" data-state={item.state}>
                      <Text className="vehicle-detail-statuses__label">{item.label}</Text>
                      <Text className="vehicle-detail-statuses__value">{item.value}</Text>
                    </Box>
                  ))}
                </Box>
              </Stack>
            </Card>

            {/* VIN-паспорт выводится только для дорожного транспорта и без демо-утверждений. */}
            {hasRoadVehicleDetails && data.vin && <Card withBorder radius="lg" p="lg" className="vehicle-detail-feature-card vehicle-detail-feature-card--vin">
              <Group justify="space-between" mb="sm">
                <Group gap={8}>
                  <ThemeIcon variant="light" color="green" size={32} radius="md">
                    <IconShieldCheck size={18} />
                  </ThemeIcon>
                  <Title order={3} size="h4">VIN-паспорт</Title>
                </Group>
                <Badge variant="light" color="gray" size="md">Данные объявления</Badge>
              </Group>
              <Box className="vehicle-detail-vin-grid">
                <VinField label="VIN" value={data.vin} />
                {usageDisplay && <VinField label={usageMeta.label} value={usageDisplay} status="ok" />}
                <VinField label="Владельцев по ПТС" value={data.ownersCount ? String(data.ownersCount) : "Не указано"} status="ok" />
                <VinField label="Проверка ограничений" value="Подключается отдельно" />
                <VinField label="История ДТП" value="Подключается отдельно" />
              </Box>
              <Group mt="md" gap="xs">
                <IconShieldCheck size={14} color="#16a34a" />
                <Text size="xs" c="var(--market-success-text)">Проверка по внешним базам будет показана после подключения провайдера.</Text>
              </Group>
            </Card>}

            {/* Безопасная сделка */}
            <Card withBorder radius="lg" p="lg" className="vehicle-detail-feature-card vehicle-detail-feature-card--deal">
              <Group gap="md" align="flex-start">
                <ThemeIcon variant="light" color="indigo" size={44} radius="md">
                  <IconShieldCheck size={24} />
                </ThemeIcon>
                <Stack gap={6} style={{ flex: 1 }}>
                  <Title order={3} size="h4">Сопровождаемая сделка</Title>
                  <Text size="sm" c="var(--market-muted)">
                    Проверка продавца и документов, прозрачные этапы и поддержка до передачи ключей.
                    Платформа не удерживает деньги: платежи оформляются по согласованным сторонами реквизитам.
                  </Text>
                  <Group gap={6} mt={4}>
                    <IconCheck size={14} color="#4f46e5" />
                    <Text size="xs" c="#4f46e5">Проверка данных объявления</Text>
                  </Group>
                  <Group gap={6}>
                    <IconCheck size={14} color="#4f46e5" />
                    <Text size="xs" c="#4f46e5">Проверка документов</Text>
                  </Group>
                  <Group gap={6}>
                    <IconCheck size={14} color="#4f46e5" />
                    <Text size="xs" c="#4f46e5">Статусы и поддержка</Text>
                  </Group>
                </Stack>
                <Button component={Link} href="/services/safe-deal" variant="light" color="indigo" radius="md" size="md">Как это работает</Button>
              </Group>
            </Card>

            {/* Описание */}
            {data.description && (
              <Card withBorder radius="lg" p="lg">
                <Title order={3} size="h4" mb="sm">Описание</Title>
                <Text size="sm" c="var(--market-muted)" lh={1.6} style={{ whiteSpace: "pre-wrap" }}>
                  {data.description}
                </Text>
              </Card>
            )}

            {/* Отзывы */}
            <Card withBorder radius="lg" p="lg">
              <Group justify="space-between" align="center" mb="md">
                <Title order={3} size="h4">Отзывы ({data.reviews.length})</Title>
              </Group>

              {/* Форма отзыва */}
              {session ? (
                <Paper radius="md" p="md" withBorder mb="md" style={{ background: "var(--market-surface-subtle)" }}>
                  <Stack gap="sm">
                    <Group gap="sm">
                      <Text size="sm" fw={600} c="var(--market-ink)">Ваш отзыв</Text>
                      <Rating value={reviewRating} onChange={setReviewRating} size="md" />
                    </Group>
                    <Textarea aria-label="Текст отзыва об автомобиле" placeholder="Поделитесь впечатлениями об авто..." value={reviewText} onChange={(e) => setReviewText(e.target.value)} size="sm" minRows={2} autosize />
                    <Group justify="flex-end">
                      <Button size="sm" color="indigo" radius="md" onClick={submitReview} loading={reviewSubmitting} disabled={!reviewText.trim()}>
                        Отправить отзыв
                      </Button>
                    </Group>
                  </Stack>
                </Paper>
              ) : (
                <Paper radius="md" p="md" withBorder mb="md" style={{ background: "var(--market-surface-subtle)" }}>
                  <Group gap="sm" justify="center">
                    <Text size="sm" c="var(--market-muted)">Чтобы оставить отзыв,</Text>
                    <Anchor component={Link} href="/auth/signin" size="sm" c="indigo" fw={600}>войдите</Anchor>
                  </Group>
                </Paper>
              )}

              {data.reviews.length > 0 ? (
                <Stack gap="md">
                  {data.reviews.map((review) => (
                    <Box key={review.id}>
                      <Group gap="sm" mb={6}>
                        <Avatar src={review.user.image} radius="xl" size="sm" color="indigo">
                          {review.user.name?.[0]?.toUpperCase()}
                        </Avatar>
                        <Stack gap={2}>
                          <Text size="sm" fw={500}>{review.user.name || "Аноним"}</Text>
                          <Rating value={review.rating} size="xs" readOnly />
                        </Stack>
                        <Text size="xs" c="var(--market-muted)" ml="auto">{formatRelativeDate(review.createdAt)}</Text>
                      </Group>
                      {review.comment && (
                        <Text size="sm" c="var(--market-muted)" pl={36}>{review.comment}</Text>
                      )}
                    </Box>
                  ))}
                </Stack>
              ) : (
                <Text size="sm" c="var(--market-muted)" ta="center" py="md">Пока нет отзывов. Будьте первым!</Text>
              )}
            </Card>

            {/* Похожие */}
            {data.similar.length > 0 && (
              <Box>
                <Title order={3} size="h4" mb="md">Похожие объявления</Title>
                <Box className="vehicle-detail-similar-grid">
                  {data.similar.map((item) => (
                    <Card
                      key={item.id}
                      component={Link}
                      href={`/listings/vehicle/${item.id}`}
                      withBorder
                      radius="md"
                      p="sm"
                      className="market-linked-card"
                    >
                      <Text size="sm" fw={500} className="line-clamp-1">{item.title}</Text>
                      <Text size="md" fw={700} c="indigo" mt={4}>{formatPriceShort(item.price)}</Text>
                    </Card>
                  ))}
                </Box>
              </Box>
            )}
          </Stack>
        </Box>

        {/* Правая колонка — цена + продавец + действия */}
        <Box className="vehicle-detail-layout__aside">
          <Box className="vehicle-detail-layout__sticky-aside">
            <Stack gap="md">
              {/* Цена и заголовок */}
              <Card withBorder radius="md" p="lg" style={{ borderColor: "var(--mantine-color-border)" }}>
                <Title
                  order={1}
                  size="h4"
                  mb={6}
                  ff="var(--font-display), sans-serif"
                  fw={700}
                  lh={1.2}
                  c="var(--market-ink)"
                >
                  {data.year} {data.make} {data.model}
                </Title>
                <Text
                  size="1.75rem"
                  fw={800}
                  c="var(--market-ink)"
                  ff="var(--font-display), sans-serif"
                  lh={1.1}
                  mb="xs"
                  style={{ letterSpacing: "-0.02em" }}
                >
                  {formatPrice(data.price)}
                </Text>
                <Badge variant="filled" color="green" size="sm" radius="sm" mb="xs" leftSection={<IconCheck size={12} />}>
                  Справедливая цена
                </Badge>
                <Group gap={6} mb="xs">
                  <Text size="xs" c="var(--market-muted)">в кредит от</Text>
                  <Text size="sm" fw={700} c="indigo">{Math.round(data.price * 0.025 / 1000)}к ₽/мес</Text>
                </Group>
                <Group gap={6}>
                  <IconMapPin size={13} color="var(--market-muted)" />
                  <Text size="xs" c="var(--market-muted)">{data.location}</Text>
                  <Text size="xs" c="var(--market-muted)">·</Text>
                  <Group gap={3}><IconEye size={12} color="var(--market-muted)" /><Text size="xs" c="var(--market-muted)">{viewCount} просмотров</Text></Group>
                </Group>
              </Card>

              {/* Действия */}
              <Card withBorder radius="lg" p="lg">
                <Stack gap="sm">
                  {phone ? (
                    <Button
                      component="a"
                      href={`tel:${phone}`}
                      size="lg"
                      radius="md"
                      leftSection={<IconPhone size={18} />}
                      variant="light"
                      color="indigo"
                    >
                      {phone}
                    </Button>
                  ) : (
                    <Button
                      size="lg"
                      radius="md"
                      leftSection={<IconPhone size={18} />}
                      color="indigo"
                      onClick={() => void revealPhone()}
                      loading={contactRevealing}
                      disabled={!data.listingId}
                    >
                      Показать телефон
                    </Button>
                  )}
                  {session?.user?.id === data.seller.id && data.listingId && (
                    <Button size="lg" radius="md" variant="light" color="indigo" leftSection={<IconEdit size={18} />} component={Link} href={`/listings/${data.listingId}/edit`}>
                      Редактировать объявление
                    </Button>
                  )}
                  <Button
                    size="lg"
                    radius="md"
                    variant="outline"
                    color="indigo"
                    leftSection={<IconMessageCircle2 size={18} />}
                    component={Link}
                    href={`/messages/new?listingId=${data.listingId || data.id}&recipientId=${data.seller.id}`}
                  >
                    Написать продавцу
                  </Button>
                  {/* Второстепенные действия — компактным рядом, а не тремя
                      кнопками во всю ширину: раньше «В избранное», «Сравнить»
                      и «Пожаловаться» занимали столько же места, сколько связь
                      с продавцом, и глазу не за что было зацепиться. */}
                  <Group gap={6} grow wrap="nowrap" className="detail-secondary-actions">
                    <Tooltip label={isFav ? "Убрать из избранного" : "В избранное"} withArrow>
                      <Button
                        size="sm"
                        radius="md"
                        variant={isFav ? "light" : "default"}
                        color={isFav ? "red" : "gray"}
                        onClick={toggleDetailFavorite}
                        loading={data.listingId ? isPending(data.listingId) : false}
                        disabled={!data.listingId}
                        aria-label={isFav ? "Убрать из избранного" : "Добавить в избранное"}
                        px={0}
                      >
                        <IconHeart size={18} fill={isFav ? "currentColor" : "none"} />
                      </Button>
                    </Tooltip>
                    <Tooltip label="Сравнить с другими" withArrow>
                      <Button
                        component={Link}
                        href={`/compare?ids=${data.id}`}
                        size="sm"
                        radius="md"
                        variant="default"
                        color="gray"
                        aria-label="Сравнить с другими объявлениями"
                        px={0}
                      >
                        <IconGitCompare size={18} />
                      </Button>
                    </Tooltip>
                    <Tooltip label="Пожаловаться" withArrow>
                      <Button
                        size="sm"
                        radius="md"
                        variant="default"
                        color="gray"
                        onClick={openReport}
                        aria-label="Пожаловаться на объявление"
                        px={0}
                      >
                        <IconFlag size={18} />
                      </Button>
                    </Tooltip>
                  </Group>
                </Stack>
              <CreditCalculator price={data.price} />
              </Card>

              {/* Решение модератора принимается там же, где видно нарушение,
                  а не после поиска той же карточки в админ-панели. */}
              {isAdmin(session?.user?.role) && data.listingId && (
                <ListingModerationActions
                  listingId={data.listingId}
                  sellerId={data.seller.id}
                  sellerName={data.seller.name}
                />
              )}

              {/* Продавец */}
              <Card withBorder radius="lg" p="lg">
                <Group gap="sm" mb="sm">
                  <Avatar src={data.seller.image} radius="xl" size="lg" color="indigo">
                    {data.seller.name?.[0]?.toUpperCase()}
                  </Avatar>
                  <Stack gap={2}>
                    <Text fw={600}>{data.seller.name || "Продавец"}</Text>
                    <Text size="xs" c="var(--market-muted)">На Авторынке с {formatDate(data.seller.memberSince)}</Text>
                  </Stack>
                </Group>
                <Divider mb="sm" />
                <Group gap={6} mb="xs">
                  <IconShieldCheck size={16} color="#10b981" />
                  <Text size="sm" c="var(--market-muted)">Проверенный продавец</Text>
                </Group>
                {data.seller.otherVehicles.length > 0 && (
                  <Box mt="sm">
                    <Text size="xs" c="var(--market-muted)" mb={6}>Другие объявления ({data.seller.otherVehicles.length})</Text>
                    {data.seller.otherVehicles.slice(0, 3).map((v) => (
                      <Anchor
                        key={v.id}
                        component={Link}
                        href={`/listings/vehicle/${v.id}`}
                        size="xs"
                        c="indigo"
                        display="block"
                      >
                        {v.year} {v.make} {v.model} — {formatPriceShort(v.price)}
                      </Anchor>
                    ))}
                  </Box>
                )}
              </Card>
            </Stack>
          </Box>
        </Box>
      </Box>
    </Container>
    <Modal
      opened={reportOpened}
      onClose={() => !reportSubmitting && setReportOpened(false)}
      title="Пожаловаться на объявление"
      centered
      radius="lg"
    >
      <Stack gap="md">
        <Text size="sm" c="var(--market-muted)">
          Жалобы рассматривает модерация. Укажите причину — это поможет быстрее проверить объявление.
        </Text>
        <Select
          label="Причина"
          value={reportReason}
          onChange={(value) => setReportReason(value || "MISLEADING")}
          data={[
            { value: "MISLEADING", label: "Недостоверная информация" },
            { value: "FRAUD", label: "Подозрение на мошенничество" },
            { value: "PROHIBITED", label: "Запрещённый контент" },
            { value: "DUPLICATE", label: "Повторное объявление" },
            { value: "OTHER", label: "Другая причина" },
          ]}
          allowDeselect={false}
        />
        <Textarea
          label="Комментарий"
          description="Необязательно, до 1000 символов"
          placeholder="Что именно требует проверки?"
          value={reportComment}
          onChange={(event) => setReportComment(event.currentTarget.value)}
          maxLength={1000}
          autosize
          minRows={3}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setReportOpened(false)} disabled={reportSubmitting}>Отмена</Button>
          <Button color="orange" leftSection={<IconFlag size={16} />} loading={reportSubmitting} onClick={() => void submitReport()}>
            Отправить жалобу
          </Button>
        </Group>
      </Stack>
    </Modal>
    </>
  )
}

function VinField({ label, value, status }: { label: string; value: string; status?: "ok" | "warn" }) {
  return (
    <Stack gap={2}>
      <Text size="xs" c="var(--market-muted)">{label}</Text>
      <Group gap={4}>
        {status === "ok" && <IconCheck size={13} color="#16a34a" />}
        <Text size="sm" fw={500} c={status === "ok" ? "#16a34a" : "var(--mantine-color-text)"}>{value}</Text>
      </Group>
    </Stack>
  )
}

