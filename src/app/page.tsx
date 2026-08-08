"use client"

export const dynamic = "force-dynamic"

import { useState, useCallback, useEffect } from "react"
import useSWR from "swr"
import {
  Box, Text, Select, Group, Pagination, Center, Loader, Stack,
  SegmentedControl, Paper, TextInput, Button, SimpleGrid, Collapse, Badge, Chip,
} from "@mantine/core"
import { IconLayoutGrid, IconList, IconSearch, IconAdjustmentsHorizontal, IconX } from "@tabler/icons-react"
import Link from "next/link"
import ListingCard from "@/components/listings/ListingCard"
import ListingRow from "@/components/listings/ListingRow"
import { getModels, POPULAR_BRANDS, getBrandsByCategory } from "@/lib/catalog"
import { PART_TYPES, PART_SUBCATEGORIES } from "@/lib/constants"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function HomePage({
  initialQuery, initialType = "vehicle", pageTitle, categorySlug,
}: {
  initialQuery?: string; initialType?: "vehicle" | "part"; pageTitle?: string; categorySlug?: string
}) {
  const [type, setType] = useState<"vehicle" | "part">(initialType)
  const [view, setView] = useState<"grid" | "list">("grid")
  const [make, setMake] = useState<string | null>(null)
  const [model, setModel] = useState<string | null>(null)
  const [priceFrom, setPriceFrom] = useState(""); const [priceTo, setPriceTo] = useState("")
  const [yearFrom, setYearFrom] = useState(""); const [yearTo, setYearTo] = useState("")
  const [city, setCity] = useState(""); const [sort, setSort] = useState("newest")
  const [partType, setPartType] = useState<string | null>(null)
  const [page, setPage] = useState(1); const [showAdvanced, setShowAdvanced] = useState(false)
  const [query, setQuery] = useState(initialQuery || "")

  const brandsForCategory = categorySlug && categorySlug !== "parts" && categorySlug !== "services"
    ? getBrandsByCategory(categorySlug as any) : null
  const brandOptions = Array.from(
    new Map((brandsForCategory || POPULAR_BRANDS).map((b) => [b.name, { value: b.name, label: b.name }])).values()
  ).slice(0, 80)

  const buildQuery = useCallback(() => {
    const p = new URLSearchParams()
    p.set("type", type); p.set("page", String(page)); p.set("limit", "18"); p.set("sort", sort)
    if (query.trim()) p.set("q", query.trim())
    if (make) p.set("make", make); if (model) p.set("model", model)
    if (city.trim()) p.set("city", city.trim())
    if (priceFrom) p.set("priceFrom", priceFrom); if (priceTo) p.set("priceTo", priceTo)
    if (yearFrom) p.set("yearFrom", yearFrom); if (yearTo) p.set("yearTo", yearTo)
    if (partType) p.set("partType", partType)
    // Маппинг category slug → vehicleType
    if (categorySlug && categorySlug !== "parts" && categorySlug !== "services") {
      const vMap: Record<string,string> = { cars: "CAR", moto: "MOTORCYCLE", trucks: "TRUCK", special: "SPECIAL", water: "WATER", air: "AIR" }
      const vt = vMap[categorySlug]
      if (vt) p.set("vehicleType", vt)
    }
    return p.toString()
  }, [type, page, sort, query, make, model, city, priceFrom, priceTo, yearFrom, yearTo, categorySlug])

  const { data, isLoading, error } = useSWR<{ listings: any[]; pagination: any }>(`/api/listings?${buildQuery()}`, fetcher)
  useEffect(() => { setPage(1) }, [make, model, type, sort, query, city, priceFrom, priceTo, yearFrom, yearTo])

  const resetFilters = () => { setMake(null); setModel(null); setPriceFrom(""); setPriceTo(""); setYearFrom(""); setYearTo(""); setCity(""); setQuery("") }
  const activeFiltersCount = [make, city, priceFrom, priceTo, yearFrom, yearTo].filter(Boolean).length

  return (
    <Box p={{ base: "sm", md: "md" }}>
      <Stack gap="md">
        {/* Цветной hero-баннер с поиском */}
        {!categorySlug && (
          <Paper radius="lg" p={{ base: "md", md: "lg" }} style={{
            background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #6366f1 100%)",
            overflow: "hidden",
            position: "relative",
          }}>
            <Box style={{ position: "relative", zIndex: 1 }}>
              <Text ff="var(--font-display),sans-serif" fw={800} fz={{ base: 22, md: 28 }} c="white" lh={1.2} style={{ letterSpacing: "-0.02em" }} mb={4}>
                Найдите свой автомобиль
              </Text>
              <Text size="sm" c="rgba(255,255,255,0.85)" mb="md">
                334+ проверенных объявлений · 6 видов транспорта · безопасная сделка
              </Text>
              <Group gap="xs" wrap="wrap">
                {[
                  { label: "Легковые", href: "/category/cars", icon: "🚗" },
                  { label: "Мото", href: "/category/moto", icon: "🏍" },
                  { label: "Грузовики", href: "/category/trucks", icon: "🚚" },
                  { label: "Спецтехника", href: "/category/special", icon: "🚜" },
                  { label: "Вода", href: "/category/water", icon: "🚤" },
                  { label: "Авиа", href: "/category/air", icon: "✈️" },
                ].map((cat) => (
                  <Link key={cat.href} href={cat.href} style={{ textDecoration: "none" }}>
                    <Badge size="md" radius="md" style={{ cursor: "pointer", fontWeight: 600, background: "rgba(255,255,255,0.9)", color: "#4f46e5" }}>
                      {cat.icon} {cat.label}
                    </Badge>
                  </Link>
                ))}
              </Group>
            </Box>
          </Paper>
        )}

        {/* Заголовок + вид */}
        <Group justify="space-between" align="center" wrap="nowrap">
          <Stack gap={0}>
            <Text component="h1" ff="var(--font-display),sans-serif" fw={800} fz={{ base: 20, md: 24 }} lh={1.2} c="#18181b" style={{ letterSpacing: "-0.02em" }}>
              {pageTitle || "Все объявления"}
            </Text>
            {!isLoading && data && (
              <Text size="xs" c="#71717a" mt={2}>{data.pagination.total} {pluralListings(data.pagination.total)}</Text>
            )}
          </Stack>
          <SegmentedControl size="xs" radius="md" value={view} onChange={(v) => setView(v as any)}
            data={[{ label: <IconLayoutGrid size={14} />, value: "grid" }, { label: <IconList size={14} />, value: "list" }]} />
        </Group>

        {/* Категории запчастей — чипы (если раздел запчастей) */}
        {categorySlug === "parts" || type === "part" ? (
          <Group gap={6} wrap="wrap">
            <Chip size="sm" checked={!partType} onChange={() => setPartType(null)} variant="light" color="indigo" radius="md">Все</Chip>
            {PART_TYPES.map((pt) => (
              <Chip key={pt.value} size="sm" checked={partType === pt.value} onChange={() => setPartType(partType === pt.value ? null : pt.value)} variant="light" color="indigo" radius="md">
                {pt.label}
              </Chip>
            ))}
          </Group>
        ) : null}

        {/* Подкатегории запчастей (если выбран тип) */}
        {partType && PART_SUBCATEGORIES[partType] && (
          <Group gap={4} wrap="wrap">
            {PART_SUBCATEGORIES[partType].slice(0, 12).map((sub) => (
              <Link key={sub} href={`/search?q=${encodeURIComponent(sub)}&type=part`} style={{ textDecoration: "none" }}>
                <Badge variant="outline" size="sm" radius="md" color="gray" style={{ cursor: "pointer", fontWeight: 500 }}>
                  {sub}
                </Badge>
              </Link>
            ))}
          </Group>
        )}

        {/* Фильтры — БЫСТРЫЕ, все видны в ряд (как у Auto.ru) */}
        <Paper radius="md" p="sm" withBorder style={{ borderColor: "#f4f4f5", background: "#fff" }}>
          <Stack gap="sm">
            {/* Строка 1: Поиск + Марка + Модель + Сортировка */}
            <Group gap="xs" wrap="wrap" align="flex-end">
              <Box style={{ flex: 1, minWidth: 160 }}>
                <Text size="10px" fw={600} c="#71717a" mb={3} style={{ letterSpacing: "0.04em", textTransform: "uppercase" }}>Поиск</Text>
                <TextInput
                  placeholder="Марка, модель, VIN..."
                  leftSection={<IconSearch size={14} color="#a1a1aa" />}
                  value={query} onChange={(e) => setQuery(e.currentTarget.value)}
                  radius="md" size="xs" variant="filled"
                  styles={{ input: { background: "#f4f4f5", border: "1px solid transparent" } }}
                  rightSection={query ? <IconX size={12} color="#a1a1aa" style={{ cursor: "pointer" }} onClick={() => setQuery("")} /> : null}
                />
              </Box>
              <Box w={140}>
                <Text size="10px" fw={600} c="#71717a" mb={3} style={{ letterSpacing: "0.04em", textTransform: "uppercase" }}>Марка</Text>
                <Select data={brandOptions} searchable clearable value={make}
                  onChange={(v) => { setMake(v); setModel(null) }} size="xs" radius="md" placeholder="Любая" />
              </Box>
              {make && getModels(make).length > 0 && (
                <Box w={130}>
                  <Text size="10px" fw={600} c="#71717a" mb={3} style={{ letterSpacing: "0.04em", textTransform: "uppercase" }}>Модель</Text>
                  <Select data={getModels(make).map(m => ({ value: m, label: m }))}
                    searchable clearable value={model} onChange={setModel} size="xs" radius="md" placeholder="Любая" />
                </Box>
              )}
              <Box w={130}>
                <Text size="10px" fw={600} c="#71717a" mb={3} style={{ letterSpacing: "0.04em", textTransform: "uppercase" }}>Сортировка</Text>
                <Select
                  data={[{ value: "newest", label: "Сначала новые" }, { value: "price_asc", label: "Дешевле" }, { value: "price_desc", label: "Дороже" }, { value: "year_desc", label: "Год: новее" }, { value: "mileage_asc", label: "Пробег: меньше" }]}
                  value={sort} onChange={(v) => setSort(v || "newest")} size="xs" radius="md" />
              </Box>
            </Group>

            {/* Строка 2: Цена от-до, Год от-до, Город */}
            <Group gap="xs" wrap="wrap" align="flex-end">
              <Box w={100}>
                <Text size="10px" fw={600} c="#71717a" mb={3} style={{ letterSpacing: "0.04em", textTransform: "uppercase" }}>Цена от</Text>
                <TextInput value={priceFrom} onChange={(e) => setPriceFrom(e.currentTarget.value)} size="xs" radius="md" placeholder="0" type="number" variant="filled"
                  styles={{ input: { background: "#f4f4f5", border: "1px solid transparent" } }} />
              </Box>
              <Box w={100}>
                <Text size="10px" fw={600} c="#71717a" mb={3} style={{ letterSpacing: "0.04em", textTransform: "uppercase" }}>Цена до</Text>
                <TextInput value={priceTo} onChange={(e) => setPriceTo(e.currentTarget.value)} size="xs" radius="md" placeholder="∞" type="number" variant="filled"
                  styles={{ input: { background: "#f4f4f5", border: "1px solid transparent" } }} />
              </Box>
              <Box w={90}>
                <Text size="10px" fw={600} c="#71717a" mb={3} style={{ letterSpacing: "0.04em", textTransform: "uppercase" }}>Год от</Text>
                <Select data={Array.from({ length: 35 }, (_, i) => String(2024 - i))} value={yearFrom} onChange={setYearFrom} size="xs" radius="md" placeholder="1990" searchable />
              </Box>
              <Box w={90}>
                <Text size="10px" fw={600} c="#71717a" mb={3} style={{ letterSpacing: "0.04em", textTransform: "uppercase" }}>Год до</Text>
                <Select data={Array.from({ length: 35 }, (_, i) => String(2024 - i))} value={yearTo} onChange={setYearTo} size="xs" radius="md" placeholder="2024" searchable />
              </Box>
              <Box w={130}>
                <Text size="10px" fw={600} c="#71717a" mb={3} style={{ letterSpacing: "0.04em", textTransform: "uppercase" }}>Город</Text>
                <TextInput value={city} onChange={(e) => setCity(e.currentTarget.value)} size="xs" radius="md" placeholder="Любой" variant="filled"
                  styles={{ input: { background: "#f4f4f5", border: "1px solid transparent" } }} />
              </Box>
              {activeFiltersCount > 0 && (
                <Button variant="subtle" color="red" size="xs" onClick={resetFilters}>Сбросить ({activeFiltersCount})</Button>
              )}
            </Group>
          </Stack>
        </Paper>

        {/* Результаты */}
        {isLoading ? (
          <Center py={60}><Loader color="indigo" size="sm" /></Center>
        ) : error ? (
          <Center py={60}><Button variant="subtle" color="indigo" onClick={() => window.location.reload()}>Повторить</Button></Center>
        ) : !data?.listings?.length ? (
          <Center py={60}>
            <Stack align="center" gap="sm">
              <IconAdjustmentsHorizontal size={30} stroke={1.5} color="#d4d4d8" />
              <Text fw={500} size="sm" c="#52525b">Ничего не найдено</Text>
              {activeFiltersCount > 0 && <Button variant="subtle" color="indigo" size="sm" onClick={resetFilters}>Сбросить</Button>}
            </Stack>
          </Center>
        ) : view === "grid" ? (
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="sm">
            {data.listings.map((l) => <ListingCard key={l.id} listing={l} />)}
          </SimpleGrid>
        ) : (
          <Stack gap="xs">{data.listings.map((l) => <ListingRow key={l.id} listing={l} />)}</Stack>
        )}

        {data && data.pagination.pages > 1 && (
          <Group justify="center" mt="sm">
            <Pagination value={page} onChange={setPage} total={data.pagination.pages} color="indigo" radius="md" size="sm" />
          </Group>
        )}
      </Stack>
    </Box>
  )
}

function pluralListings(n: number): string {
  const m10 = n % 10, m100 = n % 100
  if (m10 === 1 && m100 !== 11) return "объявление"
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return "объявления"
  return "объявлений"
}
