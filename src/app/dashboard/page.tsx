"use client"
export const dynamic = "force-dynamic"
import { Suspense, useEffect, useState } from "react"
import useSWR from "swr"
import { notifications } from "@mantine/notifications"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Alert, Anchor, Box, Stack, Group, Text, ThemeIcon, SimpleGrid, Paper, Badge, Center, Avatar, Button, Divider, ActionIcon, TextInput, Modal } from "@mantine/core"
import { IconLayoutDashboard, IconMessageCircle2, IconTag, IconHeart, IconEye, IconStar, IconCar, IconPlus, IconSettings, IconTrendingUp, IconClock, IconExternalLink, IconTrash, IconEdit, IconAlertCircle, IconCircleCheck, IconFileDescription, IconClipboardCheck, IconArrowRight, IconTruckDelivery, IconTools, IconAt, IconPhone, IconBrandTelegram, IconShieldCheck } from "@tabler/icons-react"
import { useSession } from "next-auth/react"
import { formatPriceShort, formatMileage, formatRelativeDate, parseImages } from "@/lib/format"
import BrandIcon from "@/components/brands/BrandIcon"
import { fetchJson } from "@/lib/api-client"
import { AsyncErrorState, ResultsGridSkeleton } from "@/components/ui/AsyncStates"
import { LISTING_STATUS, LISTING_STATUS_META } from "@/lib/listing-lifecycle"
import VehicleFallback from "@/components/listings/VehicleFallback"
import ShareInviteCard from "@/components/dashboard/ShareInviteCard"
import GaragePanel, { type GarageResponse } from "@/components/dashboard/GaragePanel"
import PromotionPanel, { type PromotionOrder } from "@/components/dashboard/PromotionPanel"
import { FORUM_SIGNATURE_MAX } from "@/lib/forum"
import AvatarUpload from "@/components/dashboard/AvatarUpload"

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

type DashboardResponse = {
  stats: {
    totalListings: number
    totalViews: number
    favoritesCount: number
    reviewsCount: number
    garageCount: number
    avgRating: number
    unreadMessages: number
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
    forumSignature: string | null
  }
}
type RemovalConfirmation = { kind: "listing" | "garage"; id: string; title: string }

const DASHBOARD_TABS = new Set(["listings", "payments", "favorites", "garage", "profile"])

const formatMemberSince = (value: string | null) => value
  ? new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" }).format(new Date(value))
  : "—"

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
  const [profileSignature, setProfileSignature] = useState("")
  const [profileImage, setProfileImage] = useState<string | null>(null)
  const [isProfileSaving, setIsProfileSaving] = useState(false)
  const [garageDeletingId, setGarageDeletingId] = useState<string | null>(null)
  const [removalConfirmation, setRemovalConfirmation] = useState<RemovalConfirmation | null>(null)
  const [isRemovalSaving, setIsRemovalSaving] = useState(false)
  /* Те же условия, что у шапки и бокового меню.

     Здесь запрос шёл с настройками по умолчанию: обновлялся при каждом
     возврате на вкладку и дедуплицировался всего две секунды. Шапка и
     меню просят тот же адрес с паузой в двадцать секунд и без
     обновления по фокусу — из-за расхождения кабинет сбрасывал общий
     кэш и передёргивал самый дорогой запрос сайта (объявления,
     избранное, гараж, заказы продвижения) на каждое переключение
     вкладки браузера. */
  const { data, error, isLoading, mutate } = useSWR<DashboardResponse>(
    "/api/dashboard/stats",
    fetchJson,
    { revalidateOnFocus: false, dedupingInterval: 20_000 },
  )
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

  /* Подпись приходит из учётной записи, а не из сессии: в сессии её нет,
     и без этого поле открывалось бы пустым поверх сохранённого текста. */
  useEffect(() => {
    setProfileSignature(accountData?.user?.forumSignature || "")
    setProfileImage(accountData?.user?.image ?? null)
  }, [accountData?.user?.forumSignature, accountData?.user?.image])

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
        body: JSON.stringify({ name: profileName, forumSignature: profileSignature, image: profileImage ?? "" }),
      })

      /* Картинка идёт в сессию вместе с именем: иначе аватар в шапке
         останется прежним до перезахода. */
      await updateSession({ name: payload.user.name, image: profileImage })
      await mutateAccount()
      setIsProfileEditorOpen(false)
      notifications.show({ title: "Профиль обновлён", message: "Изменения сохранены.", color: "teal" })
    } catch (error) {
      notifications.show({ title: "Не удалось сохранить", message: error instanceof Error ? error.message : "Повторите попытку", color: "red" })
    } finally {
      setIsProfileSaving(false)
    }
  }

  const deleteGarageVehicle = async (id: string) => {
    setGarageDeletingId(id)
    try {
      await fetchJson(`/api/garage?id=${encodeURIComponent(id)}`, { method: "DELETE" })

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
              <Text component="h1" c="var(--market-ink)" ff="var(--font-display),sans-serif">Личный кабинет</Text>
              <Text size="xs" c="gray.5">{session?.user?.name || session?.user?.email}</Text>
            </Stack>
          </Group>
          <Button component={Link} href="/listings/create/vehicle" leftSection={<IconPlus size={16} />} color="indigo" radius="md" size="sm">Разместить</Button>
        </Group>

        {/* Момент сразу после регистрации — лучший, чтобы человек позвал
            знакомых: он как раз занят покупкой и разговаривает об этом. */}
        <ShareInviteCard />

        <Paper className="dashboard-workspace" radius="md" p={{ base: "md", md: "lg" }} withBorder>
          <Group justify="space-between" align="flex-start" gap="lg" wrap="wrap">
            <Stack gap={5} maw={560}>
              <Badge className="dashboard-workspace__eyebrow" variant="light" color={hasAttentionItems ? "orange" : "indigo"} radius="xl">
                {hasAttentionItems ? "Требуется внимание" : "Рабочее пространство"}
              </Badge>
              {/* Кегль уменьшен, приветствие в одну строку: прежние 28px в две
                  строки плюс абзац описания занимали треть первого экрана,
                  а карточки со статусами уходили под сгиб. */}
              <Text fw={800} fz={{ base: 19, md: 22 }} lh={1.15} ff="var(--font-display),sans-serif">
                {hasAttentionItems ? "Есть объявления, которым нужно ваше действие" : `Здравствуйте${greetingName ? `, ${greetingName}` : ""}`}
              </Text>
              <Text size="sm" c="dimmed" maw={520}>
                {hasAttentionItems
                  ? "Откройте список объявлений: там есть карточки с причиной и следующим шагом."
                  : "Публикации, отклики и инструменты — в одном месте."}
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
                  <Text size="xs" c="dimmed" fw={600}>{item.label}</Text>
                  <Text size="lg" c="var(--market-ink)" fw={800} lh={1}>{item.value}</Text>
                </Stack>
              </Button>
            ))}
          </SimpleGrid>
        </Paper>

        {/* Карточки статистики */}
        <SimpleGrid cols={{ base: 2, sm: 3, lg: 6 }} spacing="sm">
          {[
            { label: "Объявления", value: stats.totalListings, icon: <IconTag size={18} />, color: "var(--market-primary)", bg: "var(--market-primary-soft)" },
            { label: "Просмотры", value: stats.totalViews, icon: <IconEye size={18} />, color: "#0891b2", bg: "#ecfeff" },
            { label: "Избранное", value: stats.favoritesCount, icon: <IconHeart size={18} />, color: "#e11d48", bg: "#fff1f2" },
            { label: "Отзывы", value: stats.reviewsCount, icon: <IconStar size={18} />, color: "#ea580c", bg: "#fff7ed" },
            { label: "Сообщения", value: stats.unreadMessages > 0 ? `+${stats.unreadMessages}` : 0, icon: <IconMessageCircle2 size={18} />, color: "#059669", bg: "#ecfdf5" },
            { label: "Рейтинг", value: stats.avgRating || "—", icon: <IconTrendingUp size={18} />, color: "var(--market-primary)", bg: "#f5f3ff" },
          ].map((s) => (
            <Paper key={s.label} radius="md" p="sm" withBorder style={{ borderColor: "var(--mantine-color-border)" }}>
              <Group gap="sm" align="center">
                <Box style={{ width: 36, height: 36, borderRadius: 8, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", color: s.color }}>
                  {s.icon}
                </Box>
                <Stack gap={0}>
                  <Text size="xl" fw={800} c="var(--market-ink)" lh={1}>{s.value}</Text>
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
                  {/* Пустой экран — это точка, где продавец решает, продолжать
                      ли. Машина в гараже уже содержит характеристики, поэтому
                      подача из неё короче, чем заполнение формы с нуля. */}
                  <Stack align="center" gap="sm" maw={420} ta="center">
                    <ThemeIcon variant="light" color="indigo" size={48} radius="md"><IconTag size={24} /></ThemeIcon>
                    <Text fw={700}>У вас пока нет объявлений</Text>
                    <Text size="sm" c="dimmed">
                      {stats.garageCount > 0
                        ? "В гараже уже есть автомобиль — характеристики подставятся автоматически, останется добавить цену и фотографии."
                        : "Объявление проходит проверку модератором, после чего появляется в каталоге. Обычно это занимает несколько часов."}
                    </Text>
                    <Group gap="xs" justify="center">
                      <Button component={Link} href="/listings/create/vehicle" size="sm" color="indigo" leftSection={<IconPlus size={16} />}>
                        {stats.garageCount > 0 ? "Разместить объявление" : "Создать первое"}
                      </Button>
                      {stats.garageCount > 0 && (
                        <Button component={Link} href="/dashboard?tab=garage" size="sm" variant="light" color="teal" leftSection={<IconCar size={16} />}>
                          Мой гараж
                        </Button>
                      )}
                    </Group>
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
                            <Text fw={600} fz="sm" c="var(--market-ink)" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.title}</Text>
                          </Link>
                          <Badge size="xs" color={statusMeta.color} variant="light">{statusMeta.label}</Badge>
                          {l.isFeatured && <Badge size="xs" color="violet" variant="light">Премиум</Badge>}
                        </Group>
                        <Text fz="xs" c="gray.5">{isVehicle && l.vehicle ? `${formatMileage(l.vehicle.mileage)} · ${l.vehicle.location || "—"}` : l.part?.name}</Text>
                        {l.statusReason && l.status === LISTING_STATUS.REJECTED && (
                          <Alert
                            color="red"
                            variant="light"
                            radius="sm"
                            p="xs"
                            mt={4}
                            icon={<IconAlertCircle size={14} />}
                            title="Не прошло проверку"
                          >
                            <Text fz="xs" lh={1.45}>{l.statusReason}</Text>
                            <Anchor component={Link} href={`/listings/${l.id}/edit`} fz="xs" fw={600} mt={4} display="inline-block">
                              Исправить и отправить снова
                            </Anchor>
                          </Alert>
                        )}
                        {l.statusReason && l.status !== LISTING_STATUS.ACTIVE && l.status !== LISTING_STATUS.REJECTED && <Text fz="xs" c="red.6" lineClamp={2}>{l.statusReason}</Text>}
                        <Group gap="md">
                          <Text fw={800} fz="md" c="var(--market-ink)" ff="var(--font-display),sans-serif">{formatPriceShort(l.price)}</Text>
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
                      <Group gap={6} wrap="wrap">
                        {/* Продвижение — заметной кнопкой со словом, а не
                            безымянной иконкой: платная услуга была
                            практически невидима. Показывается только у
                            активного объявления — для черновика сервер
                            отвечает отказом, и продавец добирался до
                            выбора тарифа лишь затем, чтобы увидеть ошибку. */}
                        {l.status === LISTING_STATUS.ACTIVE && (
                          <Button
                            component={Link}
                            href={`/listings/${l.id}/promote`}
                            size="compact-sm"
                            radius="md"
                            variant="light"
                            color="violet"
                            leftSection={<IconTrendingUp size={14} />}
                          >
                            Продвинуть
                          </Button>
                        )}
                        <ActionIcon component={Link} href={href} variant="subtle" color="gray" size="md" aria-label={`Открыть ${l.title}`}><IconExternalLink size={16} /></ActionIcon>
                        <ActionIcon component={Link} href={`/listings/${l.id}/edit`} variant="subtle" color="indigo" size="md" aria-label={`Редактировать ${l.title}`}><IconEdit size={16} /></ActionIcon>
                        <ActionIcon variant="subtle" color="red" size="md" aria-label={`Архивировать ${l.title}`} onClick={() => setRemovalConfirmation({ kind: "listing", id: l.id, title: l.title })}><IconTrash size={16} /></ActionIcon>
                      </Group>
                    </Group>
                  </Paper>
                )
              })
            )}
          </Stack>
        )}

        {tab === "payments" && (
          <PromotionPanel
            spentRub={stats.promotionSpentRub}
            activePromotions={stats.activePromotions}
            paidCount={stats.promotionPaidCount}
            orders={data.promotionOrders}
            onViewListings={() => selectTab("listings")}
          />
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
                        <Text fw={800} fz="md" c="var(--market-ink)">{formatPriceShort(fav.price)}</Text>
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
          <GaragePanel
            data={garageData}
            error={garageError}
            isLoading={isGarageLoading}
            deletingId={garageDeletingId}
            onRetry={() => { void mutateGarage() }}
            onRequestDelete={(vehicle) => setRemovalConfirmation({ kind: "garage", id: vehicle.id, title: `${vehicle.make} ${vehicle.model}` })}
          />
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
                    <Text fw={700} fz="lg" c="var(--market-ink)">{accountProfile?.name || session?.user?.name || "Без имени"}</Text>
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
                        <Text size="sm" fw={600} truncate>{accountProfile.email || "Не указана"}</Text>
                        <Text size="xs" c={accountProfile.emailVerified ? "teal.7" : "yellow.8"}>{accountProfile.emailVerified ? "Подтверждена" : "Требует подтверждения"}</Text>
                      </Box>
                    </Group>
                  </Paper>
                  <Paper radius="md" p="sm" bg="gray.0">
                    <Group gap="xs" wrap="nowrap" align="flex-start">
                      <ThemeIcon variant="light" color="teal" radius="md" size={34}><IconPhone size={17} /></ThemeIcon>
                      <Box style={{ minWidth: 0 }}>
                        <Text size="xs" c="dimmed">Телефон</Text>
                        <Text size="sm" fw={600} truncate>{accountProfile.phone || "Не указан"}</Text>
                        <Text size="xs" c={accountProfile.telegramVerifiedAt ? "teal.7" : "yellow.8"}>{accountProfile.telegramVerifiedAt ? "Подтверждён через Telegram" : "Не подтверждён"}</Text>
                      </Box>
                    </Group>
                  </Paper>
                  <Paper radius="md" p="sm" bg="gray.0">
                    <Group gap="xs" wrap="nowrap" align="flex-start">
                      <ThemeIcon variant="light" color="blue" radius="md" size={34}><IconBrandTelegram size={17} /></ThemeIcon>
                      <Box style={{ minWidth: 0 }}>
                        <Text size="xs" c="dimmed">Telegram</Text>
                        <Text size="sm" fw={600} truncate>{accountProfile.telegramUsername ? `@${accountProfile.telegramUsername}` : "Профиль без username"}</Text>
                        <Text size="xs" c={accountProfile.telegramVerifiedAt ? "teal.7" : "yellow.8"}>{accountProfile.telegramVerifiedAt ? "Личность подтверждена" : "Не привязан"}</Text>
                      </Box>
                    </Group>
                  </Paper>
                </SimpleGrid>
              )}
              <Divider />
              <SimpleGrid cols={2} spacing="sm">
                <Box><Text size="xs" c="gray.4">На сайте с</Text><Text size="sm" fw={600} c="var(--market-ink)">{formatMemberSince(accountProfile?.createdAt || stats.memberSince)}</Text></Box>
                <Box><Text size="xs" c="gray.4">Всего объявлений</Text><Text size="sm" fw={600} c="var(--market-ink)">{stats.totalListings}</Text></Box>
                <Box><Text size="xs" c="gray.4">Просмотров всего</Text><Text size="sm" fw={600} c="var(--market-ink)">{stats.totalViews}</Text></Box>
                <Box><Text size="xs" c="gray.4">Отзывов</Text><Text size="sm" fw={600} c="var(--market-ink)">{stats.reviewsCount}</Text></Box>
              </SimpleGrid>
              {!isProfileEditorOpen ? (
                <Button variant="light" color="indigo" size="sm" leftSection={<IconSettings size={16} />} radius="md" onClick={() => setIsProfileEditorOpen(true)}>Редактировать профиль</Button>
              ) : (
                <Stack gap="xs">
                  {/* Фото профиля первым: человек узнаёт себя по картинке
                      раньше, чем по имени. */}
                  <AvatarUpload
                    currentImage={profileImage}
                    name={profileName}
                    onChange={setProfileImage}
                    disabled={isProfileSaving}
                  />
                  <TextInput label="Отображаемое имя" value={profileName} onChange={(event) => setProfileName(event.currentTarget.value)} maxLength={60} />
                  {/* Подпись видна под каждым сообщением на форуме:
                      ответ «у меня так же было» значит разное от
                      владельца той же машины и от постороннего. */}
                  <TextInput
                    label="Подпись на форуме"
                    placeholder="Например: Haval Jolion 2023, Москва"
                    description="Видна под вашими сообщениями. Без ссылок."
                    value={profileSignature}
                    onChange={(event) => setProfileSignature(event.currentTarget.value)}
                    maxLength={FORUM_SIGNATURE_MAX}
                  />
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
