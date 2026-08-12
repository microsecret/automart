"use client"
export const dynamic = "force-dynamic"
import { useMemo, useState } from "react"
import useSWR from "swr"
import Link from "next/link"
import { Container, Stack, Group, Text, Paper, Select, TextInput, SimpleGrid, Center, Loader, Badge, ThemeIcon, Button, Pagination, Box } from "@mantine/core"
import { IconDatabaseOff, IconGavel, IconPhoto, IconRefresh, IconX } from "@tabler/icons-react"
import { formatPriceShort } from "@/lib/format"
import { isSafeMediaUrl, parseMarketplaceImages } from "@/lib/media-url"
import VehicleFallback from "@/components/listings/VehicleFallback"
import { fetchJson } from "@/lib/api-client"
import { AsyncErrorState, ResultsGridSkeleton } from "@/components/ui/AsyncStates"
import type { AuctionListing } from "@prisma/client"
import { AUCTION_SOURCE_COUNTRY, AUCTION_SOURCE_OPTIONS } from "@/lib/auction-sources"

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
  { length: 15 },
  (_, index) => String(new Date().getFullYear() + 1 - index),
)

type AuctionResponse = {
  listings: AuctionListing[]
  pagination: { total: number; pages: number; limit: number }
}
function AuctionMedia({ listing }: { listing: AuctionListing }) {
  const [failed, setFailed] = useState(false)
  const image = isSafeMediaUrl(listing.imageUrl) ? listing.imageUrl : parseMarketplaceImages(listing.images)?.[0] || ""
  const hasImage = Boolean(image) && !failed

  return (
    <Box className="auction-card__media" data-empty-media={!hasImage || undefined}>
      <VehicleFallback type="CAR" compact={!hasImage} />
      {hasImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt={`${listing.make} ${listing.model}`} onError={() => setFailed(true)} loading="lazy" decoding="async" />
      ) : (
        <Stack className="auction-card__image-pending" gap={4} align="center">
          <ThemeIcon variant="light" color="orange" radius="xl" size={36}><IconPhoto size={19} /></ThemeIcon>
          <Badge size="xs" variant="white" color="gray">Фото ожидается</Badge>
        </Stack>
      )}
      <Badge pos="absolute" top={8} left={8} color="orange" variant="filled" size="sm">{listing.source}</Badge>
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

  return (
    <Container size="xl" p={{ base: "sm", md: "md" }}>
      <Stack gap="md">
        <Group gap="sm" align="center">
          <ThemeIcon variant="light" color="orange" size={44} radius="md"><IconGavel size={22} /></ThemeIcon>
          <Stack gap={0}>
            <Text component="h1" fw={800} fz={22} c="dark.9" ff="var(--font-display),sans-serif">Аукционы мира</Text>
            <Text size="xs" c="gray.5">{data?.pagination?.total || 0} авто · Япония · Корея · США · Европа · доставка в РФ</Text>
          </Stack>
        </Group>

        <Paper radius="lg" p="md" withBorder className="auction-filter-panel">
          <Stack gap="sm">
            <Group justify="space-between" align="center">
              <Box><Text size="sm" fw={750}>Подберите лот под импорт</Text><Text size="xs" c="dimmed">Площадка зависит от страны, цена лота пересчитывается по курсу ЦБ.</Text></Box>
              {hasActiveFilters && <Button variant="subtle" color="gray" size="compact-sm" leftSection={<IconX size={14} />} onClick={resetFilters}>Сбросить</Button>}
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
              <Text fw={750}>{hasActiveFilters ? "По этим параметрам лотов не найдено" : "Каталог аукционов обновляется"}</Text>
              <Text size="sm" c="dimmed">
                {hasActiveFilters
                  ? "Сбросьте часть условий или выберите другую страну и площадку."
                  : "Поставщики ещё не передали актуальные лоты. Можно оставить заявку на подбор — специалист сообщит, когда появится подходящий вариант."}
              </Text>
              <Group justify="center" gap="xs">
                {hasActiveFilters ? (
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
              <Link key={l.id} href={`/auctions/${l.id}`} style={{ textDecoration: "none" }}>
                <Paper radius="lg" withBorder className="auction-result-card" style={{ overflow: "hidden", borderColor: "var(--mantine-color-border)", cursor: "pointer" }}>
                  <AuctionMedia listing={l} />
                  <Box p="md" className="auction-result-card__content">
                    <Text fw={760} fz="sm" c="dark.9" lineClamp={1}>{l.make} {l.model}</Text>
                    <Text className="auction-result-card__summary" lineClamp={1}>
                      {l.year} г.{l.mileage != null ? ` · ${l.mileage.toLocaleString("ru")} км` : ""}
                    </Text>
                    <Group gap={4} mt={8} wrap="wrap">
                      {l.fuelType && <Badge size="xs" variant="light" color={l.fuelType === "ELECTRIC" ? "green" : l.fuelType === "HYBRID" ? "teal" : "gray"}>{l.fuelType === "ELECTRIC" ? "⚡ Электро" : l.fuelType === "HYBRID" ? "🔋 Гибрид" : l.fuelType === "DIESEL" ? "⛽ Дизель" : "⛽ Бензин"}</Badge>}
                      {l.bodyType && <Badge size="xs" variant="light" color="indigo">{l.bodyType === "SUV" ? "SUV" : l.bodyType === "SEDAN" ? "Седан" : l.bodyType === "PICKUP" ? "Пикап" : l.bodyType === "WAGON" ? "Универсал" : l.bodyType === "HATCHBACK" ? "Хэтчбек" : l.bodyType}</Badge>}
                      {l.engineVolume && <Badge size="xs" variant="default" color="gray">{l.engineVolume} л</Badge>}
                      {l.power && <Badge size="xs" variant="default" color="gray">{l.power} л.с.</Badge>}
                    </Group>
                    <Box className="auction-result-card__price-row">
                      <Text className="auction-result-card__price" ff="var(--font-display),sans-serif">{formatPriceShort(l.finalPrice)}</Text>
                      <Text className="auction-result-card__price-note">Под ключ в РФ</Text>
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
