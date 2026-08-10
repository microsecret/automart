"use client"
export const dynamic = "force-dynamic"
import { useEffect, useState } from "react"
import useSWR from "swr"
import { notifications } from "@mantine/notifications"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Box, Stack, Group, Text, ThemeIcon, SimpleGrid, Paper, Badge, SegmentedControl, Center, Avatar, Button, Divider, ActionIcon, TextInput, Modal, Select, NumberInput } from "@mantine/core"
import { IconLayoutDashboard, IconTag, IconHeart, IconEye, IconStar, IconCar, IconPlus, IconSettings, IconTrendingUp, IconClock, IconExternalLink, IconTrash, IconEdit, IconAlertCircle, IconCircleCheck, IconFileDescription, IconClipboardCheck, IconArrowRight, IconTruckDelivery, IconTools } from "@tabler/icons-react"
import { useSession } from "next-auth/react"
import { formatPriceShort, formatMileage, formatRelativeDate, parseImages } from "@/lib/format"
import BrandIcon from "@/components/brands/BrandIcon"
import { fetchJson } from "@/lib/api-client"
import { AsyncErrorState, ResultsGridSkeleton } from "@/components/ui/AsyncStates"
import { LISTING_STATUS, LISTING_STATUS_META } from "@/lib/listing-lifecycle"
import VehicleFallback from "@/components/listings/VehicleFallback"
import { BODY_TYPES, CAR_BRANDS, findLabel, FUEL_TYPES, TRANSMISSIONS } from "@/lib/constants"

type DashboardVehicle = {
  id: string
  make: string
  model: string
  year: number
  price: number
  mileage: number | null
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
    memberSince: string | null
  }
  workflow: {
    drafts: number
    pendingModeration: number
    active: number
    needsAttention: number
  }
  listings: DashboardListing[]
  favorites: DashboardFavorite[]
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
type GarageMutationResponse = { success?: boolean; vehicle?: GarageVehicle }

type GarageForm = {
  make: string
  model: string
  year: number | ""
  mileage: number | ""
  fuelType: string
  transmission: string
  bodyType: string
  location: string
}

const DASHBOARD_TABS = new Set(["listings", "favorites", "garage", "profile"])
const createGarageForm = (): GarageForm => ({
  make: "",
  model: "",
  year: new Date().getFullYear(),
  mileage: "",
  fuelType: "GASOLINE",
  transmission: "AUTOMATIC",
  bodyType: "",
  location: "",
})

const formatMemberSince = (value: string | null) => value
  ? new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" }).format(new Date(value))
  : "—"

export default function DashboardPage() {
  const { data: session, update: updateSession } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [tab, setTab] = useState("listings")
  const [isProfileEditorOpen, setIsProfileEditorOpen] = useState(false)
  const [profileName, setProfileName] = useState("")
  const [isProfileSaving, setIsProfileSaving] = useState(false)
  const [isGarageModalOpen, setIsGarageModalOpen] = useState(false)
  const [garageForm, setGarageForm] = useState<GarageForm>(createGarageForm)
  const [isGarageSaving, setIsGarageSaving] = useState(false)
  const [garageDeletingId, setGarageDeletingId] = useState<string | null>(null)
  const { data, error, isLoading, mutate } = useSWR<DashboardResponse>("/api/dashboard/stats", fetchJson)
  const { data: garageData, error: garageError, isLoading: isGarageLoading, mutate: mutateGarage } = useSWR<GarageResponse>(
    tab === "garage" ? "/api/garage" : null,
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
    setIsGarageModalOpen(true)
  }

  const closeGarageModal = () => {
    if (isGarageSaving) return
    setIsGarageModalOpen(false)
    setGarageForm(createGarageForm())
  }

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Снять с публикации «${title}»? Данные останутся в архиве.`)) return
    try {
      await fetchJson<ListingDeleteResponse>(`/api/listings/${id}`, { method: "DELETE" })
      notifications.show({ title: "Снято с публикации", message: "Объявление перенесено в архив", color: "green" })
      await mutate()
    } catch (error) {
      notifications.show({ title: "Ошибка", message: error instanceof Error ? error.message : "Не удалось удалить", color: "red" })
    }
  }

  useEffect(() => {
    setProfileName(session?.user?.name || "")
  }, [session?.user?.name])

  useEffect(() => {
    const requestedTab = searchParams.get("tab")
    if (requestedTab && DASHBOARD_TABS.has(requestedTab)) setTab(requestedTab)
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
        body: JSON.stringify(garageForm),
      })

      setGarageForm(createGarageForm())
      setIsGarageModalOpen(false)
      await Promise.all([mutateGarage(), mutate()])
      notifications.show({ title: "Автомобиль добавлен", message: "Теперь можно отслеживать его в личном гараже.", color: "teal" })
    } catch (error) {
      notifications.show({ title: "Не удалось добавить автомобиль", message: error instanceof Error ? error.message : "Повторите попытку", color: "red" })
    } finally {
      setIsGarageSaving(false)
    }
  }

  const handleGarageDelete = async (vehicle: GarageVehicle) => {
    if (!confirm(`Удалить ${vehicle.make} ${vehicle.model} из личного гаража?`)) return
    setGarageDeletingId(vehicle.id)
    try {
      await fetchJson<GarageMutationResponse>(`/api/garage?id=${encodeURIComponent(vehicle.id)}`, { method: "DELETE" })

      await Promise.all([mutateGarage(), mutate()])
      notifications.show({ title: "Удалено из гаража", message: "Автомобиль больше не отображается в личном кабинете.", color: "gray" })
    } catch (error) {
      notifications.show({ title: "Не удалось удалить автомобиль", message: error instanceof Error ? error.message : "Повторите попытку", color: "red" })
    } finally {
      setGarageDeletingId(null)
    }
  }

  if (isLoading) return <Box p={{ base: "sm", md: "md" }}><ResultsGridSkeleton count={6} mediaHeight={44} /></Box>
  if (error || !data) return <Box p={{ base: "sm", md: "md" }}><AsyncErrorState title="Не удалось загрузить личный кабинет" description="Статистика и объявления временно недоступны. Повторите запрос." onRetry={() => mutate()} /></Box>

  const stats = data.stats
  const workflow = data.workflow
  const greetingName = session?.user?.name?.trim().split(" ")[0]
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

        {/* Табы */}
        <SegmentedControl
          value={tab}
          onChange={selectTab}
          size="sm"
          radius="md"
          data={[
            { label: "Мои объявления", value: "listings" },
            { label: "Избранное", value: "favorites" },
            { label: "Гараж", value: "garage" },
            { label: "Профиль", value: "profile" },
          ]}
        />

        {/* Контент табов */}
        {tab === "listings" && (
          <Stack gap="xs" id="dashboard-listings">
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
                const href = isVehicle ? `/listings/vehicle/${l.vehicle.id}` : `/listings/part/${l.part.id}`
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
                        <ActionIcon variant="subtle" color="red" size="sm" aria-label={`Архивировать ${l.title}`} onClick={() => handleDelete(l.id, l.title)}><IconTrash size={16} /></ActionIcon>
                      </Group>
                    </Group>
                  </Paper>
                )
              })
            )}
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
                    <Paper key={vehicle.id} className="garage-vehicle-card" radius="md" withBorder overflow="hidden">
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
                        </Group>
                        <Group justify="space-between" align="center" mt={2}>
                          <Text size="xs" c="gray.5" truncate>{vehicle.location || "Город не указан"}</Text>
                          <ActionIcon color="red" variant="subtle" size="sm" aria-label={`Удалить ${vehicle.make} ${vehicle.model} из гаража`} loading={garageDeletingId === vehicle.id} onClick={() => handleGarageDelete(vehicle)}>
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Group>
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
                  <Text size="sm" c="dimmed">Добавьте свою машину, чтобы позже получать напоминания об обслуживании и запускать проверку истории.</Text>
                  <Button color="teal" radius="md" size="sm" leftSection={<IconPlus size={16} />} onClick={openGarageModal}>Добавить первый автомобиль</Button>
                </Stack>
              </Center>
            )}
          </Paper>
        )}

        {tab === "profile" && (
          <Paper radius="md" p="lg" withBorder>
            <Stack gap="md">
              <Group gap="md" align="center">
                <Avatar src={session?.user?.image} size={64} radius="xl" color="indigo">{session?.user?.name?.[0]?.toUpperCase()}</Avatar>
                <Stack gap={0}>
                  <Text fw={700} fz="lg" c="dark.9">{session?.user?.name || "Без имени"}</Text>
                  <Text size="sm" c="gray.5">{session?.user?.email}</Text>
                  {stats.avgRating > 0 && (
                    <Group gap={4}>
                      <IconStar size={14} color="#f59e0b" fill="#f59e0b" />
                      <Text size="xs" c="gray.5">{stats.avgRating} рейтинг</Text>
                    </Group>
                  )}
                </Stack>
              </Group>
              <Divider />
              <SimpleGrid cols={2} spacing="sm">
                <Box><Text size="xs" c="gray.4">На сайте с</Text><Text size="sm" fw={600} c="dark.9">{formatMemberSince(stats.memberSince)}</Text></Box>
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

      <Modal opened={isGarageModalOpen} onClose={closeGarageModal} title="Добавить автомобиль в гараж" centered radius="lg" size="lg">
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
            <TextInput label="Город" placeholder="Например, Уфа" value={garageForm.location} onChange={(event) => setGarageForm((current) => ({ ...current, location: event.currentTarget.value }))} maxLength={120} />
          </SimpleGrid>
          <Group justify="flex-end" gap="xs">
            <Button variant="subtle" color="gray" disabled={isGarageSaving} onClick={closeGarageModal}>Отмена</Button>
            <Button color="teal" loading={isGarageSaving} leftSection={<IconPlus size={16} />} onClick={handleGarageSave}>Добавить в гараж</Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  )
}
