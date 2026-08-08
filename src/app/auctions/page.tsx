"use client"
export const dynamic = "force-dynamic"
import { useState } from "react"
import useSWR from "swr"
import Link from "next/link"
import { Container, Stack, Group, Text, Paper, Select, TextInput, SimpleGrid, Center, Loader, Badge, ThemeIcon, Chip, SegmentedControl } from "@mantine/core"
import { IconGavel, IconSearch, IconMapPin, IconCalendar, IconGauge, IconCar } from "@tabler/icons-react"
import { formatPriceShort } from "@/lib/format"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

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
  { value: "USS", label: "USS (Япония)" },
  { value: "TAA", label: "TAA (Япония)" },
  { value: "EMARAAT", label: "Emaraat (Корея)" },
  { value: "AJ", label: "AJ (Корея)" },
  { value: "COPART", label: "Copart (США)" },
  { value: "IAAI", label: "IAAI (США)" },
  { value: "MOBILE_DE", label: "Mobile.de (Европа)" },
  { value: "YCHEZHAI", label: "YCheZhai (Китай)" },
  { value: "GUAZI", label: "Guazi (Китай)" },
  { value: "TAOCHE", label: "Taoche (Китай)" },
  { value: "UCAR", label: "Ucar (Китай)" },
]

export default function AuctionsPage() {
  const [page, setPage] = useState(1)
  const [country, setCountry] = useState("")
  const [source, setSource] = useState("")
  const [make, setMake] = useState("")
  const [priceFrom, setPriceFrom] = useState("")
  const [priceTo, setPriceTo] = useState("")
  const [bodyType, setBodyType] = useState("")
  const [yearFrom, setYearFrom] = useState("")

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

  const { data, isLoading } = useSWR("/api/auctions?" + buildQ(), fetcher)
  const listings = data?.listings || []

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

        <Paper radius="md" p="sm" withBorder>
          <Group gap="xs" wrap="wrap" align="flex-end">
            <Select label="Страна" data={COUNTRIES} value={country} onChange={setCountry} size="xs" w={130} />
            <Select label="Площадка" data={SOURCES} value={source} onChange={setSource} size="xs" w={170} />
            <Select
                placeholder="Марка"
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
                onChange={setMake}
                size="xs"
                w={140}
              />
            <TextInput placeholder="Цена от ₽" value={priceFrom} onChange={(e) => setPriceFrom(e.target.value)} size="xs" w={100} type="number" />
            <TextInput placeholder="до ₽" value={priceTo} onChange={(e) => setPriceTo(e.target.value)} size="xs" w={100} type="number" />
              <Select
                placeholder="Кузов"
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
                onChange={setBodyType}
                size="xs"
                w={120}
              />
              <Select
                placeholder="Год от"
                clearable
                data={Array.from({length: 15}, (_, i) => ({ value: String(2025 - i), label: String(2025 - i) }))}
                value={yearFrom || null}
                onChange={setYearFrom}
                size="xs"
                w={90}
              />
          </Group>
        </Paper>

        {isLoading ? (
          <Center py={60}><Loader size="sm" color="orange" /></Center>
        ) : listings.length === 0 ? (
          <Paper radius="md" p="xl" withBorder><Center><Text c="gray.5">Нет авто по фильтрам</Text></Center></Paper>
        ) : (
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="sm">
            {listings.map((l: any) => (
              <Link key={l.id} href={`/auctions/${l.id}`} style={{ textDecoration: "none" }}>
                <Paper radius="md" withBorder style={{ overflow: "hidden", borderColor: "var(--mantine-color-border)", transition: "all 200ms", cursor: "pointer" }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#fb923c" }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--mantine-color-border)" }}>
                  <Box style={{ position: "relative", background: "var(--mantine-color-gray-1)", aspectRatio: "4/3" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={l.imageUrl || "/placeholder.svg"} alt={l.make} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <Badge pos="absolute" top={8} left={8} color="orange" variant="filled" size="sm">{l.source}</Badge>
                    <Badge pos="absolute" top={8} right={8} color="dark" variant="filled" size="sm">
                      {l.country === "JP" ? "🇯🇵" : l.country === "KR" ? "🇰🇷" : l.country === "US" ? "🇺🇸" : l.country === "DE" ? "🇩🇪" : l.country}
                    </Badge>
                  </Box>
                  <Box p="sm">
                    <Text fw={700} fz="sm" c="dark.9" mb={4}>{l.make} {l.model}</Text>
                    <Group gap="xs" mb={4}>
                      <Text size="xs" c="gray.5">{l.year} г.</Text>
                      {l.mileage != null && <Text size="xs" c="gray.5">· {l.mileage.toLocaleString("ru")} км</Text>}
                    </Group>
                    <Group gap={4} mb={6}>
                      {l.fuelType && <Badge size="xs" variant="light" color={l.fuelType === "ELECTRIC" ? "green" : l.fuelType === "HYBRID" ? "teal" : "gray"}>{l.fuelType === "ELECTRIC" ? "⚡ Электро" : l.fuelType === "HYBRID" ? "🔋 Гибрид" : l.fuelType === "DIESEL" ? "⛽ Дизель" : "⛽ Бензин"}</Badge>}
                      {l.bodyType && <Badge size="xs" variant="light" color="indigo">{l.bodyType === "SUV" ? "SUV" : l.bodyType === "SEDAN" ? "Седан" : l.bodyType === "PICKUP" ? "Пикап" : l.bodyType === "WAGON" ? "Универсал" : l.bodyType === "HATCHBACK" ? "Хэтчбек" : l.bodyType}</Badge>}
                      {l.engineVolume && <Text size="10px" c="gray.4">{l.engineVolume} л</Text>}
                      {l.power && <Text size="10px" c="gray.4">· {l.power} л.с.</Text>}
                    </Group>
                    <Text fw={800} fz="md" c="orange" ff="var(--font-display),sans-serif">{formatPriceShort(l.finalPrice)}</Text>
                    <Text size="10px" c="gray.4">с доставкой под ключ</Text>
                    {l.auctionDate && (
                      <Group gap={4} mt={4} pt={4} style={{ borderTop: "1px solid var(--mantine-color-border)" }}>
                        <Text size="10px" fw={600} c={new Date(l.auctionDate) > new Date() ? "#059669" : "#a1a1aa"}>
                          {new Date(l.auctionDate) > new Date() ? "Торги: " : "Торги были: "}
                        </Text>
                        <Text size="10px" c="gray.5">
                          {new Date(l.auctionDate).toLocaleDateString("ru", { day: "numeric", month: "short" })}
                        </Text>
                        {l.lotNumber && <Text size="10px" c="gray.4">· #{l.lotNumber}</Text>}
                      </Group>
                    )}
                  </Box>
                </Paper>
              </Link>
            ))}
          </SimpleGrid>
        )}

        {data && data.pagination.pages > 1 && (
          <Group justify="center">
            <SegmentedControl
              value={String(page)}
              onChange={(v) => setPage(Number(v))}
              data={Array.from({ length: Math.min(data.pagination.pages, 5) }, (_, i) => ({ label: String(i + 1), value: String(i + 1) }))}
            />
          </Group>
        )}
      </Stack>
    </Container>
  )
}

import { Box } from "@mantine/core"
