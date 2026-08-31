import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Box, Container, Group, Stack, Table, Text, Title } from "@mantine/core"
import { prisma } from "@/lib/prisma"
import { buildSeoMetadata } from "@/lib/seo-metadata"
import { cityFromSlug } from "@/lib/fuel-city-slug"
import { CITY_COORDINATES } from "@/lib/cities"

/**
 * Городская страница карты АЗС.
 *
 * Карта жила по одному адресу на всю страну: заголовок обещал Россию, а
 * человек искал «цены на бензин в Уфе». Вести его было некуда — города не
 * было ни в адресе, ни в заголовке, ни в тексте страницы.
 *
 * Здесь всё это есть, и главное — цены отдаются прямо в разметке, а не
 * подгружаются скриптом. Поисковик читает страницу целиком: марки, средние
 * цены, число заправок. Карта рядом, для тех, кто пришёл искать по месту.
 */

/* Раз в час: цены на топливо меняются не чаще, а пересчитывать среднее по
   городу на каждый заход поисковика незачем. */
export const revalidate = 3600

const FUEL_LABELS: Record<string, string> = {
  AI92: "АИ-92",
  AI95: "АИ-95",
  AI98: "АИ-98",
  AI100: "АИ-100",
  DT: "ДТ",
  GAS: "Газ",
}
const FUEL_ORDER = ["AI92", "AI95", "AI98", "AI100", "DT", "GAS"]

/* Пустая страница отвечает на запрос ничем, и поисковик справедливо считает
   её мусорной. Пятнадцать заправок — тот минимум, при котором средняя цена
   по городу уже что-то значит. */
const MIN_STATIONS_FOR_PAGE = 15

type CityFuelSummary = {
  city: string
  stationCount: number
  prices: Array<{ fuel: string; label: string; averageRub: number; minRub: number; maxRub: number; stations: number }>
  brands: Array<{ brand: string; count: number }>
  updatedAt: Date | null
}

async function loadCitySummary(city: string): Promise<CityFuelSummary | null> {
  const stations = await prisma.fuelStationImport.findMany({
    where: { city },
    select: { brand: true, updatedAt: true, prices: { select: { fuel: true, priceRub: true } } },
  })
  if (stations.length < MIN_STATIONS_FOR_PAGE) return null

  const byFuel = new Map<string, number[]>()
  const byBrand = new Map<string, number>()
  let updatedAt: Date | null = null

  for (const station of stations) {
    if (!updatedAt || station.updatedAt > updatedAt) updatedAt = station.updatedAt
    const brand = station.brand?.trim()
    if (brand) byBrand.set(brand, (byBrand.get(brand) ?? 0) + 1)
    for (const price of station.prices) {
      const bucket = byFuel.get(price.fuel)
      if (bucket) bucket.push(price.priceRub)
      else byFuel.set(price.fuel, [price.priceRub])
    }
  }

  const prices = FUEL_ORDER.flatMap((fuel) => {
    const values = byFuel.get(fuel)
    if (!values?.length) return []
    const sum = values.reduce((total, value) => total + value, 0)
    return [{
      fuel,
      label: FUEL_LABELS[fuel] || fuel,
      averageRub: sum / values.length / 100,
      minRub: Math.min(...values) / 100,
      maxRub: Math.max(...values) / 100,
      stations: values.length,
    }]
  })

  const brands = [...byBrand.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 8)
    .map(([brand, count]) => ({ brand, count }))

  return { city, stationCount: stations.length, prices, brands, updatedAt }
}

export async function generateMetadata({ params }: { params: Promise<{ city: string }> }): Promise<Metadata> {
  const { city: slug } = await params
  const city = cityFromSlug(slug)
  if (!city) {
    return buildSeoMetadata({
      title: "Карта АЗС",
      description: "Цены на топливо и наличие на заправках.",
      canonical: "/services/fuel-map",
    })
  }

  const summary = await loadCitySummary(city)
  const petrol = summary?.prices.find((row) => row.fuel === "AI92")
  /* Цена в описании выдачи — то, ради чего человек и кликает: «АИ-92 от
     62,80 ₽» отвечает на вопрос ещё до перехода на страницу. */
  const priceHint = petrol ? ` АИ-92 от ${petrol.minRub.toFixed(2).replace(".", ",")} ₽.` : ""
  const countHint = summary ? `${summary.stationCount} АЗС на карте` : "карта заправок"

  return buildSeoMetadata({
    title: `Цены на бензин в ${city} — ${countHint}`,
    description: `Актуальные цены на АИ-92, АИ-95, ДТ и газ на заправках ${city}.${priceHint} Наличие топлива по отметкам водителей.`,
    canonical: `/services/fuel-map/${slug}`,
    keywords: [
      `цены на бензин ${city}`,
      `АЗС ${city}`,
      `заправки ${city}`,
      `где заправиться ${city}`,
      `дизельное топливо ${city}`,
    ],
  })
}

function formatPrice(value: number) {
  return value.toFixed(2).replace(".", ",")
}

export default async function FuelCityPage({ params }: { params: Promise<{ city: string }> }) {
  const { city: slug } = await params
  const city = cityFromSlug(slug)
  if (!city || !CITY_COORDINATES[city]) notFound()

  const summary = await loadCitySummary(city)
  if (!summary) notFound()

  /* Разметка для поисковика: без неё цены остаются просто текстом, а с ней
     попадают в расширенный ответ выдачи. */
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: `Цены на топливо в ${city}`,
    description: `Цены на АИ-92, АИ-95, ДТ и газ на ${summary.stationCount} заправках города ${city}.`,
    dateModified: summary.updatedAt?.toISOString(),
    creator: { "@type": "Organization", name: "LeWheel" },
  }

  return (
    <Container size="lg" py="lg">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />

      <Stack gap="lg">
        <Box>
          <Title order={1} fz={{ base: 26, sm: 32 }}>Цены на бензин в {city}</Title>
          <Text c="dimmed" mt="xs">
            {summary.stationCount} заправок на карте. Цены собраны из открытых источников
            и уточняются отметками водителей — тех, кто прямо сейчас стоит у колонки.
          </Text>
        </Box>

        {summary.prices.length > 0 && (
          <Box>
            <Title order={2} fz={20} mb="sm">Средние цены на топливо</Title>
            <Table striped withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Топливо</Table.Th>
                  <Table.Th>Средняя</Table.Th>
                  <Table.Th>Минимум</Table.Th>
                  <Table.Th>Максимум</Table.Th>
                  <Table.Th>АЗС</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {summary.prices.map((row) => (
                  <Table.Tr key={row.fuel}>
                    <Table.Td><Text fw={600}>{row.label}</Text></Table.Td>
                    <Table.Td>{formatPrice(row.averageRub)} ₽</Table.Td>
                    <Table.Td>{formatPrice(row.minRub)} ₽</Table.Td>
                    <Table.Td>{formatPrice(row.maxRub)} ₽</Table.Td>
                    <Table.Td>{row.stations}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Box>
        )}

        {summary.brands.length > 0 && (
          <Box>
            <Title order={2} fz={20} mb="sm">Сети АЗС в городе</Title>
            <Group gap="xs" wrap="wrap">
              {summary.brands.map((row) => (
                <Text key={row.brand} size="sm" c="dimmed">
                  {row.brand} — {row.count} АЗС
                </Text>
              ))}
            </Group>
          </Box>
        )}

        <Box>
          <Link href={`/services/fuel-map?city=${encodeURIComponent(city)}`}>
            Открыть карту заправок {city} →
          </Link>
        </Box>

        <Text size="xs" c="dimmed">
          Цены носят справочный характер и могут отличаться от табло на заправке.
          Точнее всего их знают водители: отметьте цену на карте, если заметили расхождение.
        </Text>
      </Stack>
    </Container>
  )
}
