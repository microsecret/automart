"use client"
export const dynamic = "force-dynamic"
import { useEffect, useMemo, useState } from "react"
import useSWR from "swr"
import Link from "next/link"
import { Container, Stack, Group, Text, Paper, Select, TextInput, SimpleGrid, Badge, ThemeIcon, Button, Pagination, Box, Divider, Progress } from "@mantine/core"
import { IconBolt, IconCar, IconDatabaseOff, IconEngine, IconEye, IconGasStation, IconGavel, IconPhoto, IconRefresh, IconX } from "@tabler/icons-react"
import { formatPriceShort } from "@/lib/format"
import { auctionCardImageUrl, highQualityAuctionImageUrl, isSafeMediaUrl, parseAuctionImages } from "@/lib/media-url"
import VehicleFallback from "@/components/listings/VehicleFallback"
import { fetchJson } from "@/lib/api-client"
import { AsyncErrorState, ResultsGridSkeleton } from "@/components/ui/AsyncStates"
import type { AuctionListing } from "@prisma/client"
import { AUCTION_SOURCE_COUNTRY, AUCTION_SOURCE_OPTIONS, AUCTION_SOURCE_PIPELINES, auctionSourceLabel } from "@/lib/auction-sources"
import { auctionMakeLabel, normalizeAuctionModel } from "@/lib/auction-normalization"
import BrandIcon from "@/components/brands/BrandIcon"
import styles from "./auctions.module.css"

const fetcher = fetchJson

const COUNTRIES = [
  { value: "", label: "Все страны" },
  { value: "JP", label: "🇯🇵 Япония" },
  { value: "KR", label: "🇰🇷 Корея" },
  { value: "CN", label: "🇨🇳 Китай" },
  { value: "US", label: "🇺🇸 США" },
  { value: "DE", label: "🇩🇪 Европа" },
]

const SOURCES = [
  { value: "", label: "Все площадки" },
  ...AUCTION_SOURCE_OPTIONS,
]

const auctionYears = Array.from(
  { length: 7 },
  (_, index) => String(new Date().getFullYear() + 1 - index),
)
const validAuctionCountries = new Set(COUNTRIES.map((item) => item.value))
const validAuctionBodyTypes = new Set(["SEDAN", "SUV", "HATCHBACK", "COUPE", "PICKUP", "WAGON", "MINIVAN"])
const validAuctionYears = new Set(auctionYears)

function readNonNegativeIntegerParam(value: string | null) {
  return value && /^\d+$/.test(value) ? value : ""
}

type AuctionResponse = {
  listings: AuctionListing[]
  pagination: { total: number; pages: number; limit: number }
  importPolicy?: { maxAgeYears: number; minimumYear: number; note: string }
  analytics?: {
    total: number
    averageFinalPrice: number | null
    medianFinalPrice: number | null
    minFinalPrice: number | null
    maxFinalPrice: number | null
    averageYear: number | null
    averageMileage: number | null
    powerKnown: number
    mileageKnown: number
    popularMakes: Array<{ make: string; count: number }>
    sources: Array<{ source: string; count: number }>
    fuelDistribution: Array<{ fuelType: string; count: number }>
    bodyDistribution: Array<{ bodyType: string; count: number }>
  }
}

const FUEL_LABELS: Record<string, string> = { GASOLINE: "Бензин", DIESEL: "Дизель", ELECTRIC: "Электро", HYBRID: "Гибрид", GAS: "Газ" }
const BODY_LABELS: Record<string, string> = { SUV: "Кроссовер", SEDAN: "Седан", PICKUP: "Пикап", WAGON: "Универсал", HATCHBACK: "Хэтчбек", MINIVAN: "Минивэн", COUPE: "Купе" }
// Remote auction photos remain on the source CDN. A short user intent
// (hover, focus or touch) is enough to warm the first full-size image in the
// browser cache, so opening a lot does not wait for a cold CDN request.
const preloadedDetailImages = new Set<string>()
const scheduledDetailImageWarmups = new Map<string, number>()

function detailImageForListing(listing: AuctionListing) {
  const originalImage = isSafeMediaUrl(listing.imageUrl) ? listing.imageUrl : parseAuctionImages(listing.images)?.[0] || ""
  return highQualityAuctionImageUrl(originalImage)
}

function warmAuctionDetailImage(listing: AuctionListing, delay = 0) {
  if (typeof window === "undefined") return
  const imageUrl = detailImageForListing(listing)
  if (!imageUrl || preloadedDetailImages.has(imageUrl) || scheduledDetailImageWarmups.has(imageUrl)) return

  const preload = () => {
    scheduledDetailImageWarmups.delete(imageUrl)
    if (preloadedDetailImages.has(imageUrl)) return
    preloadedDetailImages.add(imageUrl)
    const image = new window.Image()
    image.decoding = "async"
    image.src = imageUrl
  }

  if (delay > 0) {
    scheduledDetailImageWarmups.set(imageUrl, window.setTimeout(preload, delay))
  } else {
    preload()
  }
}

function cancelAuctionDetailImageWarmup(listing: AuctionListing) {
  if (typeof window === "undefined") return
  const imageUrl = detailImageForListing(listing)
  const timer = imageUrl ? scheduledDetailImageWarmups.get(imageUrl) : undefined
  if (timer === undefined || !imageUrl) return
  window.clearTimeout(timer)
  scheduledDetailImageWarmups.delete(imageUrl)
}

function AuctionMedia({ listing }: { listing: AuctionListing }) {
  const [failed, setFailed] = useState(false)
  const originalImage = isSafeMediaUrl(listing.imageUrl) ? listing.imageUrl : parseAuctionImages(listing.images)?.[0] || ""
  const image = auctionCardImageUrl(originalImage)
  const hasImage = Boolean(image) && !failed

  return (
    <Box className="auction-card__media" data-empty-media={!hasImage || undefined}>
      {!hasImage && <VehicleFallback type="CAR" compact />}
      {hasImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt={`${auctionMakeLabel(listing.make)} ${normalizeAuctionModel(listing.model) || "автомобиль"}`} onError={() => setFailed(true)} loading="lazy" decoding="async" />
      ) : (
        <Stack className="auction-card__image-pending" gap={4} align="center">
          <ThemeIcon variant="light" color="orange" radius="xl" size={36}><IconPhoto size={19} /></ThemeIcon>
          <Badge size="xs" variant="white" color="gray">Фото ожидается</Badge>
        </Stack>
      )}
      <Badge pos="absolute" top={8} left={8} color="orange" variant="filled" size="sm">{auctionSourceLabel(listing.source)}</Badge>
      <Badge pos="absolute" top={8} right={8} color="dark" variant="filled" size="sm">
        {listing.country === "JP" ? "🇯🇵" : listing.country === "KR" ? "🇰🇷" : listing.country === "US" ? "🇺🇸" : listing.country === "DE" ? "🇩🇪" : listing.country === "CN" ? "🇨🇳" : listing.country}
      </Badge>
    </Box>
  )
}

export default function AuctionsPage() {
  const [page, setPage] = useState(1)
  const [country, setCountry] = useState("")
  const [source, setSource] = useState("")
  const [make, setMake] = useState("")
  const [priceFrom, setPriceFrom] = useState("")
  const [priceTo, setPriceTo] = useState("")
  const [bodyType, setBodyType] = useState("")
  const [yearFrom, setYearFrom] = useState("")

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const requestedSource = params.get("source") || ""
    const sourceFromUrl = AUCTION_SOURCE_COUNTRY[requestedSource] ? requestedSource : ""
    const requestedCountry = params.get("country") || ""
    const countryFromUrl = validAuctionCountries.has(requestedCountry)
      ? requestedCountry
      : AUCTION_SOURCE_COUNTRY[sourceFromUrl] || ""
    const requestedBodyType = params.get("bodyType") || ""
    const requestedYear = params.get("yearFrom") || ""
    const requestedPage = Number.parseInt(params.get("page") || "1", 10)
    setSource(sourceFromUrl)
    setCountry(countryFromUrl)
    setMake(params.get("make")?.trim() || "")
    setPriceFrom(readNonNegativeIntegerParam(params.get("priceFrom")))
    setPriceTo(readNonNegativeIntegerParam(params.get("priceTo")))
    setBodyType(validAuctionBodyTypes.has(requestedBodyType) ? requestedBodyType : "")
    setYearFrom(validAuctionYears.has(requestedYear) ? requestedYear : "")
    setPage(Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1)
  }, [])

  const sourceOptions = useMemo(() => SOURCES.filter((item) => !item.value || !country || AUCTION_SOURCE_COUNTRY[item.value] === country), [country])
  const hasInvalidPriceRange = Boolean(priceFrom && priceTo && Number(priceFrom) > Number(priceTo))

  const buildQ = () => {
    const q = new URLSearchParams()
    q.set("page", String(page))
    q.set("limit", "24")
    if (country) q.set("country", country)
    if (source) q.set("source", source)
    if (make) q.set("make", make)
    if (priceFrom) q.set("priceFrom", priceFrom)
    if (priceTo) q.set("priceTo", priceTo)
    if (bodyType) q.set("bodyType", bodyType)
    if (yearFrom) q.set("yearFrom", yearFrom)
    return q.toString()
  }

  const { data, error, isLoading, mutate } = useSWR<AuctionResponse>(hasInvalidPriceRange ? null : "/api/auctions?" + buildQ(), fetcher)
  const listings = data?.listings || []
  const resetFilters = () => {
    setCountry(""); setSource(""); setMake(""); setPriceFrom(""); setPriceTo(""); setBodyType(""); setYearFrom(""); setPage(1)
  }
  const hasActiveFilters = Boolean(country || source || make || priceFrom || priceTo || bodyType || yearFrom)
  const analytics = data?.analytics
  const sourceSummary = analytics?.sources.map((item) => `${auctionSourceLabel(item.source)}: ${item.count}`).join(" · ")
  const powerCoverage = analytics?.total ? Math.round((analytics.powerKnown / analytics.total) * 100) : 0
  const mileageCoverage = analytics?.total ? Math.round((analytics.mileageKnown / analytics.total) * 100) : 0
  const powerCoverageValue = analytics?.total ? (powerCoverage > 0 ? `${powerCoverage}%` : "Нет данных") : "—"
  const powerCoverageNote = analytics?.total
    ? powerCoverage > 0
      ? `мощность указана · пробег: ${mileageCoverage}%`
      : `источник не публикует мощность · пробег: ${mileageCoverage}%`
    : "данные появятся после загрузки лотов"
  const topFuelDistribution = analytics?.fuelDistribution.slice(0, 3) || []
  const topBodyDistribution = analytics?.bodyDistribution.slice(0, 3) || []
  const importPolicy = data?.importPolicy
  const countryLabel = COUNTRIES.find((item) => item.value === country)?.label.replace(/^\S+\s/, "") || "этой страны"
  const selectedSourceIds = source
    ? [source]
    : AUCTION_SOURCE_OPTIONS.filter((item) => !country || AUCTION_SOURCE_COUNTRY[item.value] === country).map((item) => item.value)
  const countryAwaitingConnection = Boolean(country && selectedSourceIds.length && selectedSourceIds.every((sourceId) => AUCTION_SOURCE_PIPELINES[sourceId]?.pipeline !== "PUBLIC_COLLECTOR"))

  return (
    <Container size="xl" p={{ base: "sm", md: "md" }}>
      <Stack gap="md">
        <Group gap="sm" align="center">
          <ThemeIcon variant="light" color="orange" size={44} radius="md"><IconGavel size={22} /></ThemeIcon>
          <Stack gap={0}>
            <Text component="h1" fw={800} fz={22} c="dark.9" ff="var(--font-display),sans-serif">Аукционы мира</Text>
            <Text size="xs" c="gray.5">
              {data?.pagination?.total || 0} авто в активном каталоге · {sourceSummary ? `источники: ${sourceSummary}` : "источники уточняются"} · доставка в РФ
            </Text>
          </Stack>
        </Group>

        <Paper radius="lg" p="md" withBorder className="auction-filter-panel">
          <Stack gap="sm">
            <Group justify="space-between" align="center">
              <Box><Text size="sm" fw={750}>Подберите лот под импорт</Text><Text size="xs" c="dimmed">Площадка зависит от страны, цена лота пересчитывается по курсу ЦБ.</Text></Box>
              {hasActiveFilters && <Button variant="subtle" color="gray" size="compact-sm" leftSection={<IconX size={14} />} onClick={resetFilters}>Сбросить</Button>}
            </Group>
            <Group gap="xs" align="center" wrap="wrap">
              <Badge color="teal" variant="light">Импорт-фильтр: не старше {importPolicy?.maxAgeYears ?? 5} лет</Badge>
              <Text size="xs" c="dimmed">Год выпуска сверяется с карточкой; итоговую таможенную категорию подтвердим по документам.</Text>
            </Group>
          <Box className="auction-filter-grid">
            <Select label="Страна" data={COUNTRIES} value={country} onChange={(value) => { setCountry(value || ""); setSource(""); setPage(1) }} size="sm" />
            <Select
              label="Площадка"
              placeholder={country ? "Все площадки" : "Сначала выберите страну"}
              data={sourceOptions}
              value={source}
              disabled={!country}
              onChange={(value) => { setSource(value || ""); setPage(1) }}
              size="sm"
            />
            <Select
                label="Марка"
                placeholder="Любая"
                searchable
                clearable
                data={[
                  { value: "Toyota", label: "Toyota" },
                  { value: "Honda", label: "Honda" },
                  { value: "Nissan", label: "Nissan" },
                  { value: "Hyundai", label: "Hyundai" },
                  { value: "Kia", label: "Kia" },
                  { value: "Genesis", label: "Genesis" },
                  { value: "BMW", label: "BMW" },
                  { value: "Mercedes-Benz", label: "Mercedes-Benz" },
                  { value: "Audi", label: "Audi" },
                  { value: "Volkswagen", label: "Volkswagen" },
                  { value: "Tesla", label: "Tesla" },
                  { value: "Ford", label: "Ford" },
                  { value: "Lexus", label: "Lexus" },
                  { value: "Mazda", label: "Mazda" },
                  { value: "Subaru", label: "Subaru" },
                  { value: "Mitsubishi", label: "Mitsubishi" },
                  { value: "Land Rover", label: "Land Rover" },
                  { value: "Porsche", label: "Porsche" },
                  { value: "Volvo", label: "Volvo" },
                  { value: "Geely", label: "Geely" },
                  { value: "Chery", label: "Chery" },
                  { value: "Haval", label: "Haval" },
                  { value: "BYD", label: "BYD" },
                  { value: "Zeekr", label: "Zeekr" },
                  { value: "Li Auto", label: "Li Auto" },
                ]}
                value={make || null}
                onChange={(value) => { setMake(value || ""); setPage(1) }}
                size="sm"
              />
            <Box className="auction-price-range"><Text size="10px" c="dimmed" fw={800} tt="uppercase">Ориентир цены лота, ₽</Text><Group gap={4} wrap="nowrap"><TextInput aria-label="Цена от" placeholder="От" value={priceFrom} onChange={(e) => { setPriceFrom(e.target.value); setPage(1) }} size="sm" type="number" error={hasInvalidPriceRange} /><TextInput aria-label="Цена до" placeholder="До" value={priceTo} onChange={(e) => { setPriceTo(e.target.value); setPage(1) }} size="sm" type="number" error={hasInvalidPriceRange} /></Group></Box>
              <Select
                label="Кузов"
                placeholder="Любой"
                clearable
                data={[
                  { value: "SEDAN", label: "Седан" },
                  { value: "SUV", label: "Внедорожник" },
                  { value: "HATCHBACK", label: "Хэтчбек" },
                  { value: "COUPE", label: "Купе" },
                  { value: "PICKUP", label: "Пикап" },
                  { value: "WAGON", label: "Универсал" },
                  { value: "MINIVAN", label: "Минивэн" },
                ]}
                value={bodyType || null}
                onChange={(value) => { setBodyType(value || ""); setPage(1) }}
                size="sm"
              />
              <Select
                label="Год от"
                placeholder="Любой"
                clearable
                data={auctionYears.map((year) => ({ value: year, label: year }))}
                value={yearFrom || null}
                onChange={(value) => { setYearFrom(value || ""); setPage(1) }}
                size="sm"
              />
          </Box>
          {hasInvalidPriceRange && <Text size="xs" c="red">Цена «от» не может быть выше цены «до».</Text>}
          </Stack>
        </Paper>

        {analytics && analytics.total > 0 && (
          <Paper radius="lg" p="md" withBorder className={styles.brandDiscovery}>
            <Stack gap="sm">
              <Group justify="space-between" gap="sm" wrap="wrap">
                <Box>
                  <Text fw={800} size="sm">Быстрый выбор марки</Text>
                  <Text size="xs" c="dimmed">Марки и показатели рассчитаны по текущей выдаче, а не по рекламному каталогу.</Text>
                </Box>
                {sourceSummary && <Text className={styles.sourceSummary}>Источники: {sourceSummary}</Text>}
              </Group>

              <SimpleGrid cols={{ base: 2, xs: 3, sm: 4, lg: 5 }} spacing="sm" aria-label="Быстрый выбор марки">
                {analytics.popularMakes.map((item) => (
                  <Button
                    key={item.make}
                    className={styles.brandShortcut}
                    data-active={make === item.make || undefined}
                    variant="default"
                    color="indigo"
                    size="md"
                    radius="lg"
                    fullWidth
                    justify="space-between"
                    leftSection={<BrandIcon brand={auctionMakeLabel(item.make)} size={34} variant="rounded" />}
                    rightSection={<Badge size="xs" variant={make === item.make ? "filled" : "light"} color="indigo">{item.count}</Badge>}
                    onClick={() => { setMake(make === item.make ? "" : item.make); setPage(1) }}
                  >
                    {auctionMakeLabel(item.make)}
                  </Button>
                ))}
              </SimpleGrid>

              <Divider color="gray.2" />
                <Box className={styles.insights} aria-label="Аналитика текущей выдачи">
                  <Box className={styles.insight}>
                    <Text className={styles.insightValue}>{analytics.averageFinalPrice ? formatPriceShort(analytics.averageFinalPrice) : "—"}</Text>
                    <Text className={styles.insightLabel}>средняя цена под ключ</Text>
                  </Box>
                  <Box className={styles.insight}>
                    <Text className={styles.insightValue}>{analytics.medianFinalPrice ? formatPriceShort(analytics.medianFinalPrice) : "—"}</Text>
                    <Text className={styles.insightLabel}>медианная цена под ключ</Text>
                  </Box>
                  <Box className={styles.insight}>
                    <Text className={styles.insightValue}>{analytics.averageYear || "—"}</Text>
                    <Text className={styles.insightLabel}>средний год выпуска</Text>
                </Box>
                <Box className={styles.insight}>
                  <Text className={styles.insightValue}>{analytics.averageMileage ? `${Math.round(analytics.averageMileage / 1000).toLocaleString("ru")} тыс. км` : "—"}</Text>
                  <Text className={styles.insightLabel}>средний пробег</Text>
                </Box>
                <Box className={styles.insight}>
                  <Text className={styles.insightValue} fz={powerCoverage > 0 ? undefined : "lg"}>{powerCoverageValue}</Text>
                    <Text className={styles.insightLabel}>{powerCoverageNote}</Text>
                  </Box>
                </Box>

                {(topFuelDistribution.length > 0 || topBodyDistribution.length > 0) && (
                  <>
                    <Divider color="gray.2" />
                    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm" className={styles.marketMix} aria-label="Структура текущей выдачи">
                      <Box>
                        <Text size="xs" fw={800} tt="uppercase" c="gray.6" mb={7}>Топливо в выдаче</Text>
                        <Stack gap={7}>
                          {topFuelDistribution.map((item) => {
                            const share = analytics.total ? Math.round((item.count / analytics.total) * 100) : 0
                            return <Box key={item.fuelType} className={styles.mixRow}><Group justify="space-between" gap="xs"><Text size="sm" fw={700}>{FUEL_LABELS[item.fuelType] || item.fuelType}</Text><Text size="xs" c="dimmed">{item.count} · {share}%</Text></Group><Progress value={share} color="orange" size="sm" radius="xl" mt={4} /></Box>
                          })}
                        </Stack>
                      </Box>
                      <Box>
                        <Text size="xs" fw={800} tt="uppercase" c="gray.6" mb={7}>Тип кузова в выдаче</Text>
                        <Stack gap={7}>
                          {topBodyDistribution.map((item) => {
                            const share = analytics.total ? Math.round((item.count / analytics.total) * 100) : 0
                            return <Box key={item.bodyType} className={styles.mixRow}><Group justify="space-between" gap="xs"><Text size="sm" fw={700}>{BODY_LABELS[item.bodyType] || item.bodyType}</Text><Text size="xs" c="dimmed">{item.count} · {share}%</Text></Group><Progress value={share} color="indigo" size="sm" radius="xl" mt={4} /></Box>
                          })}
                        </Stack>
                      </Box>
                    </SimpleGrid>
                    <Text size="xs" c="dimmed">Структура отражает только текущую отфильтрованную выдачу. Это не прогноз спроса, ликвидности или конечной цены сделки.</Text>
                  </>
                )}
              </Stack>
            </Paper>
        )}

        {isLoading ? (
          <ResultsGridSkeleton count={8} />
        ) : error ? (
          <AsyncErrorState
            title="Не удалось загрузить лоты"
            description="Аукционный каталог временно не отвечает. Повторите запрос через несколько секунд."
            onRetry={() => mutate()}
          />
        ) : listings.length === 0 ? (
          <Paper radius="lg" p={{ base: "lg", md: "xl" }} withBorder>
            <Stack align="center" gap="sm" maw={460} mx="auto" ta="center">
              <ThemeIcon size={52} radius="xl" variant="light" color={hasActiveFilters ? "gray" : "orange"}>
                <IconDatabaseOff size={26} />
              </ThemeIcon>
              <Text fw={750}>{countryAwaitingConnection ? `${countryLabel}: подключение источников готовится` : hasActiveFilters ? "По этим параметрам лотов не найдено" : "Каталог аукционов обновляется"}</Text>
              <Text size="sm" c="dimmed">
                {countryAwaitingConnection
                  ? "Для этой страны нет активного автоматического сборщика: публикации появятся только после проверки и подключения разрешённого источника. Оставьте заявку — команда подберёт автомобиль вручную."
                  : hasActiveFilters
                  ? "Сбросьте часть условий или выберите другую страну и площадку."
                  : "Поставщики ещё не передали актуальные лоты. Можно оставить заявку на подбор — специалист сообщит, когда появится подходящий вариант."}
              </Text>
              <Group justify="center" gap="xs">
                {countryAwaitingConnection ? (
                  <Button component={Link} href={`/services/smart-matching${country ? `?country=${country}` : ""}`} color="orange" size="sm" leftSection={<IconGavel size={15} />}>Оставить заявку на подбор</Button>
                ) : hasActiveFilters ? (
                  <Button variant="light" color="orange" size="sm" leftSection={<IconX size={15} />} onClick={resetFilters}>Сбросить фильтры</Button>
                ) : (
                  <Button component={Link} href="/services/smart-matching" color="orange" size="sm" leftSection={<IconGavel size={15} />}>Оставить заявку на подбор</Button>
                )}
                <Button variant="subtle" color="gray" size="sm" leftSection={<IconRefresh size={15} />} onClick={() => window.location.reload()}>Обновить</Button>
              </Group>
            </Stack>
          </Paper>
        ) : (
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="sm">
            {listings.map((l) => (
              <Link
                key={l.id}
                href={`/auctions/${l.id}`}
                style={{ textDecoration: "none" }}
                onPointerEnter={() => warmAuctionDetailImage(l, 140)}
                onPointerLeave={() => cancelAuctionDetailImageWarmup(l)}
                onFocus={() => warmAuctionDetailImage(l)}
                onPointerDown={() => warmAuctionDetailImage(l)}
                onTouchStart={() => warmAuctionDetailImage(l)}
              >
                <Paper radius="lg" withBorder className="auction-result-card" style={{ overflow: "hidden", borderColor: "var(--mantine-color-border)", cursor: "pointer" }}>
                  <AuctionMedia listing={l} />
                  <Box p="md" className="auction-result-card__content">
                    <Group gap="sm" wrap="nowrap" align="center">
                      <BrandIcon brand={auctionMakeLabel(l.make)} size={34} variant="rounded" />
                      <Box style={{ minWidth: 0, flex: 1 }}>
                        <Text fw={760} fz="sm" c="dark.9" lineClamp={1}>{auctionMakeLabel(l.make)} {normalizeAuctionModel(l.model) || "Модель уточняется"}</Text>
                        <Text className="auction-result-card__summary" lineClamp={1}>
                          {l.year} г.{l.mileage != null ? ` · ${l.mileage.toLocaleString("ru")} км` : ""}
                        </Text>
                      </Box>
                    </Group>
                    <Group gap={4} mt={8} wrap="wrap">
                      {l.fuelType && <Badge className={styles.resultSpec} size="xs" variant="light" color={l.fuelType === "ELECTRIC" ? "green" : l.fuelType === "HYBRID" ? "teal" : "orange"} leftSection={<IconGasStation size={12} />}>Топливо: {FUEL_LABELS[l.fuelType] || l.fuelType}</Badge>}
                      {l.bodyType && <Badge className={styles.resultSpec} size="xs" variant="light" color="indigo" leftSection={<IconCar size={12} />}>Кузов: {BODY_LABELS[l.bodyType] || l.bodyType}</Badge>}
                      {l.engineVolume && <Badge className={styles.resultSpec} size="xs" variant="light" color="gray" leftSection={<IconEngine size={12} />}>Объём: {Math.round(l.engineVolume).toLocaleString("ru-RU")} см³</Badge>}
                      <Badge className={styles.resultSpec} size="xs" variant="light" color={l.power ? "violet" : "gray"} leftSection={<IconBolt size={12} />}>Мощность: {l.power ? `${l.power} л.с.` : "нет данных"}</Badge>
                      {(parseAuctionImages(l.images)?.length || 0) > 1 && <Badge className={styles.resultSpec} size="xs" variant="light" color="blue" leftSection={<IconPhoto size={12} />}>Фото: {parseAuctionImages(l.images)?.length}</Badge>}
                      {l.viewCount > 0 && <Badge className={styles.resultSpec} size="xs" variant="light" color="gray" leftSection={<IconEye size={12} />}>Просмотры: {l.viewCount.toLocaleString("ru")}</Badge>}
                    </Group>
                    <Box className="auction-result-card__price-row">
                      <Text className="auction-result-card__price" ff="var(--font-display),sans-serif">{formatPriceShort(l.finalPrice)}</Text>
                      <Text className="auction-result-card__price-note">Предварительно под ключ в РФ</Text>
                    </Box>
                    {l.auctionDate && (
                      <Group gap={4} className="auction-result-card__date" wrap="nowrap">
                        <Text size="xs" fw={700} c={new Date(l.auctionDate) > new Date() ? "teal.7" : "gray.5"}>
                          {new Date(l.auctionDate) > new Date() ? "Торги: " : "Торги были: "}
                        </Text>
                        <Text size="xs" c="gray.5">
                          {new Date(l.auctionDate).toLocaleDateString("ru", { day: "numeric", month: "short" })}
                        </Text>
                        {l.lotNumber && <Text size="xs" c="gray.4" lineClamp={1}>· #{l.lotNumber}</Text>}
                      </Group>
                    )}
                  </Box>
                </Paper>
              </Link>
            ))}
          </SimpleGrid>
        )}

        {data && data.pagination.pages > 1 && (
          <Stack align="center" gap={6}>
            <Pagination value={page} onChange={setPage} total={data.pagination.pages} boundaries={1} siblings={1} size="sm" color="orange" />
            <Text size="xs" c="dimmed">Страница {page} из {data.pagination.pages} · по {data.pagination.limit} лота</Text>
          </Stack>
        )}
      </Stack>
    </Container>
  )
}
