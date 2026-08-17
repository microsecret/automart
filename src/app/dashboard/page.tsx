"use client"
export const dynamic = "force-dynamic"
import { Suspense, useEffect, useState } from "react"
import useSWR from "swr"
import { notifications } from "@mantine/notifications"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Alert, Box, Stack, Group, Text, ThemeIcon, SimpleGrid, Paper, Badge, Center, Avatar, Button, Divider, ActionIcon, TextInput, Modal, Select, NumberInput, FileInput, ScrollArea } from "@mantine/core"
import { IconLayoutDashboard, IconTag, IconHeart, IconEye, IconStar, IconCar, IconPlus, IconSettings, IconTrendingUp, IconClock, IconExternalLink, IconTrash, IconEdit, IconAlertCircle, IconCircleCheck, IconFileDescription, IconClipboardCheck, IconArrowRight, IconTruckDelivery, IconTools, IconCreditCard, IconReceipt, IconAt, IconPhone, IconBrandTelegram, IconShieldCheck, IconPhoto, IconX } from "@tabler/icons-react"
import { useSession } from "next-auth/react"
import { formatPriceShort, formatMileage, formatRelativeDate, parseImages } from "@/lib/format"
import BrandIcon from "@/components/brands/BrandIcon"
import { fetchJson } from "@/lib/api-client"
import { AsyncErrorState, ResultsGridSkeleton } from "@/components/ui/AsyncStates"
import { LISTING_STATUS, LISTING_STATUS_META } from "@/lib/listing-lifecycle"
import VehicleFallback from "@/components/listings/VehicleFallback"
import { BODY_TYPES, CAR_BRANDS, CONDITIONS, findLabel, FUEL_TYPES, TRANSMISSIONS } from "@/lib/constants"
import DashboardNav from "@/components/dashboard/DashboardNav"
import { useMarketplaceImageUpload } from "@/hooks/useMarketplaceImageUpload"

type DashboardVehicle = {
  id: string
  make: string
  model: string
  year: number
  price: number
  mileage: number | null
  vin: string | null
  images: string | null
  location: string
  vehicleType: string
  bodyType: string | null
}

type DashboardPart = {
  id: string
  name: string
  price: number
  images: string | null
}

type DashboardListing = {
  id: string
  title: string
  price: number
  status: string
  statusReason: string | null
  isFeatured: boolean
  views: number
  createdAt: string
  vehicle: DashboardVehicle | null
  part: DashboardPart | null
}

type DashboardFavorite = {
  id: string
  price: number
  vehicle: DashboardVehicle | null
}

type PromotionOrder = {
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

type DashboardResponse = {
  stats: {
    totalListings: number
    totalViews: number
    favoritesCount: number
    reviewsCount: number
    garageCount: number
    avgRating: number
    memberSince: string | null
    promotionPaidCount: number
    promotionSpentRub: number
    activePromotions: number
  }
  workflow: {
    drafts: number
    pendingModeration: number
    active: number
    needsAttention: number
  }
  listings: DashboardListing[]
  favorites: DashboardFavorite[]
  promotionOrders: PromotionOrder[]
}

type GarageVehicle = {
  id: string
  make: string
  model: string
  year: number
  mileage: number | null
  fuelType: string
  transmission: string
  bodyType: string | null
  color: string | null
  condition: string
  location: string
  images: string | null
  createdAt: string
}

type GarageResponse = { vehicles: GarageVehicle[] }
type ListingDeleteResponse = { success: boolean }
type ProfileUpdateResponse = { user: { name: string } }
type AccountProfileResponse = {
  user: {
    id: string
    name: string | null
    email: string | null
    emailVerified: string | null
    image: string | null
    phone: string | null
    telegramUsername: string | null
    telegramVerifiedAt: string | null
    role: string
    createdAt: string
    registrationChannel: "TELEGRAM" | "WEB"
  }
}
type GarageMutationResponse = { success?: boolean; vehicle?: GarageVehicle }
type RemovalConfirmation = { kind: "listing" | "garage"; id: string; title: string }

type GarageForm = {
  make: string
  model: string
  year: number | ""
  mileage: number | ""
  fuelType: string
  transmission: string
  bodyType: string
  color: string
  vin: string
  condition: string
  location: string
}

const DASHBOARD_TABS = new Set(["listings", "payments", "favorites", "garage", "profile"])
const createGarageForm = (): GarageForm => ({
  make: "",
  model: "",
  year: new Date().getFullYear(),
  mileage: "",
  fuelType: "GASOLINE",
  transmission: "AUTOMATIC",
  bodyType: "",
  color: "",
  vin: "",
  condition: "EXCELLENT",
  location: "",
})

const formatMemberSince = (value: string | null) => value
  ? new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" }).format(new Date(value))
  : "—"

const formatRubles = (value: number) => new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
}).format(value)

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

export default function DashboardPage() {
  return (
    <Suspense fallback={<Box p={{ base: "sm", md: "md" }}><ResultsGridSkeleton count={6} mediaHeight={44} /></Box>}>
      <DashboardContent />
    </Suspense>
  )
}

function DashboardContent() {
  const { data: session, update: updateSession } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const createdListingId = searchParams.get("created")?.trim() || ""
  const [tab, setTab] = useState("listings")
  const [isProfileEditorOpen, setIsProfileEditorOpen] = useState(false)
  const [profileName, setProfileName] = useState("")
  const [isProfileSaving, setIsProfileSaving] = useState(false)
  const [isGarageModalOpen, setIsGarageModalOpen] = useState(false)
  const [garageForm, setGarageForm] = useState<GarageForm>(createGarageForm)
  const [isGarageSaving, setIsGarageSaving] = useState(false)
  const { images: garageImages, uploadingImages: isGarageImageUploading, uploadPhotos: uploadGaragePhotos, removeImage: removeGarageImage, replaceImages: replaceGarageImages } = useMarketplaceImageUpload()
  const [garageDeletingId, setGarageDeletingId] = useState<string | null>(null)
  const [removalConfirmation, setRemovalConfirmation] = useState<RemovalConfirmation | null>(null)
  const [isRemovalSaving, setIsRemovalSaving] = useState(false)
  const { data, error, isLoading, mutate } = useSWR<DashboardResponse>("/api/dashboard/stats", fetchJson)
  const { data: garageData, error: garageError, isLoading: isGarageLoading, mutate: mutateGarage } = useSWR<GarageResponse>(
    tab === "garage" ? "/api/garage" : null,
    fetchJson,
    { revalidateOnFocus: false },
  )
  const { data: accountData, error: accountError, isLoading: isAccountLoading, mutate: mutateAccount } = useSWR<AccountProfileResponse>(
    tab === "profile" && session?.user?.id ? `/api/users/${encodeURIComponent(session.user.id)}` : null,
    fetchJson,
    { revalidateOnFocus: false },
  )

  const selectTab = (nextTab: string) => {
    setTab(nextTab)
    const nextParams = new URLSearchParams(searchParams.toString())
    if (nextTab === "listings") nextParams.delete("tab")
    else nextParams.set("tab", nextTab)
    router.replace(nextParams.size ? `/dashboard?${nextParams.toString()}` : "/dashboard", { scroll: false })
  }

  const openGarageModal = () => {
    setGarageForm(createGarageForm())
    replaceGarageImages([])
    setIsGarageModalOpen(true)
  }

  const closeGarageModal = () => {
    if (isGarageSaving) return
    setIsGarageModalOpen(false)
    setGarageForm(createGarageForm())
    replaceGarageImages([])
  }

  const archiveListing = async (id: string) => {
    try {
      await fetchJson<ListingDeleteResponse>(`/api/listings/${id}`, { method: "DELETE" })
      notifications.show({ title: "Снято с публикации", message: "Объявление перенесено в архив", color: "green" })
      await mutate()
      return true
    } catch (error) {
      notifications.show({ title: "Ошибка", message: error instanceof Error ? error.message : "Не удалось удалить", color: "red" })
      return false
    }
  }

  useEffect(() => {
    setProfileName(session?.user?.name || "")
  }, [session?.user?.name])

  useEffect(() => {
    const requestedTab = searchParams.get("tab")
    setTab(requestedTab && DASHBOARD_TABS.has(requestedTab) ? requestedTab : "listings")
  }, [searchParams])

  const handleProfileSave = async () => {
    setIsProfileSaving(true)
    try {
      const payload = await fetchJson<ProfileUpdateResponse>("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: profileName }),
      })

      await updateSession({ name: payload.user.name })
      await mutateAccount()
      setIsProfileEditorOpen(false)
      notifications.show({ title: "Профиль обновлён", message: "Отображаемое имя сохранено.", color: "teal" })
    } catch (error) {
      notifications.show({ title: "Не удалось сохранить", message: error instanceof Error ? error.message : "Повторите попытку", color: "red" })
    } finally {
      setIsProfileSaving(false)
    }
  }

  const handleGarageSave = async () => {
    setIsGarageSaving(true)
    try {
      await fetchJson<GarageMutationResponse>("/api/garage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...garageForm, images: garageImages }),
      })

      setGarageForm(createGarageForm())
      replaceGarageImages([])
      setIsGarageModalOpen(false)
      await Promise.all([mutateGarage(), mutate()])
      notifications.show({ title: "Автомобиль добавлен", message: "Теперь можно отслеживать его в личном гараже.", color: "teal" })
    } catch (error) {
      notifications.show({ title: "Не удалось добавить автомобиль", message: error instanceof Error ? error.message : "Повторите попытку", color: "red" })
    } finally {
      setIsGarageSaving(false)
    }
  }

  const deleteGarageVehicle = async (id: string) => {
    setGarageDeletingId(id)
    try {
      await fetchJson<GarageMutationResponse>(`/api/garage?id=${encodeURIComponent(id)}`, { method: "DELETE" })

      await Promise.all([mutateGarage(), mutate()])
      notifications.show({ title: "Удалено из гаража", message: "Автомобиль больше не отображается в личном кабинете.", color: "gray" })
      return true
    } catch (error) {
      notifications.show({ title: "Не удалось удалить автомобиль", message: error instanceof Error ? error.message : "Повторите попытку", color: "red" })
      return false
    } finally {
      setGarageDeletingId(null)
    }
  }

  const confirmRemoval = async () => {
    if (!removalConfirmation) return
    const target = removalConfirmation
    setIsRemovalSaving(true)
    try {
      const succeeded = target.kind === "listing" ? await archiveListing(target.id) : await deleteGarageVehicle(target.id)
      if (succeeded) setRemovalConfirmation(null)
    } finally {
      setIsRemovalSaving(false)
    }
  }

  if (isLoading) return <Box p={{ base: "sm", md: "md" }}><ResultsGridSkeleton count={6} mediaHeight={44} /></Box>
  if (error || !data) return <Box p={{ base: "sm", md: "md" }}><AsyncErrorState title="Не удалось загрузить личный кабинет" description="Статистика и объявления временно недоступны. Повторите запрос." onRetry={() => mutate()} /></Box>

  const stats = data.stats
  const workflow = data.workflow
  const greetingName = session?.user?.name?.trim().split(" ")[0]
  const accountProfile = accountData?.user
  const accountCompletion = accountProfile ? Math.round([
    Boolean(accountProfile.name?.trim()),
    Boolean(accountProfile.email && accountProfile.emailVerified),
    Boolean(accountProfile.phone),
    Boolean(accountProfile.telegramVerifiedAt),
  ].filter(Boolean).length / 4 * 100) : 0
  const hasAttentionItems = workflow.needsAttention > 0

  return (
    <Box p={{ base: "sm", md: "md" }}>
      <Stack gap="md">
        <Group gap="sm" align="center" justify="space-between" wrap="nowrap">
          <Group gap="sm" align="center">
            <ThemeIcon variant="light" color="indigo" size={44} radius="md"><IconLayoutDashboard size={22} /></ThemeIcon>
            <Stack gap={0}>
              <Text component="h1" fw={800} fz={22} c="dark.9" ff="var(--font-display),sans-serif">Личный кабинет</Text>
              <Text size="xs" c="gray.5">{session?.user?.name || session?.user?.email}</Text>
            </Stack>
          </Group>
          <Button component={Link} href="/listings/create/vehicle" leftSection={<IconPlus size={16} />} color="indigo" radius="md" size="sm">Разместить</Button>
        </Group>

        <DashboardNav active={tab} />

        <Paper className="dashboard-workspace" radius="lg" p={{ base: "md", md: "lg" }} withBorder>
          <Group justify="space-between" align="flex-start" gap="lg" wrap="wrap">
            <Stack gap={5} maw={560}>
              <Badge className="dashboard-workspace__eyebrow" variant="light" color={hasAttentionItems ? "orange" : "indigo"} radius="xl">
                {hasAttentionItems ? "Требуется внимание" : "Рабочее пространство"}
              </Badge>
              <Text fw={850} fz={{ base: 22, md: 28 }} lh={1.08} ff="var(--font-display),sans-serif">
                {hasAttentionItems ? "Есть объявления, которым нужно ваше действие" : `Здравствуйте${greetingName ? `, ${greetingName}` : ""}. Всё под контролем.`}
              </Text>
              <Text size="sm" c="dimmed" maw={520}>
                {hasAttentionItems
                  ? "Откройте список объявлений: там есть карточки с причиной и следующим шагом."
                  : "Здесь собраны публикации, отклики и инструменты для работы с транспортом — без лишней навигации."}
              </Text>
            </Stack>
            <Group gap="xs" wrap="wrap">
              <Button component={Link} href="/listings/create/vehicle" color="indigo" radius="md" size="sm" leftSection={<IconPlus size={16} />}>Новое объявление</Button>
              <Button component={Link} href="/dashboard/deliveries" variant="light" color="indigo" radius="md" size="sm" leftSection={<IconTruckDelivery size={16} />}>Мои доставки</Button>
            </Group>
          </Group>

          <SimpleGrid className="dashboard-workspace__status-grid" cols={{ base: 2, sm: 4 }} spacing="xs" mt="lg">
            {[
              { label: "Черновики", value: workflow.drafts, icon: <IconFileDescription size={17} />, color: "gray" },
              { label: "На проверке", value: workflow.pendingModeration, icon: <IconClipboardCheck size={17} />, color: "yellow" },
              { label: "Активные", value: workflow.active, icon: <IconCircleCheck size={17} />, color: "teal" },
              { label: "Нужно открыть", value: workflow.needsAttention, icon: <IconAlertCircle size={17} />, color: hasAttentionItems ? "orange" : "gray" },
            ].map((item) => (
              <Button key={item.label} variant="subtle" color={item.color} className="dashboard-workspace__status" onClick={() => selectTab("listings")} rightSection={<IconArrowRight size={14} />}>
                <ThemeIcon size={30} radius="md" variant="light" color={item.color}>{item.icon}</ThemeIcon>
                <Stack gap={0} align="flex-start" style={{ flex: 1 }}>
                  <Text size="xs" c="dimmed" fw={650}>{item.label}</Text>
                  <Text size="lg" c="dark.9" fw={850} lh={1}>{item.value}</Text>
                </Stack>
              </Button>
            ))}
          </SimpleGrid>
        </Paper>

        {/* Карточки статистики */}
        <SimpleGrid cols={{ base: 2, sm: 3, lg: 6 }} spacing="sm">
          {[
            { label: "Объявления", value: stats.totalListings, icon: <IconTag size={18} />, color: "#4f46e5", bg: "#eef2ff" },
            { label: "Просмотры", value: stats.totalViews, icon: <IconEye size={18} />, color: "#0891b2", bg: "#ecfeff" },
            { label: "Избранное", value: stats.favoritesCount, icon: <IconHeart size={18} />, color: "#e11d48", bg: "#fff1f2" },
            { label: "Отзывы", value: stats.reviewsCount, icon: <IconStar size={18} />, color: "#ea580c", bg: "#fff7ed" },
            { label: "В гараже", value: stats.garageCount, icon: <IconCar size={18} />, color: "#059669", bg: "#ecfdf5" },
            { label: "Рейтинг", value: stats.avgRating || "—", icon: <IconTrendingUp size={18} />, color: "#7c3aed", bg: "#f5f3ff" },
          ].map((s) => (
            <Paper key={s.label} radius="md" p="sm" withBorder style={{ borderColor: "var(--mantine-color-border)" }}>
              <Group gap="sm" align="center">
                <Box style={{ width: 36, height: 36, borderRadius: 8, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", color: s.color }}>
                  {s.icon}
                </Box>
                <Stack gap={0}>
                  <Text size="xl" fw={800} c="dark.9" lh={1}>{s.value}</Text>
                  <Text size="xs" c="gray.5">{s.label}</Text>
                </Stack>
              </Group>
            </Paper>
          ))}
        </SimpleGrid>

        {/* Контент табов */}
        {tab === "listings" && (
          <Stack gap="xs" id="dashboard-listings">
            {createdListingId && (
              <Alert color="teal" variant="light" title="Объявление отправлено на модерацию" icon={<IconCircleCheck size={18} />}>
                Карточка сохранена в «Моих объявлениях». Здесь будет виден результат проверки и причина, если понадобятся исправления.
              </Alert>
            )}
            {data.listings.length === 0 ? (
              <Paper radius="md" p="xl" withBorder>
                <Center>
                  <Stack align="center" gap="sm">
                    <ThemeIcon variant="light" color="indigo" size={48} radius="md"><IconTag size={24} /></ThemeIcon>
                    <Text c="gray.5">У вас пока нет объявлений</Text>
                    <Button component={Link} href="/listings/create/vehicle" size="sm" color="indigo" leftSection={<IconPlus size={16} />}>Создать первое</Button>
                  </Stack>
                </Center>
              </Paper>
            ) : (
              data.listings.map((l) => {
                const isVehicle = !!l.vehicle
                const images = parseImages(isVehicle ? l.vehicle?.images : l.part?.images)
                const image = images[0]
                const listingTarget = l.vehicle || l.part
                if (!listingTarget) return null
                const href = isVehicle ? `/listings/vehicle/${listingTarget.id}` : `/listings/part/${listingTarget.id}`
                const statusMeta = LISTING_STATUS_META[l.status as keyof typeof LISTING_STATUS_META] || LISTING_STATUS_META[LISTING_STATUS.DRAFT]
                return (
                  <Paper key={l.id} className="dashboard-listing-card" radius="md" p="sm" withBorder>
                    <Group gap="md" align="center" wrap="nowrap">
                      <Link href={href} style={{ flexShrink: 0 }}>
                        <Box className="dashboard-listing-card__media">
                          {image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={image} alt={l.title} loading="lazy" />
                          ) : isVehicle ? (
                            <VehicleFallback type={l.vehicle?.vehicleType || "CAR"} bodyType={l.vehicle?.bodyType} compact />
                          ) : (
                            <ThemeIcon variant="light" color="indigo" size={34} radius="xl" aria-label="Фото запчасти не добавлено"><IconTools size={18} /></ThemeIcon>
                          )}
                        </Box>
                      </Link>
                      <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                        <Group gap="sm" align="center">
                          {isVehicle && l.vehicle && <BrandIcon brand={l.vehicle.make} size={28} />}
                          <Link href={href} style={{ textDecoration: "none" }}>
                            <Text fw={600} fz="sm" c="dark.9" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.title}</Text>
                          </Link>
                          <Badge size="xs" color={statusMeta.color} variant="light">{statusMeta.label}</Badge>
                          {l.isFeatured && <Badge size="xs" color="violet" variant="light">Премиум</Badge>}
                        </Group>
                        <Text fz="xs" c="gray.5">{isVehicle && l.vehicle ? `${formatMileage(l.vehicle.mileage)} · ${l.vehicle.location || "—"}` : l.part?.name}</Text>
                        {l.statusReason && l.status !== LISTING_STATUS.ACTIVE && <Text fz="xs" c="red.6" lineClamp={1}>{l.statusReason}</Text>}
                        <Group gap="md">
                          <Text fw={800} fz="md" c="dark.9" ff="var(--font-display),sans-serif">{formatPriceShort(l.price)}</Text>
                          <Group gap={4}>
                            <IconEye size={13} color="gray.4" />
                            <Text fz="xs" c="gray.4">{l.views} просмотров</Text>
                          </Group>
                          <Group gap={4}>
                            <IconClock size={13} color="gray.4" />
                            <Text fz="xs" c="gray.4">{formatRelativeDate(l.createdAt)}</Text>
                          </Group>
                        </Group>
                      </Stack>
                      <Group gap={4}>
                        <ActionIcon component={Link} href={href} variant="subtle" color="gray" size="sm" aria-label={`Открыть ${l.title}`}><IconExternalLink size={16} /></ActionIcon>
                        <ActionIcon component={Link} href={`/listings/${l.id}/edit`} variant="subtle" color="indigo" size="sm" aria-label={`Редактировать ${l.title}`}><IconEdit size={16} /></ActionIcon>
                        <ActionIcon component={Link} href={`/listings/${l.id}/promote`} variant="subtle" color="violet" size="sm" aria-label={`Продвинуть ${l.title}`}><IconTrendingUp size={16} /></ActionIcon>
                        <ActionIcon variant="subtle" color="red" size="sm" aria-label={`Архивировать ${l.title}`} onClick={() => setRemovalConfirmation({ kind: "listing", id: l.id, title: l.title })}><IconTrash size={16} /></ActionIcon>
                      </Group>
                    </Group>
                  </Paper>
                )
              })
            )}
          </Stack>
        )}

        {tab === "payments" && (
          <Stack gap="md">
            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
              <Paper radius="md" p="md" withBorder>
                <Group gap="sm" wrap="nowrap">
                  <ThemeIcon color="indigo" variant="light" size={40} radius="md"><IconCreditCard size={20} /></ThemeIcon>
                  <Stack gap={1}>
                    <Text size="xs" c="dimmed">Оплачено за продвижение</Text>
                    <Text fw={850} fz="xl">{formatRubles(stats.promotionSpentRub)}</Text>
                  </Stack>
                </Group>
              </Paper>
              <Paper radius="md" p="md" withBorder>
                <Group gap="sm" wrap="nowrap">
                  <ThemeIcon color="teal" variant="light" size={40} radius="md"><IconTrendingUp size={20} /></ThemeIcon>
                  <Stack gap={1}>
                    <Text size="xs" c="dimmed">Активные продвижения</Text>
                    <Text fw={850} fz="xl">{stats.activePromotions}</Text>
                  </Stack>
                </Group>
              </Paper>
              <Paper radius="md" p="md" withBorder>
                <Group gap="sm" wrap="nowrap">
                  <ThemeIcon color="violet" variant="light" size={40} radius="md"><IconReceipt size={20} /></ThemeIcon>
                  <Stack gap={1}>
                    <Text size="xs" c="dimmed">Успешные оплаты</Text>
                    <Text fw={850} fz="xl">{stats.promotionPaidCount}</Text>
                  </Stack>
                </Group>
              </Paper>
            </SimpleGrid>

            <Paper radius="lg" p={{ base: "md", md: "lg" }} withBorder>
              <Group justify="space-between" align="flex-start" mb="md" gap="sm">
                <Stack gap={1}>
                  <Text fw={800} fz="lg">История продвижений</Text>
                  <Text size="sm" c="dimmed">Здесь отображаются только реальные заказы и подтверждённые платежи.</Text>
                </Stack>
                <Button component={Link} href="/dashboard?tab=listings" variant="light" color="indigo" size="sm" leftSection={<IconTrendingUp size={16} />}>Выбрать объявление</Button>
              </Group>

              {data.promotionOrders.length === 0 ? (
                <Center py={{ base: "xl", md: 48 }}>
                  <Stack align="center" gap="sm" ta="center" maw={420}>
                    <ThemeIcon color="indigo" variant="light" size={52} radius="xl"><IconReceipt size={25} /></ThemeIcon>
                    <Text fw={750}>Оплат пока не было</Text>
                    <Text size="sm" c="dimmed">Продвижение можно подключить у активного объявления после настройки платёжного провайдера.</Text>
                    <Button onClick={() => selectTab("listings")} color="indigo" size="sm">Перейти к объявлениям</Button>
                  </Stack>
                </Center>
              ) : (
                <Stack gap="xs">
                  {data.promotionOrders.map((order) => {
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
                              Тариф «{PROMOTION_TARIFF_LABELS[order.tariffId] || order.tariffId}» · {order.durationDays} дн. · заказ от {new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(new Date(order.createdAt))}
                            </Text>
                            {order.promoUntil && <Text size="xs" c="teal.7">Продвижение до {new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(new Date(order.promoUntil))}</Text>}
                          </Stack>
                          <Group gap="xs">
                            <Text fw={850}>{formatRubles(order.amountRub)}</Text>
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
        )}

        {tab === "favorites" && (
          <Stack gap="xs">
            {data.favorites.length === 0 ? (
              <Paper radius="md" p="xl" withBorder>
                <Center>
                  <Stack align="center" gap="sm">
                    <ThemeIcon variant="light" color="red" size={48} radius="md"><IconHeart size={24} /></ThemeIcon>
                    <Text c="gray.5">В избранном пока пусто</Text>
                    <Button component={Link} href="/" size="sm" variant="light" color="indigo">Найти авто</Button>
                  </Stack>
                </Center>
              </Paper>
            ) : (
              <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="sm">
                {data.favorites.map((fav) => {
                  const v = fav.vehicle
                  if (!v) return null
                  const images = parseImages(v.images)
                  const image = images[0]
                  return (
                    <Paper key={fav.id} className="dashboard-favorite-card" radius="md" p={0} withBorder>
                      <Link href={`/listings/vehicle/${v.id}`}>
                        <Box className="dashboard-favorite-card__media">
                          {image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={image} alt={`${v.make} ${v.model}`} loading="lazy" />
                          ) : <VehicleFallback type={v.vehicleType || "CAR"} bodyType={v.bodyType} />}
                          <Box pos="absolute" top={8} right={8}><BrandIcon brand={v.make} size={28} /></Box>
                        </Box>
                      </Link>
                      <Box p="sm">
                        <Text fw={800} fz="md" c="dark.9">{formatPriceShort(fav.price)}</Text>
                        <Text fz="xs" c="gray.6">{v.make} {v.model}, {v.year}</Text>
                        <Text fz="xs" c="gray.4">{formatMileage(v.mileage)}</Text>
                      </Box>
                    </Paper>
                  )
                })}
              </SimpleGrid>
            )}
          </Stack>
        )}

        {tab === "garage" && (
          <Paper className="dashboard-garage" radius="lg" p={{ base: "md", md: "lg" }} withBorder>
            <Group justify="space-between" align="flex-start" mb="md" gap="md" wrap="wrap">
              <Group gap="sm" align="center">
                <ThemeIcon variant="light" color="teal" size={42} radius="md"><IconCar size={21} /></ThemeIcon>
                <Stack gap={1}>
                  <Text fw={800} fz="lg" c="dark.9" ff="var(--font-display),sans-serif">Личный гараж</Text>
                  <Text size="sm" c="dimmed">Ваши автомобили не публикуются в каталоге и доступны только вам.</Text>
                </Stack>
              </Group>
              <Button color="teal" radius="md" size="sm" leftSection={<IconPlus size={16} />} onClick={openGarageModal}>Добавить автомобиль</Button>
            </Group>

            {isGarageLoading ? (
              <ResultsGridSkeleton count={3} mediaHeight={96} />
            ) : garageError ? (
              <AsyncErrorState title="Не удалось открыть гараж" description="Список автомобилей временно недоступен. Повторите запрос." onRetry={() => mutateGarage()} />
            ) : garageData?.vehicles.length ? (
              <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
                {garageData.vehicles.map((vehicle) => {
                  const vehicleImages = parseImages(vehicle.images)
                  const vehicleImage = vehicleImages[0]
                  return (
                    <Paper key={vehicle.id} className="garage-vehicle-card" radius="md" withBorder style={{ overflow: "hidden" }}>
                      <Box className="garage-vehicle-card__media">
                        {vehicleImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={vehicleImage} alt={`${vehicle.make} ${vehicle.model}`} loading="lazy" />
                        ) : <VehicleFallback type="CAR" bodyType={vehicle.bodyType} compact />}
                        <Box className="garage-vehicle-card__brand"><BrandIcon brand={vehicle.make} size={30} /></Box>
                      </Box>
                      <Stack gap={8} p="sm">
                        <Group justify="space-between" gap="xs" wrap="nowrap">
                          <Stack gap={1} style={{ minWidth: 0 }}>
                            <Text fw={800} fz="sm" c="dark.9" truncate>{vehicle.make} {vehicle.model}</Text>
                            <Text size="xs" c="dimmed">{vehicle.year} г.{vehicle.mileage != null ? ` · ${formatMileage(vehicle.mileage)}` : ""}</Text>
                          </Stack>
                          <Badge color="teal" variant="light" radius="xl" size="sm">Личный</Badge>
                        </Group>
                        <Group gap={5} wrap="wrap">
                          {vehicle.bodyType && <Badge color="gray" variant="light" size="xs">{findLabel(BODY_TYPES, vehicle.bodyType)}</Badge>}
                          <Badge color="indigo" variant="light" size="xs">{findLabel(FUEL_TYPES, vehicle.fuelType)}</Badge>
                          <Badge color="violet" variant="light" size="xs">{findLabel(TRANSMISSIONS, vehicle.transmission)}</Badge>
                          {vehicle.color && <Badge color="gray" variant="outline" size="xs">{vehicle.color}</Badge>}
                        </Group>
                        <Group justify="space-between" align="center" mt={2}>
                          <Text size="xs" c="gray.5" truncate>{vehicle.location || "Город не указан"}</Text>
                          <ActionIcon color="red" variant="subtle" size="sm" aria-label={`Удалить ${vehicle.make} ${vehicle.model} из гаража`} loading={garageDeletingId === vehicle.id} onClick={() => setRemovalConfirmation({ kind: "garage", id: vehicle.id, title: `${vehicle.make} ${vehicle.model}` })}>
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Group>
                        <Button component={Link} href={`/listings/create/vehicle?garageId=${encodeURIComponent(vehicle.id)}`} variant="light" color="teal" size="xs" radius="md" fullWidth rightSection={<IconArrowRight size={14} />}>Создать объявление из гаража</Button>
                      </Stack>
                    </Paper>
                  )
                })}
              </SimpleGrid>
            ) : (
              <Center py={{ base: "xl", md: 56 }}>
                <Stack align="center" gap="sm" maw={420} ta="center">
                  <ThemeIcon variant="light" color="teal" size={54} radius="xl"><IconCar size={27} /></ThemeIcon>
                  <Text fw={750} fz="lg">В гараже пока нет автомобилей</Text>
                  <Text size="sm" c="dimmed">Добавьте свою машину, чтобы хранить данные приватно, а когда понадобится — создать из неё объявление без повторного ввода.</Text>
                  <Button color="teal" radius="md" size="sm" leftSection={<IconPlus size={16} />} onClick={openGarageModal}>Добавить первый автомобиль</Button>
                </Stack>
              </Center>
            )}
          </Paper>
        )}

        {tab === "profile" && (
          <Paper radius="md" p="lg" withBorder>
            <Stack gap="md">
              {accountError && (
                <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />}>
                  Не удалось загрузить данные аккаунта. Проверьте соединение и повторите попытку.
                  <Button variant="subtle" color="red" size="compact-sm" ml="xs" onClick={() => mutateAccount()}>Повторить</Button>
                </Alert>
              )}
              <Group gap="md" align="center">
                <Avatar src={accountProfile?.image || session?.user?.image} size={64} radius="xl" color="indigo">{(accountProfile?.name || session?.user?.name)?.[0]?.toUpperCase()}</Avatar>
                <Stack gap={3} style={{ minWidth: 0, flex: 1 }}>
                  <Group gap="xs" wrap="wrap">
                    <Text fw={700} fz="lg" c="dark.9">{accountProfile?.name || session?.user?.name || "Без имени"}</Text>
                    {accountCompletion === 100
                      ? <Badge color="teal" variant="light" leftSection={<IconShieldCheck size={12} />}>Аккаунт подтверждён</Badge>
                      : <Badge color="yellow" variant="light">Профиль заполнен на {accountCompletion}%</Badge>}
                  </Group>
                  <Text size="sm" c="gray.5" truncate>{accountProfile?.email || session?.user?.email || "Почта не указана"}</Text>
                  {stats.avgRating > 0 && (
                    <Group gap={4}>
                      <IconStar size={14} color="#f59e0b" fill="#f59e0b" />
                      <Text size="xs" c="gray.5">{stats.avgRating} рейтинг</Text>
                    </Group>
                  )}
                </Stack>
              </Group>
              {isAccountLoading && !accountProfile ? (
                <Text size="sm" c="dimmed" aria-live="polite">Загружаем подтверждённые данные аккаунта…</Text>
              ) : accountProfile && (
                <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
                  <Paper radius="md" p="sm" bg="gray.0">
                    <Group gap="xs" wrap="nowrap" align="flex-start">
                      <ThemeIcon variant="light" color="indigo" radius="md" size={34}><IconAt size={17} /></ThemeIcon>
                      <Box style={{ minWidth: 0 }}>
                        <Text size="xs" c="dimmed">Почта для входа</Text>
                        <Text size="sm" fw={650} truncate>{accountProfile.email || "Не указана"}</Text>
                        <Text size="xs" c={accountProfile.emailVerified ? "teal.7" : "yellow.8"}>{accountProfile.emailVerified ? "Подтверждена" : "Требует подтверждения"}</Text>
                      </Box>
                    </Group>
                  </Paper>
                  <Paper radius="md" p="sm" bg="gray.0">
                    <Group gap="xs" wrap="nowrap" align="flex-start">
                      <ThemeIcon variant="light" color="teal" radius="md" size={34}><IconPhone size={17} /></ThemeIcon>
                      <Box style={{ minWidth: 0 }}>
                        <Text size="xs" c="dimmed">Телефон</Text>
                        <Text size="sm" fw={650} truncate>{accountProfile.phone || "Не указан"}</Text>
                        <Text size="xs" c={accountProfile.telegramVerifiedAt ? "teal.7" : "yellow.8"}>{accountProfile.telegramVerifiedAt ? "Подтверждён через Telegram" : "Не подтверждён"}</Text>
                      </Box>
                    </Group>
                  </Paper>
                  <Paper radius="md" p="sm" bg="gray.0">
                    <Group gap="xs" wrap="nowrap" align="flex-start">
                      <ThemeIcon variant="light" color="blue" radius="md" size={34}><IconBrandTelegram size={17} /></ThemeIcon>
                      <Box style={{ minWidth: 0 }}>
                        <Text size="xs" c="dimmed">Telegram</Text>
                        <Text size="sm" fw={650} truncate>{accountProfile.telegramUsername ? `@${accountProfile.telegramUsername}` : "Профиль без username"}</Text>
                        <Text size="xs" c={accountProfile.telegramVerifiedAt ? "teal.7" : "yellow.8"}>{accountProfile.telegramVerifiedAt ? "Личность подтверждена" : "Не привязан"}</Text>
                      </Box>
                    </Group>
                  </Paper>
                </SimpleGrid>
              )}
              <Divider />
              <SimpleGrid cols={2} spacing="sm">
                <Box><Text size="xs" c="gray.4">На сайте с</Text><Text size="sm" fw={600} c="dark.9">{formatMemberSince(accountProfile?.createdAt || stats.memberSince)}</Text></Box>
                <Box><Text size="xs" c="gray.4">Всего объявлений</Text><Text size="sm" fw={600} c="dark.9">{stats.totalListings}</Text></Box>
                <Box><Text size="xs" c="gray.4">Просмотров всего</Text><Text size="sm" fw={600} c="dark.9">{stats.totalViews}</Text></Box>
                <Box><Text size="xs" c="gray.4">Отзывов</Text><Text size="sm" fw={600} c="dark.9">{stats.reviewsCount}</Text></Box>
              </SimpleGrid>
              {!isProfileEditorOpen ? (
                <Button variant="light" color="indigo" size="sm" leftSection={<IconSettings size={16} />} radius="md" onClick={() => setIsProfileEditorOpen(true)}>Редактировать профиль</Button>
              ) : (
                <Stack gap="xs">
                  <TextInput label="Отображаемое имя" value={profileName} onChange={(event) => setProfileName(event.currentTarget.value)} maxLength={60} />
                  <Group gap="xs">
                    <Button size="sm" color="indigo" loading={isProfileSaving} onClick={handleProfileSave}>Сохранить</Button>
                    <Button size="sm" variant="subtle" color="gray" disabled={isProfileSaving} onClick={() => { setProfileName(session?.user?.name || ""); setIsProfileEditorOpen(false) }}>Отмена</Button>
                  </Group>
                </Stack>
              )}
            </Stack>
          </Paper>
        )}
      </Stack>

      <Modal opened={isGarageModalOpen} onClose={closeGarageModal} title="Добавить автомобиль в гараж" radius="lg" size="xl" yOffset="4vh" scrollAreaComponent={ScrollArea.Autosize}>
        <Stack gap="md">
          <Text size="sm" c="dimmed">Это личная запись: она не появится в каталоге и доступна только владельцу кабинета.</Text>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            <Select
              required
              searchable
              label="Марка"
              placeholder="Выберите марку"
              data={CAR_BRANDS.map((brand) => ({ value: brand, label: brand }))}
              value={garageForm.make || null}
              onChange={(value) => setGarageForm((current) => ({ ...current, make: value || "" }))}
            />
            <TextInput required label="Модель" placeholder="Например, Camry" value={garageForm.model} onChange={(event) => setGarageForm((current) => ({ ...current, model: event.currentTarget.value }))} maxLength={80} />
            <NumberInput
              required
              label="Год выпуска"
              value={garageForm.year === "" ? undefined : garageForm.year}
              min={1900}
              max={new Date().getFullYear() + 1}
              allowDecimal={false}
              onChange={(value) => setGarageForm((current) => ({ ...current, year: typeof value === "number" ? value : "" }))}
            />
            <NumberInput
              label="Пробег, км"
              placeholder="Необязательно"
              value={garageForm.mileage === "" ? undefined : garageForm.mileage}
              min={0}
              max={3_000_000}
              allowDecimal={false}
              thousandSeparator=" "
              onChange={(value) => setGarageForm((current) => ({ ...current, mileage: typeof value === "number" ? value : "" }))}
            />
            <Select label="Топливо" data={FUEL_TYPES.map((item) => ({ value: item.value, label: item.label }))} value={garageForm.fuelType} onChange={(value) => setGarageForm((current) => ({ ...current, fuelType: value || "GASOLINE" }))} />
            <Select label="Коробка передач" data={TRANSMISSIONS.map((item) => ({ value: item.value, label: item.label }))} value={garageForm.transmission} onChange={(value) => setGarageForm((current) => ({ ...current, transmission: value || "AUTOMATIC" }))} />
            <Select clearable label="Кузов" placeholder="Выберите тип" data={BODY_TYPES.map((item) => ({ value: item.value, label: item.label }))} value={garageForm.bodyType || null} onChange={(value) => setGarageForm((current) => ({ ...current, bodyType: value || "" }))} />
            <Select label="Состояние" data={CONDITIONS.map((item) => ({ value: item.value, label: item.label }))} value={garageForm.condition} onChange={(value) => setGarageForm((current) => ({ ...current, condition: value || "EXCELLENT" }))} />
            <TextInput label="Цвет" placeholder="Например, белый" value={garageForm.color} onChange={(event) => setGarageForm((current) => ({ ...current, color: event.currentTarget.value }))} maxLength={40} />
            <TextInput label="VIN" placeholder="Необязательно" value={garageForm.vin} onChange={(event) => setGarageForm((current) => ({ ...current, vin: event.currentTarget.value.toUpperCase() }))} maxLength={32} />
            <TextInput label="Город" placeholder="Например, Уфа" value={garageForm.location} onChange={(event) => setGarageForm((current) => ({ ...current, location: event.currentTarget.value }))} maxLength={120} />
          </SimpleGrid>
          <Paper withBorder radius="md" p="sm" bg="gray.0">
            <Stack gap="xs">
              <Group justify="space-between" gap="sm">
                <Stack gap={1}>
                  <Text size="sm" fw={750}>Фотографии автомобиля</Text>
                  <Text size="xs" c="dimmed">Первая фотография станет обложкой, если вы создадите объявление из гаража.</Text>
                </Stack>
                <Badge variant="light" color={garageImages.length ? "teal" : "gray"}>{garageImages.length}/12</Badge>
              </Group>
              <FileInput accept="image/jpeg,image/png,image/webp" multiple clearable disabled={isGarageImageUploading || garageImages.length >= 12} placeholder="Добавить фотографии" onChange={uploadGaragePhotos} leftSection={<IconPhoto size={16} />} />
              {isGarageImageUploading && <Text size="xs" c="teal">Загружаем фотографии…</Text>}
              {garageImages.length > 0 && (
                <SimpleGrid cols={{ base: 3, sm: 6 }} spacing="xs">
                  {garageImages.map((image, index) => (
                    <Box key={image} pos="relative" className="garage-photo-preview" data-cover={index === 0 || undefined}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={image} alt={`Фото автомобиля ${index + 1}`} />
                      <ActionIcon aria-label={`Удалить фото ${index + 1}`} type="button" size="sm" color="dark" variant="filled" pos="absolute" top={5} right={5} onClick={() => removeGarageImage(index)}><IconX size={13} /></ActionIcon>
                      {index === 0 && <Badge size="xs" color="teal" variant="filled" pos="absolute" left={5} bottom={5}>Обложка</Badge>}
                    </Box>
                  ))}
                </SimpleGrid>
              )}
            </Stack>
          </Paper>
          <Group justify="flex-end" gap="xs">
            <Button variant="subtle" color="gray" disabled={isGarageSaving || isGarageImageUploading} onClick={closeGarageModal}>Отмена</Button>
            <Button color="teal" loading={isGarageSaving} disabled={isGarageImageUploading} leftSection={<IconPlus size={16} />} onClick={handleGarageSave}>Добавить в гараж</Button>
          </Group>
        </Stack>
      </Modal>
      <Modal opened={Boolean(removalConfirmation)} onClose={() => !isRemovalSaving && !garageDeletingId && setRemovalConfirmation(null)} title={removalConfirmation?.kind === "listing" ? "Снять объявление с публикации" : "Удалить автомобиль из гаража"} centered radius="lg">
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            {removalConfirmation?.kind === "listing"
              ? `Объявление «${removalConfirmation?.title}» исчезнет из каталога, но сохранится в архиве кабинета.`
              : `Автомобиль «${removalConfirmation?.title}» будет удалён из личного гаража. Эта запись не является объявлением и не влияет на каталог.`}
          </Text>
          <Alert color={removalConfirmation?.kind === "listing" ? "orange" : "red"} variant="light">
            {removalConfirmation?.kind === "listing" ? "Его можно будет использовать как основу для новой публикации позже." : "Удаление записи из гаража нельзя отменить."}
          </Alert>
          <Group justify="flex-end">
            <Button variant="default" disabled={isRemovalSaving || Boolean(garageDeletingId)} onClick={() => setRemovalConfirmation(null)}>Отмена</Button>
            <Button color="red" loading={isRemovalSaving || Boolean(garageDeletingId)} onClick={() => void confirmRemoval()}>
              {removalConfirmation?.kind === "listing" ? "Снять с публикации" : "Удалить из гаража"}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  )
}
