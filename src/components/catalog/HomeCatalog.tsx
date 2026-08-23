"use client"
export const dynamic = "force-dynamic"
import { useEffect, useMemo, useState } from "react"
import useSWR from "swr"
import { useSession } from "next-auth/react"
import Link from "next/link"
import NextImage from "next/image"
import { ActionIcon, Box, Text, Select, Group, Pagination, Stack, Paper, TextInput, Button, SimpleGrid, Badge, Collapse, Divider, Chip, Loader, SegmentedControl, Tooltip , ThemeIcon} from "@mantine/core"
import { IconLayoutGrid, IconList, IconSearch, IconAdjustmentsHorizontal, IconX, IconChevronDown, IconGasStation, IconManualGearbox, IconCar, IconEngine, IconPalette, IconBolt, IconTruck, IconTractor, IconSpeedboat, IconPlane, IconArrowUpRight, IconSparkles , IconBell} from "@tabler/icons-react"
import ListingCard, { type ListingCardData } from "@/components/listings/ListingCard"
import ListingRow from "@/components/listings/ListingRow"
import { COUNTRY_FLAGS, getBrandsByCategory } from "@/lib/catalog"
import BrandIcon from "@/components/brands/BrandIcon"
import { BODY_TYPES, DRIVE_TYPES, CONDITIONS, SORT_OPTIONS, STEERING_WHEELS, DOCUMENT_STATUSES, DAMAGE_INFO, SELLER_TYPES, AVAILABILITY_TYPES, OWNERS_COUNT_OPTIONS, MOTORCYCLE_TYPES, TRUCK_BODY_TYPES, SPECIAL_TYPES, WATER_TYPES, AIR_TYPES, getFuelOptions, getTransmissionOptions, getUsageMeta, supportsTransmission } from "@/lib/constants"
import { fetchJson } from "@/lib/api-client"
import { CITY_COORDINATES } from "@/lib/cities"
import { SEARCH_RADII_KM } from "@/lib/geo-distance"
import { plural } from "@/lib/format"
import { AsyncErrorState, EmptyState, ResultsGridSkeleton } from "@/components/ui/AsyncStates"
import CategoryShowcase from "./CategoryShowcase"
import SaveSearchButton from "@/components/search/SaveSearchButton"

type HomePageProps = {
  initialQuery?: string
  initialMake?: string
  initialPartType?: string
  initialVehicleType?: string
  initialType?: string
  categorySlug?: string
  pageTitle?: string
  showHero?: boolean
  showHeading?: boolean
}

type Pagination = { total: number; pages: number; limit: number }
type ListingsResponse = { listings: ListingCardData[]; pagination: Pagination }

const fetcher = fetchJson
const CAR_COLORS = ["Белый","Чёрный","Серебристый","Серый","Синий","Красный","Зелёный","Коричневый","Бордовый","Золотистый","Жёлтый","Оранжевый"]
const BRAND_CATEGORY_BY_VEHICLE_TYPE: Record<string, "cars" | "moto" | "trucks" | "special" | "water" | "air"> = {
  CAR: "cars", MOTORCYCLE: "moto", TRUCK: "trucks", SPECIAL: "special", WATER: "water", AIR: "air",
}

const ALL_CITY_NAMES = Object.keys(CITY_COORDINATES).sort((a, b) => a.localeCompare(b, "ru"))

export default function HomePage(p: HomePageProps = {}) {
  const [query, setQuery] = useState(p.initialQuery || "")
  const [page, setPage] = useState(1)
  const [view, setView] = useState("grid")
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [make, setMake] = useState<string | null>(p.initialMake || null)
  const [model, setModel] = useState<string | null>(null)
  const [sort, setSort] = useState("newest")
  const [priceFrom, setPriceFrom] = useState("")
  const [priceTo, setPriceTo] = useState("")
  const [yearFrom, setYearFrom] = useState<string | null>(null)
  const [yearTo, setYearTo] = useState<string | null>(null)
  const [city, setCity] = useState<string | null>(null)
  const [radius, setRadius] = useState<string | null>(null)
  const [mileageTo, setMileageTo] = useState("")
  const [transmission, setTransmission] = useState<string | null>(null)
  const [fuelType, setFuelType] = useState<string[]>([])
  const [driveType, setDriveType] = useState<string | null>(null)
  const [bodyType, setBodyType] = useState<string[]>([])
  const [subtype, setSubtype] = useState<string[]>([])
  const [engineVolumeFrom, setEngineVolumeFrom] = useState("")
  const [engineVolumeTo, setEngineVolumeTo] = useState("")
  const [powerFrom, setPowerFrom] = useState("")
  const [powerTo, setPowerTo] = useState("")
  const [color, setColor] = useState<string | null>(null)
  const [condition, setCondition] = useState<string[]>([])
  const [steeringWheel, setSteeringWheel] = useState<string | null>(null)
  const [documentsStatus, setDocumentsStatus] = useState<string | null>(null)
  const [damageInfo, setDamageInfo] = useState<string | null>(null)
  const [sellerType, setSellerType] = useState<string | null>(null)
  const [availability, setAvailability] = useState<string | null>(null)
  const [customsCleared, setCustomsCleared] = useState<boolean | null>(null)
  const [ownersCountFrom, setOwnersCountFrom] = useState("")
  const [ownersCountTo, setOwnersCountTo] = useState("")
  const [mileageFrom, setMileageFrom] = useState("")
  const [keywords, setKeywords] = useState("")
  const hasInvalidPriceRange = Boolean(priceFrom && priceTo && Number(priceFrom) > Number(priceTo))
  const isPartSearch = p.initialType === "part"
  const vt = p.initialVehicleType || "CAR"
  const brandCategory = BRAND_CATEGORY_BY_VEHICLE_TYPE[vt] || "cars"
  const usageMeta = getUsageMeta(vt)
  const transmissionOptions = getTransmissionOptions(vt)
  const fuelOptions = getFuelOptions(vt)

  const brands = useMemo(() => getBrandsByCategory(brandCategory), [brandCategory])
  const brandOptions = brands.map((brand) => ({ value: brand.name, label: brand.name }))
  const brandByName = useMemo(() => new Map(brands.map((brand) => [brand.name, brand])), [brands])
  const modelRequest = make ? `/api/v1/models?brand_id=${encodeURIComponent(make)}&category=${brandCategory}` : null
  const { data: modelsData, error: modelsError, isLoading: isModelsLoading } = useSWR<{ models?: string[] }>(modelRequest, fetcher)
  const modelOptions = (modelsData?.models || []).map((value) => ({ value, label: value }))
  const { data: stats } = useSWR<{ auctions?: number; auctionByCountry?: Record<string, number> }>("/api/stats", fetcher)
  const auctionStats = stats || { auctions: 0, auctionByCountry: {} }

  const newestModelYear = new Date().getFullYear() + 1
  const yearData = Array.from({ length: 60 }, (_, index) => {
    const year = newestModelYear - index
    return { value: String(year), label: String(year) }
  })

  const buildQuery = () => {
    const q = new URLSearchParams()
    q.set("type", p.initialType || "vehicle")
    if (p.initialPartType) q.set("partType", p.initialPartType)
    if (p.initialVehicleType) q.set("vehicleType", p.initialVehicleType)
    q.set("page", String(page))
    q.set("limit", "20")
    q.set("sort", sort)
    if(query) q.set("q", query)
    if(make) q.set("make", make)
    if(model) q.set("model", model)
    if(city) q.set("city", city)
    if (city && radius) q.set("radius", radius)
    if(priceFrom) q.set("priceFrom", priceFrom)
    if(priceTo) q.set("priceTo", priceTo)
    if(yearFrom) q.set("yearFrom", yearFrom)
    if(yearTo) q.set("yearTo", yearTo)
    if(mileageTo) q.set(`${usageMeta.field}To`, mileageTo)
    if(transmission) q.set("transmission", transmission)
    if(fuelType.length) q.set("fuelType", fuelType.join(","))
    if(driveType) q.set("driveType", driveType)
    if(bodyType.length) q.set("bodyType", bodyType.join(","))
    if(subtype.length) q.set("subtype", subtype.join(","))
    if(engineVolumeFrom) q.set("engineVolumeFrom", engineVolumeFrom)
    if(engineVolumeTo) q.set("engineVolumeTo", engineVolumeTo)
    if(powerFrom) q.set("powerFrom", powerFrom)
    if(powerTo) q.set("powerTo", powerTo)
    if(color) q.set("color", color)
    if(condition.length) q.set("condition", condition.join(","))
    if(steeringWheel) q.set("steeringWheel", steeringWheel)
    if(documentsStatus) q.set("documentsStatus", documentsStatus)
    if(damageInfo) q.set("damageInfo", damageInfo)
    if(sellerType) q.set("sellerType", sellerType)
    if(availability) q.set("availability", availability)
    if(customsCleared !== null) q.set("customsCleared", String(customsCleared))
    if(ownersCountFrom) q.set("ownersCountFrom", ownersCountFrom)
    if(ownersCountTo) q.set("ownersCountTo", ownersCountTo)
    if(mileageFrom) q.set(`${usageMeta.field}From`, mileageFrom)
    if(keywords) q.set("keywords", keywords)
    return q.toString()
  }

  /* Чтение фильтров из адреса: заход по ссылке и кнопка «Назад».

     Без этого адрес писался бы, но не читался: человек открывает присланную
     ссылку с фильтром и видит весь каталог, а «Назад» меняет строку в
     адресе, не меняя выдачу. */
  const [historyTick, setHistoryTick] = useState(0)
  /* Пока адрес не прочитан, писать его нельзя: чтение и запись срабатывают
     в одном проходе и обе видят ещё пустое состояние. Запись собирала бы
     адрес из пустоты и стирала то, с чем человек пришёл по ссылке. */
  const [urlRead, setUrlRead] = useState(false)

  useEffect(() => {
    const onPopState = () => setHistoryTick((value) => value + 1)
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    // Марку из свойств компонента не перетираем: на странице категории она
    // задана самим разделом, а не выбором человека.
    if (!p.initialMake) setMake(params.get("make") || null)
    /* Поисковый запрос читается из адреса наравне с фильтрами.

       Без этого страница /search?q=Nissan показывала весь каталог после
       обновления, а «Назад» с неё возвращал пустое поле поиска: запрос
       жил только в состоянии и терялся при любой перезагрузке. */
    setQuery(params.get("q") || p.initialQuery || "")
    setModel(params.get("model") || null)
    setPriceFrom(params.get("priceFrom") || "")
    setPriceTo(params.get("priceTo") || "")
    setYearFrom(params.get("yearFrom") || null)
    setYearTo(params.get("yearTo") || null)
    setCity(params.get("city") || null)
    setRadius(params.get("radius") || null)
    setSort(params.get("sort") || "newest")
    const requestedPage = Number.parseInt(params.get("page") || "1", 10)
    setPage(Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1)
    setUrlRead(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyTick])

  /* Главные фильтры живут в адресе страницы.

     Замер показал: выбранная цена сужала выдачу с шести объявлений до трёх,
     но после обновления страницы фильтр слетал, а ссылку на такую выдачу
     отправить было нельзя — адрес оставался прежним.

     В адрес идут только те условия, по которым реально ищут и делятся:
     марка, модель, цена, год, город, сортировка и страница. Складывать туда
     все два десятка полей значило бы получить нечитаемую строку. */
  useEffect(() => {
    if (typeof window === "undefined") return
    /* Параметры, которыми владеет сама страница, а не панель фильтров:
       вид объявлений, тип транспорта, раздел запчастей. Раньше адрес
       собирался с нуля, и они стирались — /search?q=Nissan&type=part
       превращался в /search, а вместе с ними уходил и сам запрос. */
    if (!urlRead) return
    const current = new URLSearchParams(window.location.search)
    const next = new URLSearchParams()
    for (const key of ["type", "vehicleType", "partType"]) {
      const value = current.get(key)
      if (value) next.set(key, value)
    }
    if (query) next.set("q", query)
    if (make) next.set("make", make)
    if (model) next.set("model", model)
    if (priceFrom) next.set("priceFrom", priceFrom)
    if (priceTo) next.set("priceTo", priceTo)
    if (yearFrom) next.set("yearFrom", yearFrom)
    if (yearTo) next.set("yearTo", yearTo)
    if (city) next.set("city", city)
    if (city && radius) next.set("radius", radius)
    if (sort && sort !== "newest") next.set("sort", sort)
    if (page > 1) next.set("page", String(page))

    const nextQuery = next.toString()
    const currentQuery = window.location.search.replace(/^\?/, "")
    if (nextQuery === currentQuery) return

    const target = nextQuery ? `?${nextQuery}` : window.location.pathname
    // Смена страницы кладётся в историю: её листают осознанно и ждут, что
    // «Назад» вернёт к предыдущей. Правка фильтра — нет, иначе уйти со
    // страницы можно будет только десятком нажатий «Назад».
    const currentPage = Number.parseInt(new URLSearchParams(currentQuery).get("page") || "1", 10)
    if (page !== currentPage) window.history.pushState(null, "", target)
    else window.history.replaceState(null, "", target)
  }, [urlRead, query, make, model, priceFrom, priceTo, yearFrom, yearTo, city, radius, sort, page])

  const { data, error, isLoading, mutate } = useSWR<ListingsResponse>(hasInvalidPriceRange ? null : "/api/listings?" + buildQuery(), fetcher)

  const resetFilters = () => {
    setMake(null); setModel(null); setPriceFrom(""); setPriceTo("")
    setYearFrom(null); setYearTo(null); setCity(null); setRadius(null); setMileageTo("")
    setTransmission(null); setFuelType([]); setDriveType(null); setBodyType([]); setSubtype([])
    setEngineVolumeFrom(""); setEngineVolumeTo(""); setPowerFrom(""); setPowerTo("")
    setColor(null); setCondition([])
    setSteeringWheel(null); setDocumentsStatus(null); setDamageInfo(null)
    setSellerType(null); setAvailability(null); setCustomsCleared(null)
    setOwnersCountFrom(""); setOwnersCountTo(""); setMileageFrom("")
    setKeywords("")
    setQuery(""); setPage(1)
  }

  const clearSelectedMake = () => {
    setMake(null)
    setModel(null)
  }

  const activeFilterCount = (make?1:0)+(model?1:0)+(priceFrom?1:0)+(priceTo?1:0)+(yearFrom?1:0)+(yearTo?1:0)+(city?1:0)+(mileageTo?1:0)+(transmission?1:0)+(fuelType.length?1:0)+(driveType?1:0)+(bodyType.length?1:0)+(subtype.length?1:0)+(engineVolumeFrom?1:0)+(engineVolumeTo?1:0)+(powerFrom?1:0)+(powerTo?1:0)+(color?1:0)+(condition.length?1:0)+(steeringWheel?1:0)+(documentsStatus?1:0)+(damageInfo?1:0)+(sellerType?1:0)+(availability?1:0)+(customsCleared!==null?1:0)+(ownersCountFrom?1:0)+(ownersCountTo?1:0)+(mileageFrom?1:0)+(keywords?1:0)
  const filterKey = useMemo(() => [
    p.initialType, p.initialPartType, p.initialVehicleType, query, make, model, sort, priceFrom, priceTo,
    yearFrom, yearTo, city, mileageTo, transmission, fuelType.join(","), driveType,
    bodyType.join(","), subtype.join(","), engineVolumeFrom, engineVolumeTo, powerFrom, powerTo, color,
    condition.join(","), steeringWheel, documentsStatus, damageInfo, sellerType,
    availability, customsCleared, ownersCountFrom, ownersCountTo, mileageFrom, keywords,
  ].join("|"), [p.initialType, p.initialPartType, p.initialVehicleType, query, make, model, sort, priceFrom, priceTo, yearFrom, yearTo, city, mileageTo, transmission, fuelType, driveType, bodyType, subtype, engineVolumeFrom, engineVolumeTo, powerFrom, powerTo, color, condition, steeringWheel, documentsStatus, damageInfo, sellerType, availability, customsCleared, ownersCountFrom, ownersCountTo, mileageFrom, keywords])

  useEffect(() => {
    setPage(1)
  }, [filterKey])

  /* Вошедшему первый экран не нужен.

     Витрина с обещаниями «от первого поиска до сделки» обращена к тому,
     кто решает, оставаться ли на площадке. Человек, который уже вошёл,
     это решение принял: ему нужны машины, а не приглашение. На других
     площадках вход тоже открывает ленту, а не рекламу.

     Плитки направлений остаются — по ним ориентируются и постоянные
     посетители, — но встают сразу, без полноэкранной витрины над ними. */
  const { status: sessionStatus } = useSession()
  const isReturning = sessionStatus === "authenticated"

  return (
    <Box p={{base:"sm",md:"md"}}><Stack gap="md">
      {p.showHero !== false && !p.categorySlug && !isReturning && (
        <Paper className="home-auctions home-auctions--market" radius="xl" p={{base:"lg",md:"xl"}}>
          <NextImage src="/images/home/automarket-hero.png" alt="LeWheel — транспорт, запчасти и международные аукционы" fill priority sizes="(max-width: 768px) 100vw, 1200px" className="home-auctions__image" />
          <Box className="home-auctions__scrim" />
          <Box className="home-auctions__content">
            <Group justify="space-between" align="flex-start" wrap="wrap" gap="lg">
              <Box maw={650}>
                {/* Надпись-плашка над заголовком убрана: она повторяла то, что
                    заголовок и так говорит, и отодвигала его вниз. */}
                <Text component="h1" data-lw-hero fw={800} fz={{base:28,md:42}} c="white" ff="var(--font-display),sans-serif" lh={1.08}>Найдите свой маршрут: транспорт, запчасти и аукционы.</Text>
                <Text size="sm" c="rgba(255,255,255,0.84)" mt={12} maw={560}>От первого поиска до сделки и доставки — всё понятно, в одном кабинете и без лишних шагов.</Text>
                {/* Кнопки стояли к тексту почти вплотную и читались его
                    продолжением. Отступ над группой теперь заметно больше, чем
                    внутри неё, поэтому действие отделено от описания. */}
                {/* Поиск на первом экране, а не в панели фильтров ниже.

                    Замер на телефоне: поле поиска лежало на 732 пикселях
                    при экране 844 — почти за сгибом. Человек приходит
                    искать машину и должен видеть, куда вводить, сразу.

                    Поле общее с каталогом: набранное здесь сразу сужает
                    выдачу ниже, а кнопка ведёт к результатам.

                    Под полем показано, сколько нашлось: выдача обновляется
                    внизу страницы, вне поля зрения, и без этой строки
                    человек не знал бы, дал ли его запрос результат. */}
                <Group gap="xs" mt={24} wrap="nowrap" className="home-hero__search">
                  <TextInput
                    className="home-hero__search-input"
                    placeholder="Марка, модель или ключевое слово"
                    aria-label="Поиск по объявлениям"
                    leftSection={<IconSearch size={16} />}
                    value={query}
                    onChange={(event) => setQuery(event.currentTarget.value)}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") return
                      document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth", block: "start" })
                    }}
                    size="md"
                  />
                  <Button
                    component={Link}
                    href="#catalog"
                    size="md"
                    radius="md"
                    className="home-auctions__cta"
                    aria-label="Показать объявления"
                  >
                    Найти
                  </Button>
                </Group>

                {query.trim().length > 1 && (
                  <Text size="xs" c="rgba(255,255,255,0.9)" mt={8}>
                    {isLoading
                      ? "Ищем…"
                      : (data?.pagination?.total ?? 0) > 0
                      ? `Нашлось ${data?.pagination?.total} ${plural(data?.pagination?.total ?? 0, "объявление", "объявления", "объявлений")} — смотрите ниже`
                      : "Ничего не нашлось. Попробуйте другое название или проверьте раскладку"}
                  </Text>
                )}

                <Group gap="sm" mt={16} wrap="wrap">
                  {/* Кнопка каталога ушла в поиск выше — здесь остались
                      второстепенные пути: аукционы для тех, кто ищет
                      машину из-за границы. */}
                  <Button component={Link} href="/auctions" variant="white" color="dark" size="md" radius="md" leftSection={<IconSparkles size={16} />}>Мировые аукционы</Button>
                  <Button component={Link} href="#catalog" variant="subtle" color="gray.0" size="md" radius="md" rightSection={<IconArrowUpRight size={16} />}>Весь каталог</Button>
                </Group>
              </Box>
              <Box className="home-auctions__summary">
                <Text size="xs" c="rgba(255,255,255,0.68)" tt="uppercase" fw={700}>Маршрут сделки</Text>
                <Stack gap={0} mt="sm" className="home-auctions__journey">
                  {[
                    ["Выбор и проверка", "Каталог, фото и история лота"],
                    ["Договорённость", "Прозрачные условия с продавцом"],
                    [
                      "Доставка под контролем",
                      auctionStats.auctions
                        ? `${auctionStats.auctions} актуальных импортных лотов`
                        : "Каталог зарубежных площадок",
                    ],
                  ].map(([title, description], index) => (
                    <Group key={title} gap="sm" wrap="nowrap" align="flex-start" className="home-auctions__journey-step">
                      <Box className="home-auctions__journey-mark">{index + 1}</Box>
                      <Box>
                        <Text size="sm" c="white" fw={700} lh={1.25}>{title}</Text>
                        <Text size="xs" c="rgba(255,255,255,0.7)" mt={2} lh={1.3}>{description}</Text>
                      </Box>
                    </Group>
                  ))}
                </Stack>
              </Box>
            </Group>
          </Box>
        </Paper>
      )}

      {/* Витрина направлений — только на главной: внутри категории человек
          уже выбрал, куда идёт, и повторное меню там мешало бы. */}
      {/* Поиск для вошедшего — там, где у гостя витрина.

          Поле поиска жило внутри первого экрана, а вошедшему тот экран не
          показывается. Здесь оно встаёт первым, над плитками направлений:
          человек, который уже на площадке, начинает с поиска машины. */}
      {p.showHero !== false && !p.categorySlug && isReturning && (
        <Group gap="xs" wrap="nowrap" className="home-returning-search">
          <TextInput
            className="home-returning-search__input"
            placeholder="Марка, модель или ключевое слово"
            aria-label="Поиск по объявлениям"
            leftSection={<IconSearch size={17} />}
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            size="md"
          />
          <Button
            component={Link}
            href="#catalog"
            size="md"
            radius="md"
            color="indigo"
            aria-label="Показать объявления"
          >
            Найти
          </Button>
        </Group>
      )}

      {p.showHero !== false && !p.categorySlug && <CategoryShowcase />}

      <Group id="catalog" justify="space-between" align="center" className="catalog-heading">
        <Stack gap={0}>
          {p.showHeading !== false && <Text component={p.categorySlug ? "h1" : "h2"} fw={800} fz={{base:20,md:24}} c="var(--market-ink)">{p.pageTitle || "Все объявления"}</Text>}
          {data && <Text size="xs" c="gray.5" aria-live="polite">{data.pagination?.total || 0} {plural(data.pagination?.total || 0, "объявление", "объявления", "объявлений")}</Text>}
        </Stack>
        <Group gap="xs" wrap="nowrap">
          <Select
            className="catalog-sort-control"
            aria-label="Сортировка объявлений"
            data={SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            value={sort}
            onChange={(v) => setSort(v || "newest")}
            size="xs"
            w={160}
          />
          <Group className="catalog-view-switch" gap={2} role="group" aria-label="Вид объявлений">
            <Tooltip label="Плитка" withArrow>
              <ActionIcon variant={view === "grid" ? "light" : "subtle"} color="indigo" size="md" radius="md" onClick={() => setView("grid")} aria-label="Показать объявления плиткой" aria-pressed={view === "grid"}>
                <IconLayoutGrid size={17} stroke={1.8} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Список" withArrow>
              <ActionIcon variant={view === "list" ? "light" : "subtle"} color="indigo" size="md" radius="md" onClick={() => setView("list")} aria-label="Показать объявления списком" aria-pressed={view === "list"}>
                <IconList size={17} stroke={1.8} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
      </Group>

      <Paper className="catalog-filter-panel" data-expanded={showAdvanced || undefined} radius="md" p="md" withBorder>
        <Stack gap="sm">
          <Group className="catalog-filter-panel__intro" justify="space-between" align="baseline" gap="sm">
            <Box>
              <Text size="sm" fw={750}>{isPartSearch ? "Найдите нужную запчасть" : "Найдите подходящий транспорт"}</Text>
              <Text size="xs" c="dimmed">{isPartSearch ? "Ищите по названию, OEM-номеру, марке автомобиля или цене." : "Начните с марки, цены или города — остальное уточните при необходимости."}</Text>
            </Box>
            {activeFilterCount > 0 && <Badge color="indigo" variant="light" radius="xl">Выбрано: {activeFilterCount}</Badge>}
          </Group>
          <Box className="catalog-filter-grid">
            <TextInput className="catalog-filter-field catalog-filter-field--search" label="Что ищете" placeholder={isPartSearch ? "Название, OEM или ключевое слово" : "Марка, модель, ключевое слово"} leftSection={<IconSearch size={14}/>} value={query} onChange={(e) => setQuery(e.target.value)} size="sm" />
            <Select
              className="catalog-filter-field catalog-filter-field--make"
              label={isPartSearch ? "Марка автомобиля" : "Марка"}
              placeholder="Любая"
              data={brandOptions}
              searchable
              clearable
              value={make}
              onChange={(value) => { setMake(value); setModel(null) }}
              leftSection={make ? <BrandIcon brand={make} size={20} variant="rounded" /> : <IconCar size={15} />}
              rightSection={make ? (
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size="sm"
                  radius="xl"
                  aria-label="Очистить выбранную марку"
                  onMouseDown={(event) => { event.preventDefault(); event.stopPropagation() }}
                  onClick={(event) => { event.preventDefault(); event.stopPropagation(); clearSelectedMake() }}
                >
                  <IconX size={14} stroke={2.2} />
                </ActionIcon>
              ) : undefined}
              rightSectionWidth={make ? 38 : undefined}
              renderOption={({ option }) => {
                const brand = brandByName.get(option.value)
                return (
                  <Group gap="xs" wrap="nowrap">
                    <BrandIcon brand={option.value} size={24} variant="rounded" />
                    <Text size="sm" fw={650}>{option.label}</Text>
                    {brand && <Text size="xs" c="dimmed" ml="auto" aria-label={`Страна марки: ${brand.country}`}>{COUNTRY_FLAGS[brand.country]}</Text>}
                  </Group>
                )
              }}
              styles={{
                input: { paddingLeft: 34, paddingRight: make ? 38 : undefined },
                section: { pointerEvents: make ? "auto" : undefined },
              }}
              size="sm"
            />
            <Select
              className="catalog-filter-field catalog-filter-field--model"
              label="Модель"
              placeholder={make ? (isModelsLoading ? "Загружаем модели" : "Любая") : "Сначала марка"}
              data={modelOptions}
              searchable
              clearable
              disabled={!make || isModelsLoading}
              rightSection={isModelsLoading ? <Loader size={14} aria-label="Загрузка моделей" /> : undefined}
              error={modelsError ? "Не удалось загрузить модели" : undefined}
              value={model}
              onChange={setModel}
              size="sm"
            />
            <Box className="catalog-filter-field catalog-filter-field--price catalog-price-range">
              <Text size="10px" c="dimmed" fw={800} tt="uppercase">Цена, ₽</Text>
              <Group gap={4} wrap="nowrap">
                <TextInput aria-label="Цена от" placeholder="От" value={priceFrom} onChange={(e) => setPriceFrom(e.target.value)} size="sm" type="number" error={hasInvalidPriceRange} />
                <TextInput aria-label="Цена до" placeholder="До" value={priceTo} onChange={(e) => setPriceTo(e.target.value)} size="sm" type="number" error={hasInvalidPriceRange} />
              </Group>
            </Box>
            {/* Города берутся из полного справочника: в коротком списке
                популярных не было малых городов, и житель такого города не
                мог отфильтровать выдачу по своему месту вовсе. */}
            <Select className="catalog-filter-field catalog-filter-field--city" label="Город" placeholder="Все города" data={ALL_CITY_NAMES} searchable clearable value={city} onChange={(value) => { setCity(value); if (!value) setRadius(null) }} size="sm" />
            {/* Радиус показывается только при выбранном городе: без точки
                отсчёта он ничего не значит. За хорошей машиной люди ездят в
                соседний город, и на крупных площадках это привычный фильтр. */}
            {city && (
              <Select
                className="catalog-filter-field catalog-filter-field--radius"
                label="Искать вокруг"
                placeholder="Только в городе"
                data={SEARCH_RADII_KM.map((value) => ({ value: String(value), label: `+${value} км` }))}
                clearable
                value={radius}
                onChange={setRadius}
                size="sm"
              />
            )}
          </Box>

          {hasInvalidPriceRange && <Text size="xs" c="red">Цена «от» не может быть выше цены «до».</Text>}

          {!isPartSearch && <Group justify="space-between" align="center">
            <Button
              variant={showAdvanced ? "filled" : "light"}
              color="indigo"
              size="sm"
              radius="md"
              onClick={() => setShowAdvanced((s) => !s)}
              aria-expanded={showAdvanced}
              aria-controls="catalog-advanced-filters"
              leftSection={<IconAdjustmentsHorizontal size={16} />}
              rightSection={
                <Group gap={6}>
                  {activeFilterCount > 0 && <Badge size="xs" circle color={showAdvanced ? "dark" : "indigo"} variant="filled" style={{ minWidth: 20, height: 20 }}>{activeFilterCount}</Badge>}
                  <IconChevronDown size={14} style={{ transform: showAdvanced ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
                </Group>
              }
              styles={{ root: { fontWeight: 600 } }}
            >
              {/* На телефоне за кнопкой прячутся и обычные поля тоже, поэтому
                  «расширенные» вводило бы в заблуждение. */}
              Фильтры
            </Button>
            {activeFilterCount > 0 && <Button variant="subtle" size="xs" color="gray" leftSection={<IconX size={14}/>} onClick={resetFilters}>Сбросить фильтры</Button>}
          </Group>}

          {!isPartSearch && <Collapse in={showAdvanced} id="catalog-advanced-filters">
            <Divider my="xs"/>
            <Stack gap="md" className="catalog-filter-advanced">
              <Box className="catalog-advanced-usage">
                <Text size="xs" fw={600} c="gray.6" mb={6}>Год и {usageMeta.label.toLowerCase()}</Text>
                <Group gap="xs" align="flex-end" wrap="wrap">
                  <Select aria-label="Год от" placeholder="Год от" data={yearData} searchable clearable value={yearFrom} onChange={setYearFrom} size="sm" w={118} />
                  <Select aria-label="Год до" placeholder="Год до" data={yearData} searchable clearable value={yearTo} onChange={setYearTo} size="sm" w={118} />
                  <TextInput aria-label={`${usageMeta.label}, от ${usageMeta.unit}`} placeholder={`${usageMeta.label}, от`} value={mileageFrom} onChange={(e) => setMileageFrom(e.target.value)} size="sm" w={130} type="number" />
                  <TextInput aria-label={`${usageMeta.label}, до ${usageMeta.unit}`} placeholder={`${usageMeta.label}, до`} value={mileageTo} onChange={(e) => setMileageTo(e.target.value)} size="sm" w={130} type="number" />
                </Group>
              </Box>
              {supportsTransmission(vt) && (
              <Group gap="lg" wrap="wrap" align="flex-start">
                <Box>
                  <Text size="xs" fw={600} c="gray.6" mb={6} style={{display:"flex",alignItems:"center",gap:6}}><IconManualGearbox size={14}/> Коробка передач</Text>
                  <Group gap={6}>{transmissionOptions.map((t) => (
                    <Chip key={t.value} checked={transmission === t.value} onChange={() => setTransmission(transmission === t.value ? null : t.value)} variant={transmission === t.value ? "filled" : "outline"} color="indigo">{t.label}</Chip>
                  ))}</Group>
                </Box>
                {vt === "CAR" && (
                  <Box>
                    <Text size="xs" fw={600} c="gray.6" mb={6}>Привод</Text>
                    <Group gap={6}>{DRIVE_TYPES.map((d) => (
                      <Chip key={d.value} checked={driveType === d.value} onChange={() => setDriveType(driveType === d.value ? null : d.value)} variant={driveType === d.value ? "filled" : "outline"} color="indigo" size="md" radius="xl">{d.label}</Chip>
                    ))}</Group>
                  </Box>
                )}
              </Group>
              )}

              <Box>
                <Text size="xs" fw={600} c="gray.6" mb={6} style={{display:"flex",alignItems:"center",gap:6}}><IconGasStation size={14}/> Тип топлива</Text>
                <Group gap={6}>{fuelOptions.map((f) => (
                  <Chip key={f.value} checked={fuelType.includes(f.value)} onChange={(c) => { setFuelType(c ? [...fuelType, f.value] : fuelType.filter((v) => v !== f.value)); setPage(1) }} variant={fuelType.includes(f.value) ? "filled" : "outline"} color="indigo" size="md" radius="xl">{f.label}</Chip>
                ))}</Group>
              </Box>

              {/* Подтип по категории */}
              {vt === "CAR" && (
              <Box>
                <Text size="xs" fw={600} c="gray.6" mb={6} style={{display:"flex",alignItems:"center",gap:6}}><IconCar size={14}/> Тип кузова</Text>
                <Group gap={6}>{BODY_TYPES.map((b) => (
                  <Chip key={b.value} checked={bodyType.includes(b.value)} onChange={(c) => { setBodyType(c ? [...bodyType, b.value] : bodyType.filter((v) => v !== b.value)); setPage(1) }} variant={bodyType.includes(b.value) ? "filled" : "outline"} color="indigo" size="md" radius="xl">{b.label}</Chip>
                ))}</Group>
              </Box>
              )}
              {vt === "MOTORCYCLE" && (
              <Box>
                <Text size="xs" fw={600} c="gray.6" mb={6} style={{display:"flex",alignItems:"center",gap:6}}><IconCar size={14}/> Тип мотоцикла</Text>
                <Group gap={6}>{MOTORCYCLE_TYPES.map((b) => (
                  <Chip key={b.value} checked={subtype.includes(b.value)} onChange={(c) => { setSubtype(c ? [...subtype, b.value] : subtype.filter((v) => v !== b.value)); setPage(1) }} variant={subtype.includes(b.value) ? "filled" : "outline"} color="indigo" size="md" radius="xl">{b.label}</Chip>
                ))}</Group>
              </Box>
              )}
              {vt === "TRUCK" && (
              <Box>
                <Text size="xs" fw={600} c="gray.6" mb={6} style={{display:"flex",alignItems:"center",gap:6}}><IconTruck size={14}/> Тип кузова / надстройки</Text>
                <Group gap={6}>{TRUCK_BODY_TYPES.map((b) => (
                  <Chip key={b.value} checked={subtype.includes(b.value)} onChange={(c) => { setSubtype(c ? [...subtype, b.value] : subtype.filter((v) => v !== b.value)); setPage(1) }} variant={subtype.includes(b.value) ? "filled" : "outline"} color="indigo" size="md" radius="xl">{b.label}</Chip>
                ))}</Group>
              </Box>
              )}
              {vt === "SPECIAL" && (
              <Box>
                <Text size="xs" fw={600} c="gray.6" mb={6} style={{display:"flex",alignItems:"center",gap:6}}><IconTractor size={14}/> Тип спецтехники</Text>
                <Group gap={6}>{SPECIAL_TYPES.map((b) => (
                  <Chip key={b.value} checked={subtype.includes(b.value)} onChange={(c) => { setSubtype(c ? [...subtype, b.value] : subtype.filter((v) => v !== b.value)); setPage(1) }} variant={subtype.includes(b.value) ? "filled" : "outline"} color="indigo" size="md" radius="xl">{b.label}</Chip>
                ))}</Group>
              </Box>
              )}
              {vt === "WATER" && (
              <Box>
                <Text size="xs" fw={600} c="gray.6" mb={6} style={{display:"flex",alignItems:"center",gap:6}}><IconSpeedboat size={14}/> Тип судна</Text>
                <Group gap={6}>{WATER_TYPES.map((b) => (
                  <Chip key={b.value} checked={subtype.includes(b.value)} onChange={(c) => { setSubtype(c ? [...subtype, b.value] : subtype.filter((v) => v !== b.value)); setPage(1) }} variant={subtype.includes(b.value) ? "filled" : "outline"} color="indigo" size="md" radius="xl">{b.label}</Chip>
                ))}</Group>
              </Box>
              )}
              {vt === "AIR" && (
              <Box>
                <Text size="xs" fw={600} c="gray.6" mb={6} style={{display:"flex",alignItems:"center",gap:6}}><IconPlane size={14}/> Тип воздушного судна</Text>
                <Group gap={6}>{AIR_TYPES.map((b) => (
                  <Chip key={b.value} checked={subtype.includes(b.value)} onChange={(c) => { setSubtype(c ? [...subtype, b.value] : subtype.filter((v) => v !== b.value)); setPage(1) }} variant={subtype.includes(b.value) ? "filled" : "outline"} color="indigo" size="md" radius="xl">{b.label}</Chip>
                ))}</Group>
              </Box>
              )}

              <Group gap="lg" wrap="wrap" align="flex-start">
                <Box>
                  <Text size="xs" fw={600} c="gray.6" mb={6} style={{display:"flex",alignItems:"center",gap:6}}><IconEngine size={14}/> Объём двигателя, л</Text>
                  <Group gap="xs" align="flex-end">
                    <TextInput placeholder="от" value={engineVolumeFrom} onChange={(e) => setEngineVolumeFrom(e.target.value)} size="sm" w={80} type="number" step="0.1"/>
                    <TextInput placeholder="до" value={engineVolumeTo} onChange={(e) => setEngineVolumeTo(e.target.value)} size="sm" w={80} type="number" step="0.1"/>
                  </Group>
                </Box>
                <Box>
                  <Text size="xs" fw={600} c="gray.6" mb={6} style={{display:"flex",alignItems:"center",gap:6}}><IconBolt size={14}/> Мощность, л.с.</Text>
                  <Group gap="xs" align="flex-end">
                    <TextInput placeholder="от" value={powerFrom} onChange={(e) => setPowerFrom(e.target.value)} size="sm" w={80} type="number"/>
                    <TextInput placeholder="до" value={powerTo} onChange={(e) => setPowerTo(e.target.value)} size="sm" w={80} type="number"/>
                  </Group>
                </Box>
              </Group>

              <Group gap="lg" wrap="wrap" align="flex-start">
                <Box>
                  <Text size="xs" fw={600} c="gray.6" mb={6} style={{display:"flex",alignItems:"center",gap:6}}><IconPalette size={14}/> Цвет</Text>
                  <Select placeholder="Любой" data={CAR_COLORS.map((c) => ({value:c,label:c}))} clearable searchable value={color} onChange={setColor} size="sm" w={160}/>
                </Box>
                <Box>
                  <Text size="xs" fw={600} c="gray.6" mb={6}>Состояние</Text>
                  <Group gap={6}>{CONDITIONS.map((c) => (
                    <Chip key={c.value} checked={condition.includes(c.value)} onChange={(ch) => { setCondition(ch ? [...condition, c.value] : condition.filter((v) => v !== c.value)); setPage(1) }} variant={condition.includes(c.value) ? "filled" : "outline"} color="indigo" size="md" radius="xl">{c.label}</Chip>
                  ))}</Group>
                </Box>
              </Group>

              {(vt === "CAR" || vt === "TRUCK") && (
              <Group gap="lg" wrap="wrap" align="flex-start">
                <Box>
                  <Text size="xs" fw={600} c="gray.6" mb={6}>Руль</Text>
                  <Group gap={6}>{STEERING_WHEELS.map((sw) => (
                    <Chip key={sw.value} checked={steeringWheel === sw.value} onChange={() => setSteeringWheel(steeringWheel === sw.value ? null : sw.value)} variant={steeringWheel === sw.value ? "filled" : "outline"} color="indigo" size="md" radius="xl">{sw.label}</Chip>
                  ))}</Group>
                </Box>
                <Box>
                  <Text size="xs" fw={600} c="gray.6" mb={6}>Продавец</Text>
                  <Group gap={6}>{SELLER_TYPES.map((st) => (
                    <Chip key={st.value} checked={sellerType === st.value} onChange={() => setSellerType(sellerType === st.value ? null : st.value)} variant={sellerType === st.value ? "filled" : "outline"} color="indigo" size="md" radius="xl">{st.label}</Chip>
                  ))}</Group>
                </Box>
              </Group>
              )}

              <Group gap="lg" wrap="wrap" align="flex-start">
                <Box>
                  <Text size="xs" fw={600} c="gray.6" mb={6}>Документы</Text>
                  <Select placeholder="Неважно" data={DOCUMENT_STATUSES.map((d) => ({value:d.value,label:d.label}))} clearable value={documentsStatus} onChange={setDocumentsStatus} size="sm" w={170}/>
                </Box>
                <Box>
                  <Text size="xs" fw={600} c="gray.6" mb={6}>Повреждения</Text>
                  <Select placeholder="Неважно" data={DAMAGE_INFO.map((d) => ({value:d.value,label:d.label}))} clearable value={damageInfo} onChange={setDamageInfo} size="sm" w={170}/>
                </Box>
                <Box>
                  <Text size="xs" fw={600} c="gray.6" mb={6}>Наличие</Text>
                  <Select placeholder="Неважно" data={AVAILABILITY_TYPES.map((a) => ({value:a.value,label:a.label}))} clearable value={availability} onChange={setAvailability} size="sm" w={150}/>
                </Box>
              </Group>

              <Group gap="lg" wrap="wrap" align="flex-end">
                <Box>
                  <Text size="xs" fw={600} c="gray.6" mb={6}>Владельцев, до</Text>
                  <Select placeholder="Неважно" data={OWNERS_COUNT_OPTIONS.map((o) => ({value:o.value,label:o.label}))} clearable value={ownersCountTo || null} onChange={(value) => setOwnersCountTo(value || "")} size="sm" w={150}/>
                </Box>
                <Box>
                  <Text size="xs" fw={600} c="gray.6" mb={6}>Растаможен</Text>
                  <SegmentedControl size="sm" value={customsCleared === null ? "any" : customsCleared ? "yes" : "no"} onChange={(v) => setCustomsCleared(v === "any" ? null : v === "yes")} data={[{label:"Неважно",value:"any"},{label:"Да",value:"yes"},{label:"Нет",value:"no"}]}/>
                </Box>
              </Group>

              <Box>
                <Text size="xs" fw={600} c="gray.6" mb={6}>Ключевые слова</Text>
                <TextInput placeholder='Например: "один хозяин", RAID, ксенон...' value={keywords} onChange={(e) => setKeywords(e.target.value)} size="sm" w={400} leftSection={<IconSearch size={14}/>}/>
                <Text size="10px" c="gray.4" mt={4}>Для точного совпадения используйте кавычки</Text>
              </Box>

              <Group className="catalog-filter-advanced__actions" justify="space-between" gap="sm">
                <Text size="xs" c="dimmed">Фильтры применяются сразу — выдача ниже уже обновлена.</Text>
                <Group gap="xs">
                  {activeFilterCount > 0 && <Button variant="subtle" size="sm" color="gray" leftSection={<IconX size={14}/>} onClick={resetFilters}>Сбросить фильтры</Button>}
                  <Button color="indigo" size="sm" radius="md" leftSection={<IconSearch size={15}/>} onClick={() => setShowAdvanced(false)}>
                    К результатам · {data?.pagination?.total ?? 0}
                  </Button>
                </Group>
              </Group>
            </Stack>
          </Collapse>}
        </Stack>
      </Paper>

      {/* Подписка на поиск — после того, как фильтры настроены.

          Механизм уведомлений был написан, но кнопка стояла в ряду с
          сортировкой и терялась: человек не знал, что можно не возвращаться
          в каталог вручную. Здесь она попадается на глаза ровно в тот
          момент, когда человек уже выбрал, что ищет, и смотрит результаты.

          Полоса не показывается без фильтров и без результатов: подписка на
          «все объявления» или на пустую выдачу ничего не даёт. */}
      {activeFilterCount > 0 && (data?.listings?.length ?? 0) > 0 && (
        <Paper className="catalog-subscribe" radius="md" p="sm" withBorder>
          <Group justify="space-between" wrap="wrap" gap="sm">
            <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
              <ThemeIcon variant="light" color="indigo" size={36} radius="md">
                <IconBell size={18} stroke={1.8} />
              </ThemeIcon>
              <Box style={{ minWidth: 0 }}>
                <Text size="sm" fw={650} c="var(--market-ink)">
                  Следить за этим поиском
                </Text>
                <Text size="xs" c="dimmed">
                  Сообщим в Telegram, когда появятся подходящие объявления — возвращаться и проверять не придётся.
                </Text>
              </Box>
            </Group>
            <SaveSearchButton scope="LISTINGS" suggestedTitle={p.pageTitle} />
          </Group>
        </Paper>
      )}

      {isLoading ? (
        <ResultsGridSkeleton count={8} />
      ) : error ? (
        <AsyncErrorState
          title="Не удалось загрузить объявления"
          description="Каталог временно не отвечает. Проверьте подключение и повторите запрос."
          onRetry={() => mutate()}
        />
      ) : !data?.listings?.length ? (
        <EmptyState
          title={activeFilterCount > 0 ? "Ничего не найдено" : "В этом разделе пока нет объявлений"}
          description={activeFilterCount > 0
            ? "Попробуйте изменить условия поиска или сбросить часть фильтров."
            : "Раздел наполняется продавцами. Разместите объявление — оно появится в каталоге после проверки модератором."}
          actionLabel={activeFilterCount > 0 ? "Сбросить фильтры" : undefined}
          onAction={activeFilterCount > 0 ? resetFilters : undefined}
        />
      ) : view === "grid" ? (
        <SimpleGrid cols={{base:1,sm:2,lg:3}} spacing="sm" className="catalog-appear">{data.listings.map((listing) => <ListingCard key={listing.id} listing={listing}/>)}</SimpleGrid>
      ) : (
        <Stack gap="xs" className="catalog-appear">{data.listings.map((listing) => <ListingRow key={listing.id} listing={listing}/>)}</Stack>
      )}

      {data && data.pagination?.pages > 1 && (
        <Stack align="center" gap={6}>
          <Pagination value={page} onChange={setPage} total={data.pagination.pages} boundaries={1} siblings={1} size="sm" color="indigo" />
          <Text size="xs" c="dimmed">Страница {page} из {data.pagination.pages} · по {data.pagination.limit} объявлений</Text>
        </Stack>
      )}
    </Stack></Box>
  )
}
