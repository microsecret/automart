"use client"
export const dynamic = "force-dynamic"
import { useSearchParams } from "next/navigation"
import useSWR from "swr"
import { Container, Stack, Title, Text, Center, Button, ThemeIcon, Box, SimpleGrid, Paper, Group, Loader, Image, Badge, Divider } from "@mantine/core"
import { IconGitCompare, IconArrowLeft, IconX } from "@tabler/icons-react"
import Link from "next/link"
import { useState, useEffect, Suspense } from "react"
import BrandIcon from "@/components/brands/BrandIcon"
import { formatPrice } from "@/lib/format"
import { findLabel, BODY_TYPES, FUEL_TYPES, TRANSMISSIONS, DRIVE_TYPES, CONDITIONS } from "@/lib/constants"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const COMPARE_FIELDS = [
  { key: "price", label: "Цена", format: (v: any) => formatPrice(v) },
  { key: "year", label: "Год", format: (v: any) => String(v) },
  { key: "mileage", label: "Пробег", format: (v: any) => v ? `${v.toLocaleString("ru")} км` : "—" },
  { key: "engineVolume", label: "Объём двигателя", format: (v: any) => v ? `${v} л` : "—" },
  { key: "power", label: "Мощность", format: (v: any) => v ? `${v} л.с.` : "—" },
  { key: "fuelTypeLabel", label: "Топливо", format: (v: any) => v || "—" },
  { key: "transmissionLabel", label: "КПП", format: (v: any) => v || "—" },
  { key: "driveTypeLabel", label: "Привод", format: (v: any) => v || "—" },
  { key: "bodyTypeLabel", label: "Кузов", format: (v: any) => v || "—" },
  { key: "color", label: "Цвет", format: (v: any) => v || "—" },
  { key: "conditionLabel", label: "Состояние", format: (v: any) => v || "—" },
  { key: "steeringWheelLabel", label: "Руль", format: (v: any) => v || "—" },
  { key: "ownersCount", label: "Владельцев", format: (v: any) => v ? String(v) : "—" },
  { key: "documentsStatusLabel", label: "Документы", format: (v: any) => v || "—" },
  { key: "damageInfoLabel", label: "Повреждения", format: (v: any) => v || "—" },
  { key: "customsCleared", label: "Растаможен", format: (v: any) => v === null ? "—" : v ? "Да" : "Нет" },
  { key: "location", label: "Город", format: (v: any) => v || "—" },
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

  const { data, isLoading } = useSWR(
    ids.length > 0 ? "/api/listings?ids=" + ids.join(",") + "&limit=10" : null,
    fetcher
  )

  const vehicles: any[] = data?.listings?.map((l: any) => l.vehicle).filter(Boolean) || []

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
            <Text component="h1" fw={800} fz={24} c="dark.9" ff="var(--font-display),sans-serif">Сравнение</Text>
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
            {vehicles.map((v) => (
              <Box key={v.id} style={{ width: 200, flexShrink: 0 }}>
                <Box style={{ position: "relative", background: "var(--mantine-color-gray-1)", borderRadius: 8, overflow: "hidden", aspectRatio: "4/3", marginBottom: 8 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={v.images ? (JSON.parse(v.images)[0] || "/placeholder.svg") : "/placeholder.svg"} alt={v.make} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </Box>
                <Link href={`/listings/vehicle/${v.id}`} style={{ textDecoration: "none" }}>
                  <Group gap="sm" mb={4}>
                    <BrandIcon brand={v.make} size={32} />
                    <Stack gap={0}>
                      <Text fw={700} fz="sm" c="dark.9">{v.make} {v.model}</Text>
                      <Text fz="xs" c="gray.5">{v.year}</Text>
                    </Stack>
                  </Group>
                </Link>
              </Box>
            ))}
          </Group>

          <Divider my="sm" />

          {/* Строки характеристик */}
          {COMPARE_FIELDS.map((field, idx) => (
            <Group key={field.key} gap="md" align="flex-start" wrap="nowrap" style={{ minWidth: vehicles.length * 220 + 180, background: idx % 2 === 0 ? "transparent" : "#fafafa", padding: "6px 0", borderRadius: 4 }}>
              <Box style={{ width: 160, flexShrink: 0 }}>
                <Text size="xs" fw={600} c="gray.6" pl="xs">{field.label}</Text>
              </Box>
              {vehicles.map((v) => {
                const raw = v[field.key]
                const isBest = field.key === "price" && raw === Math.min(...vehicles.map((x) => x.price).filter(Boolean))
                return (
                  <Box key={v.id} style={{ width: 200, flexShrink: 0 }}>
                    <Text size="sm" fw={isBest ? 700 : 400} c={isBest ? "#059669" : "var(--mantine-color-gray-7)"} pl="xs">
                      {field.format(raw)}
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
