"use client"
export const dynamic = "force-dynamic"
import { useState } from "react"
import useSWR from "swr"
import { Box, Stack, Group, Text, Paper, Select, Center, Loader, ScrollArea } from "@mantine/core"
import Link from "next/link"
import BrandIcon from "@/components/brands/BrandIcon"
import { formatPriceShort, parseImages } from "@/lib/format"
import useSWRImmutable from "swr/immutable"
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
            <img src={displayImage} alt={`${vehicle.make} ${vehicle.model}`} onError={() => setImageFailed(true)} loading="lazy" decoding="async" />
          )}
        </Box>
        <Stack gap={2} miw={0} style={{ flex: 1 }}>
          <Group gap={6} wrap="nowrap">
            <BrandIcon brand={vehicle.make} size={20} />
            <Text className="listing-map-result__title" size="sm" fw={700} c="var(--market-ink)">{vehicle.make} {vehicle.model}</Text>
          </Group>
          <Text className="listing-map-result__price" size="sm" fw={800} c="var(--market-ink)">{formatPriceShort(listing.price)}</Text>
          <Text className="listing-map-result__meta" size="xs" c="gray.5">{vehicle.year} г. · {listing.location || vehicle.location || city}</Text>
        </Stack>
      </Paper>
    </Link>
  )
}

/* Города для выбора — весь справочник, а не пятнадцать «популярных».

   На карте было пятнадцать городов, в справочнике доставки — 679:
   объявление в Альметьевске на карте найти было нельзя. Список
   считается один раз при загрузке модуля, а не на каждую отрисовку. */
const MAP_CITIES = Object.keys(CITY_COORDINATES).sort((a, b) => a.localeCompare(b, "ru"))

export default function MapPage() {
  /* Карта открывается там, где есть объявления.

     Раньше начальным городом всегда была Москва, а объявлений в ней нет:
     человек открывал карту и видел «0 объявлений», хотя в Казани и
     Альметьевске машины были. Берём город первого объявления каталога —
     самого свежего. */
  const { data: sample } = useSWRImmutable<MapListingsResponse>(
    "/api/listings?type=vehicle&limit=1",
    fetchJson,
  )
  const [city, setCity] = useState<string | null>(null)
  const sampleCity = sample?.listings?.[0]?.vehicle?.location || null
  const activeCity = city || (sampleCity && CITY_COORDINATES[sampleCity] ? sampleCity : "Москва")

  const { data, error, isLoading, mutate } = useSWR<MapListingsResponse>(
    `/api/listings?type=vehicle&city=${encodeURIComponent(activeCity)}&limit=30`,
    fetchJson,
  )
  const listings = data?.listings || []

  const coords = CITY_COORDINATES[activeCity] || CITY_COORDINATES["Москва"]
  const bbox = `${coords.latitude - 0.3},${coords.longitude - 0.5},${coords.latitude + 0.3},${coords.longitude + 0.5}`
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${coords.latitude},${coords.longitude}`

  return (
    <Box className="listing-map-page" p={{ base: "sm", md: "md" }}>
      <Stack gap="md">
        <Group gap="sm" align="center">
          <Stack gap={0}>
            <Text component="h1" c="var(--market-ink)" ff="var(--font-display),sans-serif">Карта объявлений</Text>
            <Text size="xs" c="gray.5">{listings.length} объявлений в городе {activeCity}</Text>
          </Stack>
        </Group>

        <Select
          label="Город"
          /* Города берутся из общего справочника — их 679, а не
             пятнадцать «популярных»: объявление в Альметьевске на карте
             найти было нельзя. */
          data={MAP_CITIES}
          value={activeCity}
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
                 listings.map((listing) => <MapListingResult key={listing.id} listing={listing} city={activeCity} />)}
              </Stack>
            </ScrollArea>
          </Paper>
        </Box>
      </Stack>
    </Box>
  )
}

