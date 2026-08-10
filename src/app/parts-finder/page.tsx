"use client"
export const dynamic = "force-dynamic"
import { useEffect, useMemo, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import useSWR from "swr"
import Link from "next/link"
import { Box, Stack, Group, Text, Paper, Select, TextInput, Button, Center, Loader, Badge, ThemeIcon, Container, SimpleGrid, Pagination, SegmentedControl } from "@mantine/core"
import { IconSearch, IconCar, IconCheck, IconAdjustmentsHorizontal, IconCircleCheck, IconHash, IconTools } from "@tabler/icons-react"
import { findLabel, PART_TYPES, PART_SUBCATEGORIES, PART_CONDITIONS, PART_AVAILABILITY_TYPES, AVAILABILITY_TYPES } from "@/lib/constants"
import { getBrandsByCategory } from "@/lib/catalog"
import { formatPrice, parseImages } from "@/lib/format"
import { fetchJson } from "@/lib/api-client"
import { AsyncErrorState, ResultsGridSkeleton } from "@/components/ui/AsyncStates"

type PartResult = {
  id: string
  name: string
  price: number | null
  images: string | null
  condition?: string | null
  availability?: string | null
  saleFormat?: string | null
  subcategory?: string | null
  oemNumber?: string | null
  location?: string | null
  compatibility?: Array<{ make: string; model: string }>
}

type PartsResponse = {
  parts: PartResult[]
  pagination: { total: number; pages: number; limit: number }
}

const fetcher = fetchJson

function PartMedia({ image, name }: { image: string; name: string }) {
  const [failed, setFailed] = useState(!image || image.includes("/placeholder"))
  const [loaded, setLoaded] = useState(false)

  return (
    <Box className="part-result-card__media">
      <Stack gap={4} align="center" className="part-result-card__placeholder" style={{ opacity: !loaded || failed ? 1 : 0 }}>
        <ThemeIcon variant="light" color="indigo" size={50} radius="xl"><IconTools size={28} stroke={1.5} /></ThemeIcon>
      </Stack>
      {!failed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt={name} onLoad={() => setLoaded(true)} onError={() => setFailed(true)} loading="lazy" decoding="async" data-loaded={loaded || undefined} />
      )}
    </Box>
  )
}

function PartsContent() {
  const sp = useSearchParams()
  const router = useRouter()
  const searchKey = sp.toString()
  const urlPartType = sp.get("partType")
  const urlSubcategory = sp.get("subcategory")
  const [q, setQ] = useState(sp.get("q") || "")
  const [partType, setPartType] = useState<string | null>(sp.get("partType"))
  const [subcategory, setSubcategory] = useState<string | null>(sp.get("subcategory"))
  const [make, setMake] = useState<string | null>(sp.get("make"))
  const [model, setModel] = useState<string | null>(sp.get("model"))
  const [condition, setCondition] = useState<string | null>(sp.get("condition"))
  const [availability, setAvailability] = useState<string | null>(sp.get("availability"))
  const [saleFormat, setSaleFormat] = useState<string | null>(sp.get("saleFormat"))
  const [priceFrom, setPriceFrom] = useState(sp.get("priceFrom") || "")
  const [priceTo, setPriceTo] = useState(sp.get("priceTo") || "")
  const [page, setPage] = useState(Number(sp.get("page")) || 1)

  useEffect(() => {
    const validPartType = urlPartType && PART_TYPES.some((item) => item.value === urlPartType) ? urlPartType : null
    const validSubcategory = validPartType && urlSubcategory && (PART_SUBCATEGORIES[validPartType] || []).includes(urlSubcategory)
      ? urlSubcategory
      : null
    setPartType((current) => current === validPartType ? current : validPartType)
    setSubcategory((current) => current === validSubcategory ? current : validSubcategory)
  }, [urlPartType, urlSubcategory])

  const selectPartType = (nextPartType: string | null) => {
    setPartType(nextPartType)
    setSubcategory(null)
    setPage(1)
    const params = new URLSearchParams(searchKey)
    if (nextPartType) params.set("partType", nextPartType)
    else params.delete("partType")
    params.delete("subcategory")
    params.delete("page")
    const query = params.toString()
    router.replace(query ? `/parts-finder?${query}` : "/parts-finder", { scroll: false })
  }

  const selectSubcategory = (nextSubcategory: string | null) => {
    setSubcategory(nextSubcategory)
    setPage(1)
    const params = new URLSearchParams(searchKey)
    if (nextSubcategory) params.set("subcategory", nextSubcategory)
    else params.delete("subcategory")
    params.delete("page")
    const query = params.toString()
    router.replace(query ? `/parts-finder?${query}` : "/parts-finder", { scroll: false })
  }

  const partBrandOptions = getBrandsByCategory("cars").map((brand) => ({ value: brand.name, label: brand.name }))
  const modelRequest = make ? `/api/v1/models?brand_id=${encodeURIComponent(make)}&category=cars` : null
  const { data: modelsData, error: modelsError, isLoading: isModelsLoading } = useSWR<{ models?: string[] }>(modelRequest, fetcher)
  const modelOptions = (modelsData?.models || []).map((value) => ({ value, label: value }))
  const hasInvalidPriceRange = Boolean(priceFrom && priceTo && Number(priceFrom) > Number(priceTo))
  const filterKey = useMemo(() => [q, partType, subcategory, make, model, condition, availability, saleFormat, priceFrom, priceTo].join("|"), [q, partType, subcategory, make, model, condition, availability, saleFormat, priceFrom, priceTo])

  useEffect(() => {
    setPage(1)
  }, [filterKey])

  const subcats = partType ? PART_SUBCATEGORIES[partType] || [] : []

  const buildQuery = () => {
    const u = new URLSearchParams()
    u.set("page", String(page))
    u.set("limit", "24")
    if (q) u.set("q", q)
    if (partType) u.set("partType", partType)
    if (subcategory) u.set("subcategory", subcategory)
    if (make) u.set("make", make)
    if (model) u.set("model", model)
    if (condition) u.set("condition", condition)
    if (availability) u.set("availability", availability)
    if (saleFormat) u.set("saleFormat", saleFormat)
    if (priceFrom) u.set("priceFrom", priceFrom)
    if (priceTo) u.set("priceTo", priceTo)
    if (make) u.set("compatible", "true")
    return u.toString()
  }

  const { data, error, isLoading, mutate } = useSWR<PartsResponse>(hasInvalidPriceRange ? null : "/api/parts?" + buildQuery(), fetcher)
  const parts: PartResult[] = data?.parts || []

  const resetFilters = () => {
    setQ(""); setPartType(null); setSubcategory(null); setMake(null); setModel(null)
    setCondition(null); setAvailability(null); setSaleFormat(null); setPriceFrom(""); setPriceTo(""); setPage(1)
    router.replace("/parts-finder", { scroll: false })
  }

  const CategoryBar = (
    <Paper radius="md" p="sm" withBorder className="parts-category-bar">
      <Stack gap={8}>
        <Group gap="xs" justify="space-between">
          <Group gap="xs"><ThemeIcon variant="light" color="indigo" size={28} radius="md"><IconTools size={16} /></ThemeIcon><Text fw={800} fz="sm" ff="var(--font-display),sans-serif">Категории запчастей</Text></Group>
          {partType && <Button variant="subtle" color="gray" size="compact-xs" onClick={() => selectPartType(null)}>Сбросить категорию</Button>}
        </Group>
        <Group gap={6} wrap="wrap">
          <Button size="compact-sm" radius="md" variant={!partType ? "filled" : "default"} color="indigo" onClick={() => selectPartType(null)}>Все запчасти</Button>
          {PART_TYPES.map((t) => (
            <Button key={t.value} size="compact-sm" radius="md" variant={partType === t.value ? "filled" : "default"} color="indigo" onClick={() => selectPartType(partType === t.value ? null : t.value)}>{t.label}</Button>
          ))}
        </Group>
        {partType && subcats.length > 0 && (
          <Group gap={6} wrap="wrap" className="parts-subcategories">
            <Text size="xs" c="dimmed">Уточнить:</Text>
            {subcats.map((sc) => <Button key={sc} size="compact-xs" radius="xl" variant={subcategory === sc ? "light" : "subtle"} color="violet" onClick={() => selectSubcategory(subcategory === sc ? null : sc)}>{sc}</Button>)}
          </Group>
        )}
      </Stack>
    </Paper>
  )

  const VehiclePicker = (
    <Paper radius="md" p="md" withBorder className="parts-vehicle-inline__panel">
      <Stack gap="sm">
        <Group gap="sm">
          <ThemeIcon variant="light" color="violet" size={32} radius="md"><IconCar size={18} /></ThemeIcon>
          <Stack gap={0}>
            <Text fw={800} fz="sm" c="dark.9" ff="var(--font-display),sans-serif">Подбор по авто</Text>
            <Text size="xs" c="gray.5">Найдём запчасти на ваш авто</Text>
          </Stack>
        </Group>
        <Select label="Марка" placeholder="Выберите марку" data={partBrandOptions} searchable clearable value={make} onChange={(v) => { setMake(v); setModel(null) }} size="xs" />
        <Select
          label="Модель"
          placeholder={make ? (isModelsLoading ? "Загружаем модели" : "Любая модель") : "Сначала марка"}
          data={modelOptions}
          searchable
          clearable
          disabled={!make || isModelsLoading}
          rightSection={isModelsLoading ? <Loader size={13} aria-label="Загрузка моделей" /> : undefined}
          error={modelsError ? "Не удалось загрузить модели" : undefined}
          value={model}
          onChange={setModel}
          size="xs"
        />
        {make && (
          <Badge variant="filled" color="violet" size="sm" radius="md">
            <Group gap={4}><IconCheck size={12} /> Совместимость: {make}{model ? " " + model : ""}</Group></Badge>
        )}
        {(make || model) && (
          <Button variant="subtle" color="gray" size="xs" onClick={() => { setMake(null); setModel(null) }}>Сбросить</Button>
        )}
      </Stack>
    </Paper>
  )

  const FilterBar = (
    <Paper radius="md" p="sm" withBorder className="parts-filter-panel">
      <Stack gap="sm">
          <Box className="parts-filter-grid">
            <TextInput className="parts-filter-grid__search" label="Название, OEM или аналог" placeholder="Например, 90919-012 или Corolla" leftSection={<IconSearch size={14} />} value={q} onChange={(e) => setQ(e.target.value)} size="sm" />
            <Box className="parts-price-range"><Text size="10px" c="dimmed" fw={700} tt="uppercase">Цена, ₽</Text><Group gap={4} wrap="nowrap"><TextInput aria-label="Цена от" placeholder="От" value={priceFrom} onChange={(e) => setPriceFrom(e.target.value)} size="sm" type="number" error={hasInvalidPriceRange} /><TextInput aria-label="Цена до" placeholder="До" value={priceTo} onChange={(e) => setPriceTo(e.target.value)} size="sm" type="number" error={hasInvalidPriceRange} /></Group></Box>
            <Select label="Состояние" placeholder="Любое" data={PART_CONDITIONS.map((c) => ({ value: c.value, label: c.label }))} clearable value={condition} onChange={setCondition} size="sm" />
            <Box className="parts-filter-field"><Text size="10px" c="dimmed" fw={700} tt="uppercase" mb={5}>Наличие</Text><SegmentedControl size="xs" fullWidth value={availability || "ANY"} onChange={(value) => setAvailability(value === "ANY" ? null : value)} data={[{ value: "ANY", label: "Все" }, ...PART_AVAILABILITY_TYPES.map((item) => ({ value: item.value, label: item.label }))]} /></Box>
            <Select label="Формат сделки" placeholder="Любой" data={[{ value: "FIXED", label: "Фиксированная цена" }, { value: "AUCTION", label: "Аукцион" }]} clearable value={saleFormat} onChange={setSaleFormat} size="sm" />
          </Box>
        {hasInvalidPriceRange && <Text size="xs" c="red">Цена «от» не может быть выше цены «до».</Text>}
        {(partType || make || condition || availability || saleFormat || priceFrom || priceTo) && (
          <Group gap={6} wrap="wrap">
            <Text size="xs" c="gray.5">Активные:</Text>
            {partType && <Badge size="xs" variant="light" color="indigo">{PART_TYPES.find((t) => t.value === partType)?.label}</Badge>}
            {subcategory && <Badge size="xs" variant="light" color="violet">{subcategory}</Badge>}
            {condition && <Badge size="xs" variant="light" color="green">{findLabel(PART_CONDITIONS, condition)}</Badge>}
            {availability && <Badge size="xs" variant="light" color="teal">{findLabel(AVAILABILITY_TYPES, availability)}</Badge>}
            {saleFormat && <Badge size="xs" variant="light" color="orange">{saleFormat === "AUCTION" ? "Аукцион" : "Цена"}</Badge>}
            {priceFrom && <Badge size="xs" variant="light" color="gray">от {priceFrom}₽</Badge>}
            {priceTo && <Badge size="xs" variant="light" color="gray">до {priceTo}₽</Badge>}
            <Button variant="subtle" size="xs" color="red" onClick={resetFilters}>Сбросить</Button>
          </Group>
        )}
      </Stack>
    </Paper>
  )

  return (
    <Container size="xl" p={{ base: "sm", md: "md" }}>
      <Stack gap="md">
        {/* Заголовок */}
        <Group gap="sm" align="center" justify="space-between">
          <Group gap="sm">
            <ThemeIcon variant="light" color="indigo" size={44} radius="md"><IconAdjustmentsHorizontal size={22} /></ThemeIcon>
            <Stack gap={0}>
              <Text component="h1" fw={800} fz={22} c="dark.9" ff="var(--font-display),sans-serif">Каталог запчастей</Text>
              <Text size="xs" c="gray.5">{data?.pagination?.total || 0} запчастей · кросс-совместимость по авто</Text>
            </Stack>
          </Group>
        </Group>

        {CategoryBar}

        <Group gap="md" align="stretch" className="parts-workspace" wrap="wrap">
          <Box style={{ flex: 1, minWidth: 0 }}>{FilterBar}</Box>
          <Box className="parts-vehicle-inline">{VehiclePicker}</Box>
        </Group>

        <Stack gap="sm">

              {isLoading ? (
                <ResultsGridSkeleton count={6} mediaHeight={148} />
              ) : error ? (
                <AsyncErrorState
                  title="Не удалось загрузить запчасти"
                  description="Каталог временно не отвечает. Попробуйте обновить выдачу."
                  onRetry={() => mutate()}
                />
              ) : parts.length === 0 ? (
                <Paper radius="md" p="xl" withBorder>
                  <Center><Stack align="center"><IconTools size={40} color="#a1a1aa" /><Text c="gray.5">Запчасти не найдены. Измените фильтры.</Text></Stack></Center>
                </Paper>
              ) : (
                <SimpleGrid cols={{ base: 1, sm: 2, xl: 3 }} spacing="sm">
                  {parts.map((p) => {
                    const images = parseImages(p.images)
                    const image = images[0] || ""
                    return (
                      <Paper key={p.id} radius="md" withBorder className="part-result-card" style={{ overflow: "hidden", borderColor: "var(--mantine-color-border)" }}>
                        <Link href={`/listings/part/${p.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                          <PartMedia image={image} name={p.name} />
                        </Link>
                        <Box p="sm">
                            <Stack gap={4}>
                              <Group gap="sm" align="flex-start" justify="space-between">
                                <Link href={`/listings/part/${p.id}`} style={{ textDecoration: "none" }}>
                                  <Text fw={700} fz="sm" c="dark.9">{p.name}</Text>
                                </Link>
                                <Text fw={800} fz="md" c="dark.9" ff="var(--font-display),sans-serif">{formatPrice(p.price)}</Text>
                              </Group>

                              <Group gap={6} wrap="wrap">
                                {p.condition && <Badge size="xs" variant="light" color={p.condition === "NEW" ? "green" : "gray"}>{findLabel(PART_CONDITIONS, p.condition)}</Badge>}
                                {p.availability && <Badge size="xs" variant="light" color={p.availability === "ON_ORDER" ? "orange" : "teal"}>{findLabel(AVAILABILITY_TYPES, p.availability)}</Badge>}
                                {p.saleFormat === "AUCTION" && <Badge size="xs" variant="filled" color="orange">Аукцион</Badge>}
                                {p.subcategory && <Badge size="xs" variant="light" color="indigo">{p.subcategory}</Badge>}
                                {p.oemNumber && <Badge size="xs" variant="light" color="dark"><Group gap={3}><IconHash size={9} /> {p.oemNumber}</Group></Badge>}
                              </Group>

                              {p.compatibility && p.compatibility.length > 0 && (
                                <Group gap={4} wrap="wrap" mt={2}>
                                  <Group gap={3}>
                                    <IconCircleCheck size={13} color="#059669" />
                                    <Text size="xs" fw={600} c="gray.6">Подходит:</Text>
                                  </Group>
                                  {p.compatibility.slice(0, 4).map((c, i) => (
                                    <Badge key={i} size="xs" variant="filled" color="indigo" radius="sm">{c.make} {c.model}</Badge>
                                  ))}
                                  {p.compatibility.length > 4 && (
                                    <Text size="xs" c="gray.5">+{p.compatibility.length - 4} ещё</Text>
                                  )}
                                </Group>
                              )}

                              <Group gap="xs" mt={4} justify="space-between">
                                <Text size="xs" c="gray.4">{p.location || "Город не указан"}</Text>
                                <Text size="xs" fw={700} c="indigo.6">Подробнее →</Text>
                              </Group>
                            </Stack>
                        </Box>
                      </Paper>
                    )
                  })}
                </SimpleGrid>
              )}
        </Stack>

        {data && data.pagination?.pages > 1 && <Stack align="center" gap={6}><Pagination value={page} onChange={setPage} total={data.pagination.pages} boundaries={1} siblings={1} size="sm" color="indigo" /><Text size="xs" c="dimmed">Страница {page} из {data.pagination.pages} · по {data.pagination.limit} запчасти</Text></Stack>}
      </Stack>
    </Container>
  )
}

export default function PartsFinderPage() {
  return (
    <Suspense fallback={<Container py={80}><Center><Loader size="sm" color="indigo" /></Center></Container>}>
      <PartsContent />
    </Suspense>
  )
}
