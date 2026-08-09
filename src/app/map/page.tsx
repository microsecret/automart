"use client"
export const dynamic = "force-dynamic"
import { useState } from "react"
import useSWR from "swr"
import { Box, Stack, Group, Text, Paper, Select, Center, Loader, SimpleGrid, Badge, ThemeIcon, ScrollArea } from "@mantine/core"
import { IconMapPin, IconCar } from "@tabler/icons-react"
import Link from "next/link"
import BrandIcon from "@/components/brands/BrandIcon"
import { formatPriceShort, parseImages } from "@/lib/format"
import { POPULAR_CITIES } from "@/lib/constants"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function MapPage() {
  const [city, setCity] = useState("Москва")
  const { data, isLoading } = useSWR(`/api/listings?type=vehicle&city=${encodeURIComponent(city)}&limit=30`, fetcher)
  const listings: any[] = data?.listings || []

  // Гео-координаты городов
  const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
    "Москва": { lat: 55.7558, lng: 37.6173 },
    "Санкт-Петербург": { lat: 59.9343, lng: 30.3351 },
    "Новосибирск": { lat: 55.0084, lng: 82.9357 },
    "Екатеринбург": { lat: 56.8389, lng: 60.6057 },
    "Казань": { lat: 55.8304, lng: 49.0661 },
    "Краснодар": { lat: 45.0355, lng: 38.9753 },
  }
  const coords = CITY_COORDS[city] || CITY_COORDS["Москва"]
  const bbox = `${coords.lat - 0.3},${coords.lng - 0.5},${coords.lat + 0.3},${coords.lng + 0.5}`
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${coords.lat},${coords.lng}`

  return (
    <Box p={{ base: "sm", md: "md" }}>
      <Stack gap="md">
        <Group gap="sm" align="center">
          <ThemeIcon variant="light" color="indigo" size={44} radius="md"><IconMapPin size={22} /></ThemeIcon>
          <Stack gap={0}>
            <Text component="h1" fw={800} fz={22} c="dark.9" ff="var(--font-display),sans-serif">Карта объявлений</Text>
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

        <Group gap="md" align="flex-start" wrap="nowrap">
          {/* Карта */}
          <Paper radius="md" withBorder style={{ flex: 1, overflow: "hidden", minHeight: 500 }}>
            <iframe
              src={mapUrl}
              style={{ width: "100%", height: 500, border: "none" }}
              title="Карта"
              loading="lazy"
            />
          </Paper>

          {/* Список справа */}
          <Box style={{ width: 320, flexShrink: 0 }}>
            <ScrollArea style={{ height: 500 }}>
              <Stack gap="xs">
                {isLoading ? <Center py={40}><Loader size="sm" color="indigo" /></Center> :
                 listings.length === 0 ? <Text c="gray.5" size="sm">Нет объявлений</Text> :
                 listings.map((l: any) => {
                   const v = l.vehicle
                   if (!v) return null
                   const images = parseImages(v.images)
                   return (
                     <Link key={l.id} href={`/listings/vehicle/${v.id}`} style={{ textDecoration: "none" }}>
                       <Paper radius="md" p="sm" withBorder style={{ cursor: "pointer" }}>
                         <Group gap="sm" wrap="nowrap">
                           {images[0] && <img src={images[0]} alt={v.make} style={{ width: 60, height: 45, borderRadius: 6, objectFit: "cover" }} />}
                           <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                             <Group gap="sm"><BrandIcon brand={v.make} size={20} /><Text size="xs" fw={600} c="dark.9">{v.make} {v.model}</Text></Group>
                             <Text size="xs" fw={700} c="dark.9">{formatPriceShort(l.price)}</Text>
                             <Text size="10px" c="gray.4">{v.year} · {v.location || city}</Text>
                           </Stack>
                         </Group>
                       </Paper>
                     </Link>
                   )
                 })}
              </Stack>
            </ScrollArea>
          </Box>
        </Group>
      </Stack>
    </Box>
  )
}

