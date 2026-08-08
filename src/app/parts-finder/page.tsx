"use client"
export const dynamic = "force-dynamic"
import { useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import useSWR from "swr"
import Link from "next/link"
import { Box, Stack, Group, Text, Paper, Select, TextInput, Button, SimpleGrid, Center, Loader, Badge, Divider, Chip, ThemeIcon, ScrollArea, Container, MediaQuery, Drawer, Accordion } from "@mantine/core"
import { IconSearch, IconCar, IconCheck, IconAdjustmentsHorizontal, IconBrand, IconFilter, IconCircleCheck, IconTag, IconHash, IconTools } from "@tabler/icons-react"
import { PART_TYPES, PART_SUBCATEGORIES, CONDITIONS } from "@/lib/constants"
import { POPULAR_BRANDS, getModels } from "@/lib/catalog"
import { formatPrice, parseImages } from "@/lib/format"

const fetcher = (url) => fetch(url).then((r) => r.json())

function PartsContent() {
  const sp = useSearchParams()
  const [q, setQ] = useState(sp.get("q") || "")
  const [partType, setPartType] = useState(sp.get("partType") || null)
  const [subcategory, setSubcategory] = useState(null)
  const [make, setMake] = useState(null)
  const [model, setModel] = useState(null)
  const [condition, setCondition] = useState(null)
  const [priceFrom, setPriceFrom] = useState("")
  const [priceTo, setPriceTo] = useState("")
  const [showFilters, setShowFilters] = useState(false)

  const subcats = partType ? PART_SUBCATEGORIES[partType] || [] : []

  const buildQuery = () => {
    const u = new URLSearchParams()
    if (q) u.set("q", q)
    if (partType) u.set("partType", partType)
    if (subcategory) u.set("subcategory", subcategory)
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

  const CategorySidebar = (
    <Stack gap={2}>
      <Group gap="sm" mb="xs">
        <ThemeIcon variant="light" color="indigo" size={32} radius="md"><IconTools size={18} /></ThemeIcon>
        <Text fw={800} fz="sm" c="dark.9" ff="var(--font-display),sans-serif">Категории</Text>
      </Group>
      <Box
        component="button"
        onClick={() => { setPartType(null); setSubcategory(null) }}
        style={{
          width: "100%", textAlign: "left", padding: "8px 12px", borderRadius: 8, cursor: "pointer",
          background: !partType ? "#4f46e5" : "transparent",
          color: !partType ? "white" : "var(--mantine-color-gray-7)",
          border: "none", fontWeight: !partType ? 600 : 500, fontSize: "0.8125rem",
          transition: "all 150ms",
        }}
      >Все запчасти</Box>
      {PART_TYPES.map((t) => (
        <Box key={t.value}>
          <Box
            component="button"
            onClick={() => { setPartType(partType === t.value ? null : t.value); setSubcategory(null) }}
            style={{
              width: "100%", textAlign: "left", padding: "8px 12px", borderRadius: 8, cursor: "pointer",
              background: partType === t.value ? "#eef2ff" : "transparent",
              color: partType === t.value ? "#4f46e5" : "var(--mantine-color-gray-7)",
              border: "none", fontWeight: partType === t.value ? 700 : 500, fontSize: "0.8125rem",
              transition: "all 150ms",
            }}
          >{t.label}</Box>
          {partType === t.value && subcats.length > 0 && (
            <Stack gap={1} pl={16} pt={2} pb={4}>
              {subcats.map((sc) => (
                <Box
                  key={sc}
                  component="button"
                  onClick={() => setSubcategory(subcategory === sc ? null : sc)}
                  style={{
                    width: "100%", textAlign: "left", padding: "4px 8px", borderRadius: 6, cursor: "pointer",
                    background: subcategory === sc ? "#f5f3ff" : "transparent",
                    color: subcategory === sc ? "#7c3aed" : "var(--mantine-color-gray-5)",
                    border: "none", fontWeight: subcategory === sc ? 600 : 400, fontSize: "0.75rem",
                  }}
                >{sc}</Box>
              ))}
            </Stack>
          )}
        </Box>
      ))}
    </Stack>
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
        <Group gap="xs" wrap="wrap" align="flex-end">
          <TextInput placeholder="Поиск по названию, OEM..." leftSection={<IconSearch size={14} />} value={q} onChange={(e) => setQ(e.target.value)} size="xs" style={{ flex: 1, minWidth: 180 }} />
          <TextInput placeholder="Цена от" value={priceFrom} onChange={(e) => setPriceFrom(e.target.value)} size="xs" w={80} type="number" />
          <TextInput placeholder="до" value={priceTo} onChange={(e) => setPriceTo(e.target.value)} size="xs" w={80} type="number" />
          <Select placeholder="Состояние" data={CONDITIONS.map((c) => ({ value: c.value, label: c.label }))} clearable value={condition} onChange={setCondition} size="xs" w={110} />
        </Group>
        {(partType || make || condition || priceFrom || priceTo) && (
          <Group gap={6}>
            <Text size="xs" c="gray.5">Активные:</Text>
            {partType && <Badge size="xs" variant="light" color="indigo">{PART_TYPES.find((t) => t.value === partType)?.label}</Badge>}
            {subcategory && <Badge size="xs" variant="light" color="violet">{subcategory}</Badge>}
            {condition && <Badge size="xs" variant="light" color="green">{condition}</Badge>}
            {priceFrom && <Badge size="xs" variant="light" color="gray">от {priceFrom}₽</Badge>}
            {priceTo && <Badge size="xs" variant="light" color="gray">до {priceTo}₽</Badge>}
            <Button variant="subtle" size="xs" color="red" onClick={() => { setPartType(null); setSubcategory(null); setCondition(null); setPriceFrom(""); setPriceTo("") }}>Сбросить</Button>
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
          <MediaQuery largerThan="md" styles={{ display: "none" }}>
            <Button variant="light" color="indigo" size="sm" leftSection={<IconFilter size={16} />} onClick={() => setShowFilters(true)}>Категории</Button>
          </MediaQuery>
        </Group>

        {/* Трёхколоночный layout */}
        <Group gap="md" align="flex-start" wrap="nowrap">
          {/* Левая колонка — категории (десктоп) */}
          <MediaQuery smallerThan="md" styles={{ display: "none" }}>
            <Box style={{ width: 220, flexShrink: 0, position: "sticky", top: 64 }}>
              <Paper radius="md" p="sm" withBorder>
                <ScrollArea.Autosize maxHeight={600}>
                  {CategorySidebar}
                </ScrollArea.Autosize>
              </Paper>
            </Box>
          </MediaQuery>

          {/* Центр — результаты */}
          <Box style={{ flex: 1, minWidth: 0 }}>
            <Stack gap="sm">
              {FilterBar}

              {isLoading ? (
                <Center py={60}><Loader size="sm" color="indigo" /></Center>
              ) : parts.length === 0 ? (
                <Paper radius="md" p="xl" withBorder>
                  <Center><Stack align="center"><IconTools size={40} color="#a1a1aa" /><Text c="gray.5">Запчасти не найдены. Измените фильтры.</Text></Stack></Center>
                </Paper>
              ) : (
                <Stack gap="xs">
                  {parts.map((p) => {
                    const images = parseImages(p.images)
                    const image = images[0] || "/placeholder.svg"
                    return (
                      <Paper key={p.id} radius="md" withBorder style={{ overflow: "hidden", borderColor: "var(--mantine-color-border)", transition: "all 200ms" }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--mantine-color-gray-4)" }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--mantine-color-border)" }}>
                        <Group gap={0} align="stretch" wrap="nowrap">
                          <Link href={`/listings/part/${p.id}`} style={{ flexShrink: 0 }}>
                            <Box style={{ width: 120, height: "100%", minHeight: 110, background: "var(--mantine-color-gray-1)" }}>
                              <img src={image} alt={p.name} style={{ width: "100%", height: "100%", minHeight: 110, objectFit: "cover" }} />
                            </Box>
                          </Link>
                          <Box p="sm" style={{ flex: 1, minWidth: 0 }}>
                            <Stack gap={4}>
                              <Group gap="sm" align="flex-start" justify="space-between">
                                <Link href={`/listings/part/${p.id}`} style={{ textDecoration: "none" }}>
                                  <Text fw={700} fz="sm" c="dark.9">{p.name}</Text>
                                </Link>
                                <Text fw={800} fz="md" c="dark.9" ff="var(--font-display),sans-serif">{formatPrice(p.price)}</Text>
                              </Group>

                              <Group gap={6} wrap="wrap">
                                {p.condition === "NEW" && <Badge size="xs" variant="filled" color="green">Новая</Badge>}
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

                              <Group gap="xs" mt={2} justify="space-between">
                                <Text size="xs" c="gray.4">{p.location || "Москва"}</Text>
                                <Button component={Link} href={`/listings/part/${p.id}`} variant="light" color="indigo" size="xs" radius="md">Подробнее</Button>
                              </Group>
                            </Stack>
                          </Box>
                        </Group>
                      </Paper>
                    )
                  })}
                </Stack>
              )}
            </Stack>
          </Box>

          {/* Правая колонка — подбор по авто (десктоп) */}
          <MediaQuery smallerThan="lg" styles={{ display: "none" }}>
            <Box style={{ width: 240, flexShrink: 0, position: "sticky", top: 64 }}>
              {VehiclePicker}
            </Box>
          </MediaQuery>
        </Group>
      </Stack>

      {/* Drawer для мобильных категорий */}
      <Drawer opened={showFilters} onClose={() => setShowFilters(false)} title="Категории запчастей" padding="md" size="sm">
        {CategorySidebar}
        <Box mt="md">{VehiclePicker}</Box>
      </Drawer>
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
