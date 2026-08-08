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
]

export default function AuctionsPage() {
  const [page, setPage] = useState(1)
  const [country, setCountry] = useState("")
  const [source, setSource] = useState("")
  const [make, setMake] = useState("")
  const [priceFrom, setPriceFrom] = useState("")
  const [priceTo, setPriceTo] = useState("")

  const buildQ = () => {
    const q = new URLSearchParams()
    q.set("page", String(page))
    q.set("limit", "24")
    if (country) q.set("country", country)
    if (source) q.set("source", source)
    if (make) q.set("make", make)
    if (priceFrom) q.set("priceFrom", priceFrom)
    if (priceTo) q.set("priceTo", priceTo)
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
            <TextInput placeholder="Марка" value={make} onChange={(e) => setMake(e.target.value)} size="xs" w={120} />
            <TextInput placeholder="Цена от ₽" value={priceFrom} onChange={(e) => setPriceFrom(e.target.value)} size="xs" w={100} type="number" />
            <TextInput placeholder="до ₽" value={priceTo} onChange={(e) => setPriceTo(e.target.value)} size="xs" w={100} type="number" />
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
                    <Group gap="xs" mb={6}>
                      <Text size="xs" c="gray.5">{l.year} г.</Text>
                      {l.mileage && <Text size="xs" c="gray.5">· {l.mileage.toLocaleString("ru")} км</Text>}
                    </Group>
                    <Text fw={800} fz="md" c="orange" ff="var(--font-display),sans-serif">{formatPriceShort(l.finalPrice)}</Text>
                    <Text size="10px" c="gray.4">с доставкой под ключ</Text>
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
