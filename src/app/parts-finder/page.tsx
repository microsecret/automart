"use client"
export const dynamic = "force-dynamic"
import { useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import useSWR from "swr"
import Link from "next/link"
import { Box, Stack, Group, Text, Paper, Select, TextInput, Button, Center, Loader, Badge, ThemeIcon, Container, SimpleGrid, Pagination } from "@mantine/core"
import { IconSearch, IconCar, IconCheck, IconAdjustmentsHorizontal, IconCircleCheck, IconHash, IconTools } from "@tabler/icons-react"
import { PART_TYPES, PART_SUBCATEGORIES, CONDITIONS } from "@/lib/constants"
import { POPULAR_BRANDS, getModels } from "@/lib/catalog"
import { formatPrice, parseImages } from "@/lib/format"

type PartResult = {
  id: string
  name: string
  price: number | null
  images: string | null
  condition?: string | null
  saleFormat?: string | null
  subcategory?: string | null
  oemNumber?: string | null
  location?: string | null
  compatibility?: Array<{ make: string; model: string }>
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

function PartMedia({ image, name }: { image: string; name: string }) {
  const [failed, setFailed] = useState(!image || image.includes("/placeholder"))
  const [loaded, setLoaded] = useState(false)

  return (
    <Box className="part-result-card__media">
      <Stack gap={4} align="center" className="part-result-card__placeholder" style={{ opacity: !loaded || failed ? 1 : 0 }}>
        <ThemeIcon variant="light" color="indigo" size={50} radius="xl"><IconTools size={28} stroke={1.5} /></ThemeIcon>
        <Text size="10px" c="dimmed">Фото продавца</Text>
      </Stack>
      {!failed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt={name} onLoad={() => setLoaded(true)} onError={() => setFailed(true)} data-loaded={loaded || undefined} />
      )}
    </Box>
  )
}

function PartsContent() {
  const sp = useSearchParams()
  const [q, setQ] = useState(sp.get("q") || "")
  const [partType, setPartType] = useState<string | null>(sp.get("partType"))
  const [subcategory, setSubcategory] = useState<string | null>(null)
  const [make, setMake] = useState<string | null>(null)
  const [model, setModel] = useState<string | null>(null)
  const [condition, setCondition] = useState<string | null>(null)
  const [saleFormat, setSaleFormat] = useState<string | null>(null)
  const [priceFrom, setPriceFrom] = useState("")
  const [priceTo, setPriceTo] = useState("")
  const [page, setPage] = useState(1)

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
    if (saleFormat) u.set("saleFormat", saleFormat)
    if (priceFrom) u.set("priceFrom", priceFrom)
    if (priceTo) u.set("priceTo", priceTo)
    if (make) u.set("compatible", "true")
    return u.toString()
  }

  const { data, isLoading } = useSWR("/api/parts?" + buildQuery(), fetcher)
  const parts: PartResult[] = data?.parts || []

  const CategoryBar = (
    <Paper radius="md" p="sm" withBorder className="parts-category-bar">
      <Stack gap={8}>
        <Group gap="xs" justify="space-between">
          <Group gap="xs"><ThemeIcon variant="light" color="indigo" size={28} radius="md"><IconTools size={16} /></ThemeIcon><Text fw={800} fz="sm" ff="var(--font-display),sans-serif">Категории запчастей</Text></Group>
          {partType && <Button variant="subtle" color="gray" size="compact-xs" onClick={() => { setPartType(null); setSubcategory(null); setPage(1) }}>Сбросить категорию</Button>}
        </Group>
        <Group gap={6} wrap="wrap">
          <Button size="compact-sm" radius="md" variant={!partType ? "filled" : "default"} color="indigo" onClick={() => { setPartType(null); setSubcategory(null); setPage(1) }}>Все запчасти</Button>
          {PART_TYPES.map((t) => (
            <Button key={t.value} size="compact-sm" radius="md" variant={partType === t.value ? "filled" : "default"} color="indigo" onClick={() => { setPartType(partType === t.value ? null : t.value); setSubcategory(null); setPage(1) }}>{t.label}</Button>
          ))}
        </Group>
        {partType && subcats.length > 0 && (
          <Group gap={6} wrap="wrap" className="parts-subcategories">
            <Text size="xs" c="dimmed">Уточнить:</Text>
            {subcats.map((sc) => <Button key={sc} size="compact-xs" radius="xl" variant={subcategory === sc ? "light" : "subtle"} color="violet" onClick={() => { setSubcategory(subcategory === sc ? null : sc); setPage(1) }}>{sc}</Button>)}
          </Group>
        )}
      </Stack>
    </Paper>
  )

  const VehiclePicker = (
    <Paper radius="md" p="md" withBorder style={{ background: "linear-gradient(135deg, #eef2ff, #f5f3ff)" }}>
      <Stack gap="sm">
        <Group gap="sm">
          <ThemeIcon variant="light" color="violet" size={32} radius="md"><IconCar size={18} /></ThemeIcon>
          <Stack gap={0}>
            <Text fw={800} fz="sm" c="dark.9" ff="var(--font-display),sans-serif">Подбор по авто</Text>
            <Text size="xs" c="gray.5">Найдём запчасти на ваш авто</Text>
          </Stack>
        </Group>
        <Select placeholder="Марка" data={POPULAR_BRANDS.slice(0, 60).map((b) => ({ value: b.name, label: b.name }))} searchable clearable value={make} onChange={(v) => { setMake(v); setModel(null) }} size="xs" />
        <Select placeholder="Модель" data={make ? getModels(make).map((m) => ({ value: m, label: m })) : []} searchable clearable disabled={!make} value={model} onChange={setModel} size="xs" />
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
    <Paper radius="md" p="sm" withBorder>
      <Stack gap="sm">
        <Box className="parts-filter-grid">
          <TextInput className="parts-filter-grid__search" placeholder="Название или OEM-номер" leftSection={<IconSearch size={14} />} value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} size="sm" />
          <Box className="parts-price-range"><Text size="10px" c="dimmed" fw={700} tt="uppercase">Цена, ₽</Text><Group gap={4} wrap="nowrap"><TextInput aria-label="Цена от" placeholder="От" value={priceFrom} onChange={(e) => { setPriceFrom(e.target.value); setPage(1) }} size="sm" type="number" /><TextInput aria-label="Цена до" placeholder="До" value={priceTo} onChange={(e) => { setPriceTo(e.target.value); setPage(1) }} size="sm" type="number" /></Group></Box>
          <Select placeholder="Состояние" data={CONDITIONS.map((c) => ({ value: c.value, label: c.label }))} clearable value={condition} onChange={(v) => { setCondition(v); setPage(1) }} size="sm" />
          <Select placeholder="Формат продажи" data={[{ value: "FIXED", label: "Фиксированная цена" }, { value: "AUCTION", label: "Аукцион" }]} clearable value={saleFormat} onChange={(v) => { setSaleFormat(v); setPage(1) }} size="sm" />
        </Box>
        {(partType || make || condition || saleFormat || priceFrom || priceTo) && (
          <Group gap={6} wrap="wrap">
            <Text size="xs" c="gray.5">Активные:</Text>
            {partType && <Badge size="xs" variant="light" color="indigo">{PART_TYPES.find((t) => t.value === partType)?.label}</Badge>}
            {subcategory && <Badge size="xs" variant="light" color="violet">{subcategory}</Badge>}
            {condition && <Badge size="xs" variant="light" color="green">{condition}</Badge>}
            {saleFormat && <Badge size="xs" variant="light" color="orange">{saleFormat === "AUCTION" ? "Аукцион" : "Цена"}</Badge>}
            {priceFrom && <Badge size="xs" variant="light" color="gray">от {priceFrom}₽</Badge>}
            {priceTo && <Badge size="xs" variant="light" color="gray">до {priceTo}₽</Badge>}
            <Button variant="subtle" size="xs" color="red" onClick={() => { setPartType(null); setSubcategory(null); setCondition(null); setSaleFormat(null); setPriceFrom(""); setPriceTo(""); setPage(1) }}>Сбросить</Button>
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
                <Center py={60}><Loader size="sm" color="indigo" /></Center>
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
                      <Paper key={p.id} radius="md" withBorder className="part-result-card" style={{ overflow: "hidden", borderColor: "var(--mantine-color-border)", transition: "all 200ms" }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--mantine-color-gray-4)" }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--mantine-color-border)" }}>
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
                                {p.condition === "NEW" && <Badge size="xs" variant="filled" color="green">Новая</Badge>}
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
                                    <Badge key={i} size="xs" variant="light" color="blue" radius="sm">{c.make} {c.model}</Badge>
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

        {data && data.pagination?.pages > 1 && <Group justify="center"><Pagination value={page} onChange={setPage} total={data.pagination.pages} size="sm" color="indigo" /></Group>}
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
