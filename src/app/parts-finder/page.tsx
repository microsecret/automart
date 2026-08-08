"use client"

export const dynamic = "force-dynamic"

import { useState } from "react"
import {
  Box,
  Stack,
  Title,
  Text,
  Card,
  Select,
  Group,
  Button,
  ThemeIcon,
  SimpleGrid,
  Badge,
  Alert,
  Divider,
  Chip,
  Loader,
  TextInput,
  SegmentedControl,
  Loader as MantineLoader,
} from "@mantine/core"
import {
  IconSparkles,
  IconSearch,
  IconCheck,
  IconCar,
  IconArrowRight,
  IconMenu,
  IconGrid,
  IconList,
  IconFilter,
  IconSettings,
  IconX,
} from "@tabler/icons-react"
import Link from "next/link"
import useSWR from "swr"
import {
  BRAND_NAMES,
  getModels,
  PART_TYPES,
  PART_SUBCATEGORIES,
  TRANSMISSIONS,
  SORT_OPTIONS,
  POPULAR_CITIES
} from "@/lib/catalog"
import { BODY_TYPES, DRIVE_TYPES, FUEL_TYPES } from "@/lib/constants"

const fetcher = (url: string) => fetch(url).then(res => res.json())

export default function PartsFinderPage() {
  // Filter states
  const [make, setMake] = useState("")
  const [model, setModel] = useState("")
  const [yearFrom, setYearFrom] = useState("")
  const [yearTo, setYearTo] = useState("")
  const [priceFrom, setPriceFrom] = useState("")
  const [priceTo, setPriceTo] = useState("")
  const [city, setCity] = useState("")
  const [partType, setPartType] = useState("")
  const [subcategory, setSubcategory] = useState("")
  const [transmission, setTransmission] = useState("")
  const [sort, setSort] = useState("newest")
  const [search, setSearch] = useState("")
  const [view, setView] = useState("grid") // grid or list
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [page, setPage] = useState(1)
  const [limit] = useState(20)

  // Build query parameters from filter state
  const buildQuery = () => {
    const params = new URLSearchParams()

    // Always filter for parts
    params.set("type", "part")

    // Text search
    if (search) params.set("q", search)

    // Make/Model
    if (make) params.set("make", make)
    if (model) params.set("model", model)

    // Year range
    if (yearFrom) params.set("yearFrom", yearFrom)
    if (yearTo) params.set("yearTo", yearTo)

    // Price range
    if (priceFrom) params.set("priceFrom", priceFrom)
    if (priceTo) params.set("priceTo", priceTo)

    // City
    if (city) params.set("city", city)

    // Part type and subcategory
    if (partType) params.set("partType", partType)
    if (subcategory) params.set("subcategory", subcategory)

    // Transmission (specific user request)
    if (transmission) params.set("transmission", transmission)

    // Sort
    if (sort) params.set("sort", sort)

    // Pagination
    params.set("page", String(page))
    params.set("limit", String(limit))

    return params.toString()
  }

  // Fetch data from API
  const { data, isLoading, error } = useSWR(
    buildQuery ? `/api/listings?${buildQuery()}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
    }
  )

  // Handle reset filters
  const resetFilters = () => {
    setMake("")
    setModel("")
    setYearFrom("")
    setYearTo("")
    setPriceFrom("")
    setPriceTo("")
    setCity("")
    setPartType("")
    setSubcategory("")
    setTransmission("")
    setSort("newest")
    setSearch("")
    setPage(1)
  }

  // Handle page change
  const handlePageChange = (newPage: number) => {
    setPage(newPage)
  }

  // Handle part type change (reset subcategory when part type changes)
  const handlePartTypeChange = (value: string) => {
    setPartType(value)
    setSubcategory("")
    setPage(1)
  }

  // Generate brand options based on selected category or show popular brands
  const getBrandOptions = () => {
    // For now, show all brands - in a real implementation,
    // we would filter by vehicle type or category
    return Array.from(new Set(BRAND_NAMES)).map((brand) => ({
      value: brand,
      label: brand,
    }))
  }

  // Generate model options based on selected make
  const getModelOptions = () => {
    if (!make) return []
    return getModels(make).map((model) => ({
      value: model,
      label: model,
    }))
  }

  // Generate year options
  const getYearOptions = () => {
    const currentYear = new Date().getFullYear()
    const years = Array.from({ length: 30 }, (_, i) => String(currentYear - i))
    return years.map((year) => ({ value: year, label: year }))
  }

  // Generate price options (for demonstration)
  const getPriceOptions = () => {
    const ranges = [
      { value: "0-1000", label: "До 1 000 ��� � � ₽" },
      { value: "1000-5000", label: "1 000 – 5 000 ��� � � ₽" },
      { value: "5000-10000", label: "5 000 – 10 000 ��� � � ₽" },
      { value: "10000-20000", label: "10 000 – 20 000 ��� � � ₽" },
      { value: "20000-50000", label: "20 000 – 50 000 ��� � � ₽" },
      { value: "50000-100000", label: "50 000 – 100 000 ��� � � ₽" },
      { value: "100000-200000", label: "100 000 – 200 000 ��� � � ₽" },
      { value: "200000+", label: "От 200 000 ��� � � ₽" },
    ]
    return ranges
  }

  // Generate transmission options (specific user request)
  const getTransmissionOptions = () => {
    return TRANSMISSIONS.map((t) => ({
      value: t.value,
      label: t.label,
    }))
  }

  // Generate sort options
  const getSortOptions = () => {
    return SORT_OPTIONS
  }

  // Generate city options
  const getCityOptions = () => {
    return POPULAR_CITIES.map((city) => ({
      value: city,
      label: city,
    }))
  }

  if (isLoading) {
    return (
      <Center py={80}>
        <MantineLoader color="indigo" size="sm" />
      </Center>
    )
  }

  if (error) {
    return (
      <Center py={80}>
        <Text color="red" size="sm">{error.message}</Text>
      </Center>
    )
  }

  return (
    <Box p={{ base: "sm", md: "md" }} style={{ maxWidth: 1200, margin: "0 auto" }}>
      <Stack gap="md">
        {/* Header */}
        <Group gap="sm" align="center">
          <ThemeIcon variant="light" color="violet" size={44} radius="md">
            <IconSparkles size={22} />
          </ThemeIcon>
          <Stack gap={0}>
            <Title order={2} size="h3" ff="var(--font-display),sans-serif">
              Все запчасти
            </Title>
            <Text size="xs" c="#71717a">
              Powerful catalog with categories, brands, and advanced filtering
            </Text>
          </Stack>
        </Group>

        {/* Filters Card */}
        <Card withBorder radius="md" p="lg" style={{ borderColor: "#f4f4f5" }}>
          <Stack gap="md">
            {/* Main filters */}
            <Group grow wrap>
              <Select
                label="Марка авто"
                data={getBrandOptions()}
                searchable
                value={make}
                onChange={setMake}
                size="sm"
                placeholder="Выберите марку"
              />
              <Select
                label="Модель"
                data={getModelOptions()}
                searchable
                value={model}
                onChange={setModel}
                size="sm"
                placeholder="Выберите модель"
              />
              <Group grow wrap>
                <Select
                  label="Год от"
                  data={getYearOptions()}
                  searchable
                  value={yearFrom}
                  onChange={setYearFrom}
                  size="sm"
                  placeholder="Год от"
                />
                <Select
                  label="Год до"
                  data={getYearOptions()}
                  searchable
                  value={yearTo}
                  onChange={setYearTo}
                  size="sm"
                  placeholder="Год до"
                />
              </Group>
              <Group grow wrap>
                <Select
                  label="Цена от"
                  data={getPriceOptions()}
                  value={priceFrom}
                  onChange={setPriceFrom}
                  size="sm"
                  placeholder="Цена от"
                />
                <Select
                  label="Цена до"
                  data={getPriceOptions()}
                  value={priceTo}
                  onChange={setPriceTo}
                  size="sm"
                  placeholder="Цена до"
                />
              </Group>
              <Select
                label="Город"
                data={getCityOptions()}
                searchable
                value={city}
                onChange={setCity}
                size="sm"
                placeholder="Выберите город"
              />
              <Select
                label="Тип запчасти"
                data={PART_TYPES.map((pt) => ({ value: pt.value, label: pt.label }))}
                value={partType}
                onChange={handlePartTypeChange}
                size="sm"
                placeholder="Выберите тип"
              />
              {partType && (
                <Select
                  label="Подкатегория"
                  data={PART_SUBCATEGORIES[partType]?.map((sc) => ({ value: sc, label: sc })) || []}
                  value={subcategory}
                  onChange={setSubcategory}
                  size="sm"
                  placeholder="Выберите подкатегорию"
                />
              )}
              <Select
                label="Тип КПП"
                data={getTransmissionOptions()}
                value={transmission}
                onChange={setTransmission}
                size="sm"
                placeholder="Тип коробки"
                description="Механика, автомат, вариатор, робот"
              />
            </Group>

            {/* Search and advanced filters toggle */}
            <Group position="right">
              <TextInput
                label="Поиск по названию/описанию"
                placeholder="Введите название или описание запчасти"
                value={search}
                onChange={setSearch}
                size="sm"
                leftSection={<IconSearch size={16} />}
                clearable
                style={{ width: 250, marginTop: "md" }}
              />
              <Button
                onClick={() => setShowAdvanced(!showAdvanced)}
                color="blue"
                variant="light"
                size="sm"
                leftSection={showAdvanced ? IconX : IconFilter}
              >
                {showAdvanced ? "Скрыть фильтры" : "Расширенные фильтры"}
              </Button>
            </Group>

            {/* Advanced filters (collapsible) */}
            {showAdvanced && (
              <Card withBorder p="md" style={{ borderColor: "#eeeeff", marginTop: "md" }}>
                <Stack gap="sm">
                  <Group justify="space-between">
                    <Title order={4} size="sm">Дополнительные фильтры</Title>
                    <Button
                      variant="subtle"
                      color="blue"
                      size="xs"
                      onClick={resetFilters}
                    >
                      Сбросить все
                    </Button>
                  </Group>

                  <Group grow wrap>
                    <Select
                      label="Состояние"
                      data={[
                        { value: "NEW", label: "Новый" },
                        { value: "LIKE_NEW", label: "Как новый" },
                        { value: "EXCELLENT", label: "Отличное" },
                        { value: "GOOD", label: "Хорошее" },
                        { value: "FAIR", label: "Среднее" },
                        { value: "POOR", label: "Требует ремонта" },
                      ]}
                      value={""}
                      onChange={(e) => {/* TODO: implement */}}
                      size="sm"
                      placeholder="Состояние"
                    />
                    <Select
                      label="Привод"
                      data={DRIVE_TYPES.map((dt) => ({ value: dt.value, label: dt.label }))}
                      value={""}
                      onChange={(e) => {/* TODO: implement */}}
                      size="sm"
                      placeholder="Привод"
                    />
                    <Select
                      label="Топливо"
                      data={FUEL_TYPES.map((ft) => ({ value: ft.value, label: ft.label }))}
                      value={""}
                      onChange={(e) => {/* TODO: implement */}}
                      size="sm"
                      placeholder="Тип топлива"
                    />
                    <Select
                      label="Кузов"
                      data={BODY_TYPES.map((bt) => ({ value: bt.value, label: bt.label }))}
                      value={""}
                      onChange={(e) => {/* TODO: implement */}}
                      size="sm"
                      placeholder="Тип кузова"
                    />
                  </Group>
                </Stack>
              </Card>
            )}

            {/* Action buttons */}
            <Group position="right" wrap>
              <Button
                onClick={resetFilters}
                color="red"
                variant="light"
                size="sm"
              >
                Сбросить фильтры
              </Button>
              <Button
                onClick={() => {/* Trigger search */}}
                color="indigo"
                size="sm"
                leftSection={<IconSearch size={16} />}
                disabled={!partType} // Require at least part type to search
              >
                Найти запчасти
              </Button>
            </Group>
          </Stack>
        </Card>

        {/* View toggle (grid/list) */}
        <Group position="right">
          <Button
            variant={view === "grid" ? "filled" : "light"}
            color="blue"
            size="sm"
            onClick={() => setView("grid")}
            leftSection={<IconGrid size={16} />}
          >
            Сетка
          </Button>
          <Button
            variant={view === "list" ? "filled" : "light"}
            color="blue"
            size="sm"
            onClick={() => setView("list")}
            leftSection={<IconList size={16} />}
          >
            Список
          </Button>
        </Group>

        {/* Loading state */}
        {isLoading && (
          <Center py={80}>
            <MantineLoader color="indigo" size="sm" />
          </Center>
        )}

        {/* Error state */}
        {error && (
          <Center py={80}>
            <Text color="red" size="sm">{error.message}</Text>
          </Center>
        )}

        {/* Results section */}
        {data !== undefined && !isLoading && !error && (
          <Stack gap="md">
            {/* Results summary */}
            {data.listings && (
              <Card withBorder radius="md" p="md" style={{ borderColor: "#c7d2fe", background: "#fafafa" }}>
                <Stack gap="sm">
                  <Group justify="space-between">
                    <Text size="sm" fw={600} c="#18181b">Результаты поиска</Text>
                    <Badge variant="light" color="indigo" size="sm">
                      {data.total || data.listings.length} позиций
                    </Badge>
                  </Group>
                  <Text size="xs" c="#71717a">
                    {make ? `${make}` : "Любая марка"}{model ? ` ${model}` : ""}
                    {yearFrom || yearTo ? `, ${yearFrom || "—"}-${yearTo || "—"} г.` : ""}
                    {partType ? ` → ${PART_TYPES.find((pt) => pt.value === partType)?.label}` : ""}
                    {subcategory ? ` → ${subcategory}` : ""}
                    {transmission ? ` → ${TRANSMISSIONS.find((t) => t.value === transmission)?.label}` : ""}
                    {search ? ` • Поиск: "${search}"` : ""}
                    {city ? ` • ${city}` : ""}
                  </Text>
                  <Divider color="#e4e4e7" />
                </Stack>
              </Card>
            )}

            {/* Results grid/list */}
            {data.listings && data.listings.length > 0 ? (
              <Stack gap="md">
                {view === "grid" ? (
                  <SimpleGrid
                    cols={{ base: 1, sm: 2, lg: 3 }}
                    spacing="md"
                  >
                    {data.listings.map((item, index) => (
                      <Card
                        key={item.id || index}
                        withBorder
                        radius="md"
                        p="md"
                        style={{
                          background: "#fff",
                          border: "1px solid #f0f0f0",
                          boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
                        }}
                      >
                        <Stack gap="xs">
                          {/* Image placeholder */}
                          <div
                            style={{
                              height: 120,
                              background: "#f8f9fa",
                              borderRadius: 8,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center"
                            }}
                          >
                            <Text size="xs" c="#adb5bd">
                              {item.image ? "Фото" : "Нет фото"}
                            </Text>
                          </div>

                          {/* Title */}
                          <Text
                            fw={600}
                            size="sm"
                            c="#212529"
                            lineClamp={2}
                          >
                            {item.title || item.name || "Без названия"}
                          </Text>

                          {/* Details */}
                          <Stack gap="xs">
                            <Text size="xs" c="#6c757d">
                              {item.make ? `${item.make} ` : ""}
                              {item.model ? `${item.model} ` : ""}
                              {item.year ? `${item.year} г. ` : ""}
                            </Text>
                            <Text size="xs" c="#6c757d">
                              {item.price ? `${item.price.toLocaleString()} ��� � � ₽` : "Цена уточняется"}
                            </Text>
                            <Text size="xs" c="#6c757d">
                              {item.city ? `${item.city} • ` : ""}
                              {item.partType ? `${PART_TYPES.find((pt) => pt.value === item.partType)?.label} ` : ""}
                              {item.transmission ? `${TRANSMISSIONS.find((t) => t.value === item.transmission)?.label} ` : ""}
                            </Text>
                          </Stack>

                          {/* Tags */}
                          <Group gap="xs" wrap>
                            {item.isNew && (
                              <Badge variant="light" color="green" size="xs">
                                Новый
                              </Badge>
                            )}
                            {item.isUrgent && (
                              <Badge variant="light" color="red" size="xs">
                                Срочно
                              </Badge>
                            )}
                            {item.transmission === "AUTOMATIC" && (
                              <Badge variant="light" color="blue" size="xs">
                                АКПП
                              </Badge>
                            )}
                            {item.transmission === "MANUAL" && (
                              <Badge variant="light" color="orange" size="xs">
                                МКПП
                              </Badge>
                            )}
                          </Group>

                          {/* Action buttons */}
                          <Group position="right" mt="xs">
                            <Button
                              variant="subtle"
                  color="blue"
                  size="xs"
                            >
                              В избранное
                            </Button>
                            <Button
                              variant="light"
                  color="green"
                  size="xs"
                            >
                              В сравнение
                            </Button>
                          </Group>
                        </Card>
                      ))}
                  </SimpleGrid>
                ) : (
                  {/* List view */}
                  <Stack gap="sm">
                    {data.listings.map((item, index) => (
                      <Card
                        key={item.id || index}
                        withBorder
                        radius="md"
                        p="md"
                        style={{
                          background: "#fff",
                          border: "1px solid #e9ecef"
                        }}
                      >
                        <Group
                          position="center"
                          gap="md"
                          align="center"
                        >
                          {/* Image */}
                          <div
                            style={{
                              width: 80,
                              height: 80,
                              background: "#f8f9fa",
                              borderRadius: 8,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center"
                            }}
                          >
                            <Text size="xs" c="#adb5bd">
                              {item.image ? "Фото" : "Нет фото"}
                            </Text>
                          </div>

                          {/* Info */}
                          <Stack gap="xs" stretch>
                            <Text
                              fw={600}
                              size="sm"
                              c="#212529"
                            >
                              {item.title || item.name || "Без названия"}
                            </Text>
                            <Text size="xs" c="#6c757d">
                              {item.make ? `${item.make} ` : ""}
                              {item.model ? `${item.model} ` : ""}
                              {item.year ? `${item.year} г. ` : ""}
                            </Text>
                            <Group gap="xs" wrap>
                              <Badge
                                variant="light"
                                color={item.transmission === "AUTOMATIC" ? "blue" :
                                       item.transmission === "MANUAL" ? "orange" :
                                       "gray"}
                                size="xs"
                              >
                                {item.transmission ?
                                  TRANSMISSIONS.find((t) => t.value === item.transmission)?.label :
                                  "—"}
                              </Badge>
                              <Badge
                                variant="light"
                                color="green"
                                size="xs"
                              >
                                {item.partType ?
                                  PART_TYPES.find((pt) => pt.value === item.partType)?.label :
                                  "—"}
                              </Badge>
                              {item.city && (
                                <Badge
                                  variant="light"
                                  color="purple"
                                  size="xs"
                                >
                                  {item.city}
                                </Badge>
                              )}
                            </Group>
                            <Text size="xs" c="#6c757d">
                              {item.price ?
                                `${item.price.toLocaleString()} ��� � � ₽` :
                                "Цена уточняется"}
                              {item.city ? ` • ${item.city}` : ""}
                            </Text>
                            <Text size="xs" c="#6c757d" style={{ fontStyle: "italic" }}>
                              {item.description ?
                                item.description.substring(0, 100) +
                                (item.description.length > 100 ? "..." : "") :
                                "Описание отсутствует"}
                            </Text>
                          </Stack>

                          {/* Actions */}
                          <Group position="right" gap="xs">
                            <Button
                              variant="subtle"
                  color="blue"
                  size="xs"
                            >
                              В избранное
                            </Button>
                            <Button
                              variant="light"
                  color="green"
                  size="xs"
                            >
                              В сравнение
                            </Button>
                            <Button
                              component={Link}
                              href={`/listings/part/${item.id}`}
                              variant="filled"
                  color="indigo"
                  size="xs"
                            >
                              Посмотреть
                            </Button>
                          </Group>
                        </Group>
                      </Card>
                    ))}
                  </Stack>
                )}
              </Stack>
            ) : (
              {/* Empty state */}
              <Card withBorder radius="md" p="md" style={{ borderColor: "#f4f4f5", background: "#fafafa" }}>
                <Stack align="center" gap="sm">
                  <IconAdjustmentsHorizontal size={40} stroke={1.5} color="#d4d4d8" />
                  <Text fw={500} size="sm" c="#52525b">Ничего не найдено</Text>
                  <Text size="xs" c="#71717a" maxWidth={400} textAlign="center">
                    Попробуйте изменить фильтры поиска или очистить их и начать заново.
                  </Text>
                  <Button
                    variant="subtle"
                    color="indigo"
                    size="sm"
                    mt="xs"
                  >
                    Сбросить фильтры
                  </Button>
                </Stack>
              </Card>
            )}

            {/* Pagination */}
            {data.total && data.total > limit && (
              <Card withBorder p="md" style={{ borderColor: "#eeeeff", marginTop: "md" }}>
                <Stack gap="sm" align="center">
                  <Text size="xs" c="#6c757d">
                    Страница {page} из {Math.ceil(data.total / limit)}
                  </Text>
                  <Group gap="xs">
                    <Button
                      variant="subtle"
                      color="blue"
                      size="xs"
                      onClick={() => handlePageChange(Math.max(1, page - 1))}
                      disabled={page <= 1}
                    >
                      ← Пред.
                    </Button>
                    <Button
                      variant="subtle"
                      color="blue"
                      size="xs"
                      onClick={() => handlePageChange(page + 1)}
                      disabled={page >= Math.ceil(data.total / limit)}
                    >
                      След. →
                    </Button>
                  </Group>
                </Stack>
              </Card>
            )}
          </Stack>
        )}
      </Stack>
    </Box>
  )
}

// Helper component for center alignment
function Center({ children, ...props }: { children: React.ReactNode } & Record<string, any>) {
  return (
    <Box
      h="100vh"
      display="flex"
      alignItems="center"
      justifyContent="center"
      {...props}
    >
      {children}
    </Box>
  )
}