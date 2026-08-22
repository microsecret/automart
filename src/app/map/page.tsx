"use client"
export const dynamic = "force-dynamic"
import { useState } from "react"
import useSWR from "swr"
import { Box, Stack, Group, Text, Paper, Select, Center, Loader, ThemeIcon, ScrollArea } from "@mantine/core"
import { IconMapPin } from "@tabler/icons-react"
import Link from "next/link"
import BrandIcon from "@/components/brands/BrandIcon"
import { formatPriceShort, parseImages } from "@/lib/format"
import { POPULAR_CITIES } from "@/lib/constants"
import { CITY_COORDINATES } from "@/lib/cities"
import { fetchJson } from "@/lib/api-client"
import VehicleFallback from "@/components/listings/VehicleFallback"
import { AsyncErrorState, EmptyState } from "@/components/ui/AsyncStates"

type MapListing = {
  id: string
  price: number | null
  location?: string | null
  vehicle: {
    id: string
    make: string
    model: string
    year: number
    images: string | null
    vehicleType?: string | null
    bodyType?: string | null
    location?: string | null
  } | null
}

type MapListingsResponse = {
  listings: MapListing[]
}

function MapListingResult({ listing, city }: { listing: MapListing; city: string }) {
  const vehicle = listing.vehicle
  const [imageFailed, setImageFailed] = useState(false)

  if (!vehicle) return null

  const image = parseImages(vehicle.images)[0]
  const displayImage = image && !imageFailed ? image : null

  return (
    <Link className="listing-map-result" href={`/listings/vehicle/${vehicle.id}`}>
      <Paper className="listing-map-result__surface" radius="md" p="sm" withBorder>
        <Box className="listing-map-result__media" data-empty-media={!displayImage || undefined}>
          <VehicleFallback type={vehicle.vehicleType || "CAR"} bodyType={vehicle.bodyType} compact />
          {displayImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={displayImage} alt="" onError={() => setImageFailed(true)} loading="lazy" decoding="async" />
          )}
        </Box>
        <Stack gap={2} miw={0} style={{ flex: 1 }}>
          <Group gap={6} wrap="nowrap">
            <BrandIcon brand={vehicle.make} size={20} />
            <Text className="listing-map-result__title" size="sm" fw={750} c="var(--market-ink)">{vehicle.make} {vehicle.model}</Text>
          </Group>
          <Text className="listing-map-result__price" size="sm" fw={800} c="var(--market-ink)">{formatPriceShort(listing.price)}</Text>
          <Text className="listing-map-result__meta" size="xs" c="gray.5">{vehicle.year} г. · {listing.location || vehicle.location || city}</Text>
        </Stack>
      </Paper>
    </Link>
  )
}

export default function MapPage() {
  const [city, setCity] = useState("Москва")
  const { data, error, isLoading, mutate } = useSWR<MapListingsResponse>(
    `/api/listings?type=vehicle&city=${encodeURIComponent(city)}&limit=30`,
    fetchJson,
  )
  const listings = data?.listings || []

  const coords = CITY_COORDINATES[city] || CITY_COORDINATES["Москва"]
  const bbox = `${coords.latitude - 0.3},${coords.longitude - 0.5},${coords.latitude + 0.3},${coords.longitude + 0.5}`
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${coords.latitude},${coords.longitude}`

  return (
    <Box className="listing-map-page" p={{ base: "sm", md: "md" }}>
      <Stack gap="md">
        <Group gap="sm" align="center">
          <ThemeIcon variant="light" color="indigo" size={44} radius="md"><IconMapPin size={22} /></ThemeIcon>
          <Stack gap={0}>
            <Text component="h1" fw={800} fz={22} c="var(--market-ink)" ff="var(--font-display),sans-serif">Карта объявлений</Text>
            <Text size="xs" c="gray.5">{listings.length} объявлений в городе {city}</Text>
          </Stack>
        </Group>

        <Select
          label="Город"
          data={POPULAR_CITIES.map((c) => ({ value: c, label: c }))}
          value={city}
          onChange={(value) => setCity(value || "Москва")}
          size="sm"
          w={250}
          searchable
        />

        <Box className="listing-map-layout">
          <Paper className="listing-map-panel" radius="md" withBorder>
            <iframe
              src={mapUrl}
              className="listing-map-panel__frame"
              title={`Карта объявлений: ${city}`}
              loading="lazy"
            />
          </Paper>

          <Paper className="listing-map-results" radius="md" withBorder>
            <ScrollArea className="listing-map-results__scroll">
              <Stack gap="xs" p="sm">
                {error ? <AsyncErrorState title="Не удалось загрузить объявления" description="Карта остаётся доступна. Повторите запрос, чтобы вернуть список." onRetry={() => void mutate()} /> :
                 isLoading ? <Center py={48}><Loader size="sm" color="indigo" /></Center> :
                 listings.length === 0 ? <EmptyState title="В этом городе пока нет объявлений" description="Выберите другой город или посмотрите весь каталог." actionLabel="Все объявления" actionHref="/" /> :
                 listings.map((listing) => <MapListingResult key={listing.id} listing={listing} city={city} />)}
              </Stack>
            </ScrollArea>
          </Paper>
        </Box>
      </Stack>
    </Box>
  )
}

