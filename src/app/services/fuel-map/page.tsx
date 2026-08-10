"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"
import { Anchor, Badge, Box, Button, Center, Group, Loader, Paper, Select, SimpleGrid, Stack, Text, ThemeIcon } from "@mantine/core"
import { IconExternalLink, IconGasStation, IconMapPin, IconRefresh, IconRoute } from "@tabler/icons-react"
import { CITY_COORDINATES, FUEL_MAP_CITIES } from "@/lib/cities"
import { AsyncErrorState } from "@/components/ui/AsyncStates"
import { fetchJson } from "@/lib/api-client"

type FuelStation = {
  id: number
  sourceType: "node" | "way" | "relation"
  name: string
  brand: string | null
  operator: string | null
  address: string | null
  openingHours: string | null
  fuels: string[]
  latitude: number
  longitude: number
}

type FuelStationsResponse = {
  city: string
  coordinates: { latitude: number; longitude: number }
  stations: FuelStation[]
  source: string
  disclaimer: string
}

export default function FuelMapPage() {
  const [city, setCity] = useState("Москва")
  const { data, error, isLoading, mutate } = useSWR<FuelStationsResponse>(`/api/fuel-stations?city=${encodeURIComponent(city)}`, fetchJson, { revalidateOnFocus: false })
  const coordinates = data?.coordinates || CITY_COORDINATES[city]
  const mapUrl = useMemo(() => {
    const delta = city === "Москва" || city === "Санкт-Петербург" ? 0.18 : 0.13
    const bbox = `${coordinates.latitude - delta},${coordinates.longitude - delta},${coordinates.latitude + delta},${coordinates.longitude + delta}`
    return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${coordinates.latitude},${coordinates.longitude}`
  }, [city, coordinates.latitude, coordinates.longitude])

  return (
    <Box className="service-page service-page--fuel-map" p={{ base: "sm", md: "md" }}>
      <Stack gap="md">
        <Paper className="fuel-map-hero" radius="xl" p={{ base: "lg", md: "xl" }}>
          <Group justify="space-between" align="flex-start" gap="lg" wrap="wrap">
            <Stack gap="sm" maw={680}>
              <Group gap="sm"><ThemeIcon size={44} radius="lg" variant="white" color="indigo"><IconFuel size={23} /></ThemeIcon><Badge variant="white" color="dark" radius="xl">СЕРВИС ДЛЯ ПОЕЗДКИ</Badge></Group>
              <Box><Text component="h1" fz={{ base: 28, md: 38 }} fw={850} lh={1.08} c="white" ff="var(--font-display),sans-serif">Карта АЗС России</Text><Text c="rgba(255,255,255,0.8)" mt={8} maw={620}>Выберите город, посмотрите открытые точки заправок и сразу постройте маршрут в привычном картографическом сервисе.</Text></Box>
              <Text size="xs" c="rgba(255,255,255,0.64)">Данные о точках обновляются с кэшем. Цены и фактическое наличие топлива не публикуются без подтверждённого поставщика.</Text>
            </Stack>
            <Paper className="fuel-map-hero__control" radius="lg" p="md" withBorder>
              <Text size="xs" fw={750} tt="uppercase" c="gray.6" mb={6}>Город на карте</Text>
              <Select aria-label="Выберите город" data={FUEL_MAP_CITIES.map((value) => ({ value, label: value }))} value={city} onChange={(value) => setCity(value || "Москва")} searchable size="sm" />
            </Paper>
          </Group>
        </Paper>

        <Group justify="space-between" align="center" gap="sm" wrap="wrap">
          <Group gap="sm"><ThemeIcon variant="light" color="indigo" radius="md"><IconMapPin size={18} /></ThemeIcon><Box><Text fw={750}>Заправки рядом с центром {city}</Text><Text size="xs" c="dimmed">{data ? `${data.stations.length} точек в подборке` : "Загружаем точки"}</Text></Box></Group>
          <Button variant="light" color="indigo" size="xs" leftSection={<IconRefresh size={14} />} onClick={() => mutate()} loading={isLoading}>Обновить</Button>
        </Group>

        {error ? <AsyncErrorState title="Не удалось получить точки АЗС" description="Картографический источник временно недоступен. Повторите попытку позже." onRetry={() => mutate()} /> : (
          <SimpleGrid cols={{ base: 1, lg: 5 }} spacing="md">
            <Paper className="fuel-map-canvas" radius="lg" withBorder style={{ gridColumn: "span 3", overflow: "hidden" }}>
              <iframe src={mapUrl} title={`Карта АЗС: ${city}`} loading="lazy" />
              <Box className="fuel-map-canvas__caption"><IconMapPin size={14} /><Text size="xs">Базовая карта © OpenStreetMap contributors</Text></Box>
            </Paper>
            <Paper className="fuel-map-list" radius="lg" p="sm" withBorder style={{ gridColumn: "span 2" }}>
              {isLoading ? <Center h={460}><Loader size="sm" color="indigo" /></Center> : data?.stations.length ? <Stack gap="xs">{data.stations.map((station) => (
                <Paper key={`${station.sourceType}-${station.id}`} className="fuel-station-card" radius="md" p="sm" withBorder>
                  <Group justify="space-between" align="flex-start" gap="xs" wrap="nowrap"><Group gap="sm" wrap="nowrap"><ThemeIcon variant="light" color="orange" radius="md"><IconFuel size={17} /></ThemeIcon><Box style={{ minWidth: 0 }}><Text fw={750} size="sm" lineClamp={1}>{station.name}</Text><Text size="xs" c="dimmed" lineClamp={1}>{station.address || station.operator || "Адрес не указан в OSM"}</Text></Box></Group><Anchor href={`https://www.openstreetmap.org/${station.sourceType}/${station.id}`} target="_blank" rel="noreferrer" aria-label={`Открыть ${station.name} в OpenStreetMap`}><IconExternalLink size={16} /></Anchor></Group>
                  <Group mt={8} gap={5} wrap="wrap">{station.fuels.length ? station.fuels.map((fuel) => <Badge key={fuel} size="xs" variant="light" color="indigo">{fuel}</Badge>) : <Badge size="xs" variant="outline" color="gray">Вид топлива не указан</Badge>}{station.openingHours && <Badge size="xs" variant="outline" color="gray">{station.openingHours}</Badge>}</Group>
                  <Button component="a" href={`https://www.openstreetmap.org/directions?from=&to=${station.latitude}%2C${station.longitude}`} target="_blank" rel="noreferrer" variant="subtle" color="indigo" size="compact-xs" mt={8} leftSection={<IconRoute size={13} />}>Построить маршрут</Button>
                </Paper>
              ))}</Stack> : <Center h={460}><Stack align="center" gap="xs"><ThemeIcon variant="light" color="gray" size={44} radius="xl"><IconFuel size={22} /></ThemeIcon><Text fw={700}>Точки не найдены</Text><Text size="xs" c="dimmed" ta="center">Попробуйте выбрать другой город или обновить данные.</Text></Stack></Center>}
            </Paper>
          </SimpleGrid>
        )}

        <Paper radius="lg" p="md" withBorder className="fuel-map-note"><Group gap="sm" wrap="nowrap"><ThemeIcon variant="light" color="cyan" radius="md"><IconMapPin size={18} /></ThemeIcon><Text size="sm" c="dimmed">{data?.disclaimer || "Точки и открытые теги предоставлены OpenStreetMap. Ассортимент, цены и наличие топлива уточняйте на АЗС."}</Text></Group></Paper>
      </Stack>
    </Box>
  )
}
