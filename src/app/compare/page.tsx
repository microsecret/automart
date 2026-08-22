"use client"
export const dynamic = "force-dynamic"
import { useSearchParams } from "next/navigation"
import useSWR from "swr"
import { Container, Stack, Title, Text, Center, Button, ThemeIcon, Box, Paper, Group, Loader, Badge, Divider } from "@mantine/core"
import { IconGitCompare, IconArrowLeft, IconX } from "@tabler/icons-react"
import Link from "next/link"
import { useState, useEffect, Suspense } from "react"
import BrandIcon from "@/components/brands/BrandIcon"
import { formatPrice } from "@/lib/format"
import VehicleFallback from "@/components/listings/VehicleFallback"
import { parseMarketplaceImages } from "@/lib/media-url"
import { fetchJson } from "@/lib/api-client"
import { AsyncErrorState } from "@/components/ui/AsyncStates"
import {
  BODY_TYPES,
  CONDITIONS,
  DAMAGE_INFO,
  DOCUMENT_STATUSES,
  DRIVE_TYPES,
  getFuelOptions,
  getTransmissionOptions,
  getUsageMeta,
  STEERING_WHEELS,
  supportsTransmission,
} from "@/lib/constants"

const fetcher = fetchJson

type CompareVehicle = {
  id: string
  make: string
  model: string
  year: number
  vehicleType: string
  images: string | null
  mileage: number | null
  operatingHours: number | null
  flightHours: number | null
  engineVolume: number | null
  power: number | null
  fuelType: string | null
  transmission: string | null
  driveType: string | null
  bodyType: string | null
  color: string | null
  condition: string | null
  steeringWheel: string | null
  ownersCount: number | null
  documentsStatus: string | null
  damageInfo: string | null
  customsCleared: boolean | null
  location: string | null
}

type CompareListing = {
  id: string
  price: number
  vehicle: CompareVehicle | null
}

type ComparedVehicle = CompareVehicle & { listingPrice: number }
type CompareResponse = { listings: CompareListing[] }

type LabelOption = { value: string; label: string }
type CompareField = {
  key: string
  label: string
  value: (vehicle: ComparedVehicle) => unknown
  format: (value: unknown, vehicle: ComparedVehicle) => string
  visible?: (vehicles: ComparedVehicle[]) => boolean
}

const getLabel = (options: readonly LabelOption[], value: string | null) => {
  if (!value) return "—"
  return options.find((option) => option.value === value)?.label || value
}

const formatNumber = (value: unknown, unit: string) =>
  typeof value === "number" && Number.isFinite(value) ? `${value.toLocaleString("ru-RU")} ${unit}` : "—"

const getCompareFields = (): CompareField[] => [
  { key: "listingPrice", label: "Цена", value: (vehicle) => vehicle.listingPrice, format: (value) => typeof value === "number" ? formatPrice(value) : "—" },
  { key: "year", label: "Год", value: (vehicle) => vehicle.year, format: (value) => typeof value === "number" ? String(value) : "—" },
  {
    key: "usage",
    label: "Эксплуатация",
    value: (vehicle) => vehicle,
    format: (_value, vehicle) => {
      const usage = getUsageMeta(vehicle.vehicleType)
      const amount = vehicle[usage.field]
      return formatNumber(amount, usage.unit)
    },
  },
  { key: "engineVolume", label: "Объём двигателя", value: (vehicle) => vehicle.engineVolume, format: (value) => formatNumber(value, "л") },
  { key: "power", label: "Мощность", value: (vehicle) => vehicle.power, format: (value) => formatNumber(value, "л.с.") },
  { key: "fuelType", label: "Топливо", value: (vehicle) => vehicle.fuelType, format: (value, vehicle) => getLabel(getFuelOptions(vehicle.vehicleType), typeof value === "string" ? value : null) },
  {
    key: "transmission",
    label: "КПП",
    value: (vehicle) => vehicle.transmission,
    format: (value, vehicle) => getLabel(getTransmissionOptions(vehicle.vehicleType), typeof value === "string" ? value : null),
    visible: (vehicles) => vehicles.some((vehicle) => supportsTransmission(vehicle.vehicleType)),
  },
  {
    key: "driveType",
    label: "Привод",
    value: (vehicle) => vehicle.driveType,
    format: (value) => getLabel(DRIVE_TYPES, typeof value === "string" ? value : null),
    visible: (vehicles) => vehicles.some((vehicle) => vehicle.vehicleType === "CAR" && vehicle.driveType),
  },
  { key: "bodyType", label: "Кузов / тип", value: (vehicle) => vehicle.bodyType, format: (value) => getLabel(BODY_TYPES, typeof value === "string" ? value : null) },
  { key: "color", label: "Цвет", value: (vehicle) => vehicle.color, format: (value) => typeof value === "string" && value ? value : "—" },
  { key: "condition", label: "Состояние", value: (vehicle) => vehicle.condition, format: (value) => getLabel(CONDITIONS, typeof value === "string" ? value : null) },
  {
    key: "steeringWheel",
    label: "Руль",
    value: (vehicle) => vehicle.steeringWheel,
    format: (value) => getLabel(STEERING_WHEELS, typeof value === "string" ? value : null),
    visible: (vehicles) => vehicles.some((vehicle) => vehicle.steeringWheel),
  },
  {
    key: "ownersCount",
    label: "Владельцев",
    value: (vehicle) => vehicle.ownersCount,
    format: (value) => typeof value === "number" ? String(value) : "—",
    visible: (vehicles) => vehicles.some((vehicle) => vehicle.ownersCount !== null),
  },
  {
    key: "documentsStatus",
    label: "Документы",
    value: (vehicle) => vehicle.documentsStatus,
    format: (value) => getLabel(DOCUMENT_STATUSES, typeof value === "string" ? value : null),
    visible: (vehicles) => vehicles.some((vehicle) => vehicle.documentsStatus),
  },
  {
    key: "damageInfo",
    label: "Повреждения",
    value: (vehicle) => vehicle.damageInfo,
    format: (value) => getLabel(DAMAGE_INFO, typeof value === "string" ? value : null),
    visible: (vehicles) => vehicles.some((vehicle) => vehicle.damageInfo),
  },
  {
    key: "customsCleared",
    label: "Растаможен",
    value: (vehicle) => vehicle.customsCleared,
    format: (value) => value === null ? "—" : value ? "Да" : "Нет",
    visible: (vehicles) => vehicles.some((vehicle) => vehicle.customsCleared !== null),
  },
  { key: "location", label: "Город", value: (vehicle) => vehicle.location, format: (value) => typeof value === "string" && value ? value : "—" },
]

function CompareContent() {
  const sp = useSearchParams()
  const [localIds, setLocalIds] = useState<string[]>([])

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("compare-ids") : null
    if (saved) setLocalIds(saved.split(",").filter(Boolean))
  }, [])

  const urlIds = sp.get("ids")?.split(",").filter(Boolean) || []
  const ids = [...new Set([...urlIds, ...localIds])].slice(0, 4)

  const { data, error, isLoading, mutate } = useSWR<CompareResponse>(
    ids.length > 0 ? "/api/listings?ids=" + ids.join(",") + "&limit=10" : null,
    fetcher
  )

  const vehicles: ComparedVehicle[] = (data?.listings || []).flatMap((listing) =>
    listing.vehicle ? [{ ...listing.vehicle, listingPrice: listing.price }] : []
  )
  const compareFields = getCompareFields().filter((field) => !field.visible || field.visible(vehicles))
  const listedPrices = vehicles.map((vehicle) => vehicle.listingPrice).filter((price) => Number.isFinite(price))
  const bestPrice = listedPrices.length > 0 ? Math.min(...listedPrices) : null

    const clearCompare = () => {
    localStorage.removeItem("compare-ids")
    setLocalIds([])
  }

  if (ids.length === 0) {
    return (
      <Container size="md" py="xl">
        <Stack gap="md" align="center">
          <ThemeIcon variant="light" color="indigo" size={56} radius="md">
            <IconGitCompare size={28} />
          </ThemeIcon>
          <Title order={2} ff="var(--font-display),sans-serif" ta="center">Сравнение объявлений</Title>
          <Text size="sm" c="gray.5" ta="center" maw={420}>
            Чтобы сравнить автомобили, добавьте их в сравнение.
            Откройте страницу объявления и нажмите «Сравнить», или добавьте через URL:
          </Text>
          <Badge variant="light" color="gray" size="md">/compare?ids=ID1,ID2,ID3</Badge>
          <Button component={Link} href="/" variant="light" color="indigo" size="md" radius="md" leftSection={<IconArrowLeft size={16} />}>
            К объявлениям
          </Button>
        </Stack>
      </Container>
    )
  }

  if (isLoading) {
    return <Container size="xl" py="xl"><Center><Loader size="sm" color="indigo" /></Center></Container>
  }

  if (error) {
    return <Container size="md" py="xl"><AsyncErrorState title="Не удалось загрузить сравнение" description="Карточки временно недоступны. Повторите запрос." onRetry={() => void mutate()} backHref="/" /></Container>
  }

  if (vehicles.length === 0) {
    return (
      <Container size="md" py="xl">
        <Center>
          <Stack align="center" gap="md">
            <Text c="gray.5" fz="lg">Объявления не найдены</Text>
            <Button component={Link} href="/" variant="subtle" color="indigo">На главную</Button>
          </Stack>
        </Center>
      </Container>
    )
  }

  return (
    <Container size="xl" py="lg">
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <Stack gap={0}>
            <Text component="h1" fw={800} fz={24} c="var(--market-ink)" ff="var(--font-display),sans-serif">Сравнение</Text>
            <Text size="xs" c="gray.5">{vehicles.length} автомобиля</Text>
          </Stack>
          <Group gap="xs">
            <Button component={Link} href="/" variant="subtle" color="gray" size="sm" leftSection={<IconArrowLeft size={14} />}>Назад</Button>
            <Button variant="subtle" color="red" size="sm" leftSection={<IconX size={14} />} onClick={clearCompare}>Очистить</Button>
          </Group>
        </Group>

        <Paper radius="md" withBorder p="md" style={{ overflowX: "auto" }}>
          {/* Шапка таблицы — автомобили */}
          <Group gap="md" align="flex-start" wrap="nowrap" style={{ minWidth: vehicles.length * 220 + 180 }}>
            {/* Колонка с названиями полей */}
            <Box style={{ width: 160, flexShrink: 0 }}>
              <Text size="xs" fw={700} c="gray.4" tt="uppercase" mt={60}>Характеристика</Text>
            </Box>
            {/* Колонки автомобилей */}
            {vehicles.map((v) => {
              const image = parseMarketplaceImages(v.images)?.[0]
              return (
                <Box key={v.id} style={{ width: 200, flexShrink: 0 }}>
                <Box style={{ position: "relative", background: "var(--mantine-color-gray-1)", borderRadius: 8, overflow: "hidden", aspectRatio: "4/3", marginBottom: 8 }}>
                  <VehicleFallback type={v.vehicleType} compact />
                  {image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={image} alt={`${v.make} ${v.model}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  )}
                </Box>
                <Link href={`/listings/vehicle/${v.id}`} style={{ textDecoration: "none" }}>
                  <Group gap="sm" mb={4}>
                    <BrandIcon brand={v.make} size={32} />
                    <Stack gap={0}>
                      <Text fw={700} fz="sm" c="var(--market-ink)">{v.make} {v.model}</Text>
                      <Text fz="xs" c="gray.5">{v.year}</Text>
                    </Stack>
                  </Group>
                </Link>
                </Box>
              )
            })}
          </Group>

          <Divider my="sm" />

          {/* Строки характеристик. Чередование задано токеном поверхности: раньше
              чётные строки заливались светлым #fafafa, и в тёмной теме сравнение
              превращалось в белые полосы под серым текстом. */}
          {compareFields.map((field, idx) => (
            <Group key={field.key} gap="md" align="flex-start" wrap="nowrap" style={{ minWidth: vehicles.length * 220 + 180, background: idx % 2 === 0 ? "transparent" : "var(--market-surface-subtle)", padding: "6px 0", borderRadius: 4 }}>
              <Box style={{ width: 160, flexShrink: 0 }}>
                <Text size="xs" fw={600} c="gray.6" pl="xs">{field.label}</Text>
              </Box>
              {vehicles.map((v) => {
                const raw = field.value(v)
                const isBest = field.key === "listingPrice" && raw === bestPrice
                return (
                  <Box key={v.id} style={{ width: 200, flexShrink: 0 }}>
                    <Text size="sm" fw={isBest ? 700 : 400} c={isBest ? "#059669" : "var(--mantine-color-gray-7)"} pl="xs">
                      {field.format(raw, v)}
                    </Text>
                  </Box>
                )
              })}
            </Group>
          ))}
        </Paper>
      </Stack>
    </Container>
  )
}

export default function ComparePage() {
  return (
    <Suspense fallback={<Container py="xl"><Center><Loader size="sm" color="indigo" /></Center></Container>}>
      <CompareContent />
    </Suspense>
  )
}
