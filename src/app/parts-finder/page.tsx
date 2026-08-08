"use client"
export const dynamic = "force-dynamic"
import { useState } from "react"
import useSWR from "swr"
import Link from "next/link"
import { Box, Stack, Group, Text, Paper, Select, TextInput, Button, SimpleGrid, Center, Loader, Badge, Divider, Chip, SegmentedControl, ThemeIcon, Accordion } from "@mantine/core"
import { IconSearch, IconCar, IconGridDots, IconList, IconCheck, IconArrowRight, IconAdjustmentsHorizontal, IconBrand } from "@tabler/icons-react"
import { PART_TYPES, PART_SUBCATEGORIES } from "@/lib/constants"
import { POPULAR_BRANDS, getModels } from "@/lib/catalog"
import { formatPrice, parseImages } from "@/lib/format"

const fetcher = (url) => fetch(url).then((r) => r.json())
const CONDITIONS = [{ value: "NEW", label: "Новые" }, { value: "LIKE_NEW", label: "Как новые" }, { value: "EXCELLENT", label: "Отл." }, { value: "GOOD", label: "Хор." }]

export default function PartsFinderPage() {
  const [q, setQ] = useState("")
  const [partType, setPartType] = useState(null)
  const [make, setMake] = useState(null)
  const [model, setModel] = useState(null)
  const [condition, setCondition] = useState(null)
  const [priceFrom, setPriceFrom] = useState("")
  const [priceTo, setPriceTo] = useState("")
  const [view, setView] = useState("grid")

  const buildQuery = () => {
    const u = new URLSearchParams()
    if (q) u.set("q", q)
    if (partType) u.set("partType", partType)
    if (make) u.set("make", make)
    if (model) u.set("model", model)
    if (condition) u.set("condition", condition)
    if (priceFrom) u.set("priceFrom", priceFrom)
    if (priceTo) u.set("priceTo", priceTo)
    if (make) u.set("compatible", "true")
    return u.toString()
  }

  const { data, isLoading } = useSWR("/api/parts?" + buildQuery(), fetcher)
  const parts = data?.parts || []
  const subcats = partType ? PART_SUBCATEGORIES[partType] || [] : []

  return (
    <Box p={{ base: "sm", md: "md" }}>
      <Stack gap="md">
        <Group gap="sm" align="center">
          <ThemeIcon variant="light" color="indigo" size={44} radius="md"><IconAdjustmentsHorizontal size={22} /></ThemeIcon>
          <Stack gap={0}>
            <Text component="h1" fw={800} fz={22} c="dark.9" ff="var(--font-display),sans-serif">Каталог запчастей</Text>
            <Text size="xs" c="gray.5">Умный поиск с кросс-совместимостью</Text>
          </Stack>
        </Group>

        {/* Быстрые категории */}
        <Group gap={6} wrap="wrap">
          <Chip checked={!partType} onChange={() => setPartType(null)} variant={!partType ? "filled" : "outline"} color="indigo" size="sm" radius="md">Все</Chip>
          {PART_TYPES.slice(0, 12).map((t) => (
            <Chip key={t.value} checked={partType === t.value} onChange={() => setPartType(partType === t.value ? null : t.value)} variant={partType === t.value ? "filled" : "outline"} color="indigo" size="sm" radius="md">{t.label}</Chip>
          ))}
        </Group>

        {/* Панель поиска */}
        <Paper radius="md" p="md" withBorder>
          <Stack gap="sm">
            <Group gap="xs" wrap="wrap" align="flex-end">
              <TextInput placeholder="Поиск по названию, OEM..." leftSection={<IconSearch size={14} />} value={q} onChange={(e) => setQ(e.target.value)} size="sm" style={{ flex: 1, minWidth: 200 }} />
              <Select placeholder="Марка авто" data={POPULAR_BRANDS.slice(0, 60).map((b) => ({ value: b.name, label: b.name }))} searchable clearable value={make} onChange={(v) => { setMake(v); setModel(null) }} size="sm" w={140} />
              <Select placeholder="Модель" data={make ? getModels(make).map((m) => ({ value: m, label: m })) : []} searchable clearable disabled={!make} value={model} onChange={setModel} size="sm" w={130} />
              <Select placeholder="Состояние" data={CONDITIONS} clearable value={condition} onChange={setCondition} size="sm" w={120} />
            </Group>
            <Group gap="xs" wrap="wrap" align="flex-end">
              <TextInput placeholder="Цена от" value={priceFrom} onChange={(e) => setPriceFrom(e.target.value)} size="sm" w={100} type="number" />
              <TextInput placeholder="Цена до" value={priceTo} onChange={(e) => setPriceTo(e.target.value)} size="sm" w={100} type="number" />
              {make && <Badge variant="light" color="indigo" size="md">Совместимость: {make}{model ? " " + model : ""}</Badge>}
            </Group>
          </Stack>
        </Paper>

        {/* Результаты */}
        <Group justify="space-between" align="center">
          <Text size="xs" c="gray.5">{data?.pagination?.total || 0} запчастей найдено</Text>
          <SegmentedControl size="xs" value={view} onChange={setView} data={[{ label: <IconGridDots size={14} />, value: "grid" }, { label: <IconList size={14} />, value: "list" }]} />
        </Group>

        {isLoading ? (
          <Center py={60}><Loader size="sm" color="indigo" /></Center>
        ) : parts.length === 0 ? (
          <Paper radius="md" p="xl" withBorder>
            <Center><Stack align="center"><Text c="gray.5">Запчасти не найдены</Text><Button component={Link} href="/" variant="subtle" size="sm">На главную</Button></Stack></Center>
          </Paper>
        ) : view === "grid" ? (
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="sm">
            {parts.map((p) => {
              const images = parseImages(p.images)
              const image = images[0] || "/placeholder.svg"
              return (
                <Paper key={p.id} radius="md" withBorder style={{ overflow: "hidden", borderColor: "var(--mantine-color-border)", transition: "all 200ms", cursor: "pointer" }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--mantine-color-gray-4)" }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--mantine-color-border)" }}>
                  <Link href={`/listings/part/${p.id}`} style={{ textDecoration: "none" }}>
                    <Box style={{ position: "relative", background: "var(--mantine-color-gray-1)", aspectRatio: "4/3" }}>
                      <img src={image} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      {p.condition === "NEW" && <Badge pos="absolute" top={8} left={8} color="green" variant="filled" size="xs">Новая</Badge>}
                      {p.oemNumber && <Badge pos="absolute" bottom={8} left={8} color="dark" variant="filled" size="xs">OEM: {p.oemNumber}</Badge>}
                    </Box>
                  </Link>
                  <Box p="sm">
                    <Text fw={700} fz="sm" c="dark.9" mb={4} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</Text>
                    {p.subcategory && <Text fz="xs" c="gray.5" mb={4}>{p.subcategory}</Text>}
                    <Text fw={800} fz="md" c="dark.9" mb={6}>{formatPrice(p.price)}</Text>
                    {p.compatibility?.length > 0 && (
                      <Group gap={4} mb={4}>
                        <IconCheck size={12} color="#059669" />
                        <Text fz="xs" c="gray.5">Подходит: {p.compatibility.length} мод.</Text>
                      </Group>
                    )}
                    {p.compatibility?.length > 0 && (
                      <Group gap={4}>
                        {p.compatibility.slice(0, 2).map((c, i) => (
                          <Badge key={i} size="xs" variant="light" color="blue">{c.make} {c.model}</Badge>
                        ))}
                        {p.compatibility.length > 2 && <Badge size="xs" variant="light" color="gray">+{p.compatibility.length - 2}</Badge>}
                      </Group>
                    )}
                  </Box>
                </Paper>
              )
            })}
          </SimpleGrid>
        ) : (
          <Stack gap="xs">
            {parts.map((p) => {
              const images = parseImages(p.images)
              const image = images[0] || "/placeholder.svg"
              return (
                <Paper key={p.id} radius="md" p="sm" withBorder>
                  <Group gap="md" align="center" wrap="nowrap">
                    <Link href={`/listings/part/${p.id}`}>
                      <Box style={{ width: 90, height: 70, borderRadius: 8, overflow: "hidden", background: "var(--mantine-color-gray-1)" }}>
                        <img src={image} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      </Box>
                    </Link>
                    <Stack gap={2} style={{ flex: 1 }}>
                      <Group gap="sm" align="center">
                        <Text fw={600} fz="sm" c="dark.9">{p.name}</Text>
                        {p.oemNumber && <Badge size="xs" variant="light" color="dark">OEM: {p.oemNumber}</Badge>}
                      </Group>
                      <Text fz="xs" c="gray.5">{p.subcategory} · {p.condition === "NEW" ? "Новая" : "Б/у"}</Text>
                      {p.compatibility?.length > 0 && (
                        <Group gap={4}>
                          <Text fz="xs" c="gray.5">Подходит:</Text>
                          {p.compatibility.slice(0, 3).map((c, i) => (
                            <Badge key={i} size="xs" variant="light" color="blue">{c.make} {c.model}</Badge>
                          ))}
                          {p.compatibility.length > 3 && <Text fz="xs" c="gray.4">+{p.compatibility.length - 3}</Text>}
                        </Group>
                      )}
                    </Stack>
                    <Stack gap={0} align="flex-end">
                      <Text fw={800} fz="md" c="dark.9">{formatPrice(p.price)}</Text>
                      <Button component={Link} href={`/listings/part/${p.id}`} variant="light" size="xs" color="indigo" radius="md">Открыть</Button>
                    </Stack>
                  </Group>
                </Paper>
              )
            })}
          </Stack>
        )}
      </Stack>
    </Box>
  )
}
