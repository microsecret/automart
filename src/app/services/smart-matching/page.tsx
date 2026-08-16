"use client"
export const dynamic = "force-dynamic"
import { useState } from "react"
import useSWR from "swr"
import Link from "next/link"
import { Box, Stack, Text, Paper, Select, NumberInput, Button, Group, ThemeIcon, Center, Loader, Divider, Badge, SimpleGrid } from "@mantine/core"
import { IconTarget, IconSparkles, IconCar } from "@tabler/icons-react"
import { formatPriceShort, formatMileage, parseImages } from "@/lib/format"
import BrandIcon from "@/components/brands/BrandIcon"
import { BODY_TYPES, FUEL_TYPES, TRANSMISSIONS } from "@/lib/constants"
import { fetchJson } from "@/lib/api-client"
import { AsyncErrorState } from "@/components/ui/AsyncStates"
import VehicleFallback from "@/components/listings/VehicleFallback"

const fetcher = fetchJson

type SmartMatchingResponse = {
  listings: Array<{
    id: string
    title: string
    price: number | null
    vehicle?: {
      id: string
      make: string
      bodyType?: string | null
      fuelType?: string | null
      transmission?: string | null
      vehicleType?: string | null
      images?: string | null
      year?: number | null
      mileage?: number | null
      location?: string | null
    } | null
  }>
}

export default function SmartmatchingPage() {
  const [budget, setBudget] = useState(3000000)
  const [bodyType, setBodyType] = useState("SUV")
  const [fuel, setFuel] = useState("GASOLINE")
  const [transmission, setTransmission] = useState("AUTOMATIC")
  const [submitted, setSubmitted] = useState(false)

  const query = submitted
    ? `/api/listings?type=vehicle&vehicleType=CAR&priceTo=${budget}&bodyType=${bodyType}&fuelType=${fuel}&transmission=${transmission}&sort=price_asc&limit=3`
    : null
  const { data, error, isLoading, mutate } = useSWR<SmartMatchingResponse>(query, fetcher)

  const results = data?.listings || []

  return (
    <Box p={{ base: "sm", md: "md" }} style={{ maxWidth: 800, margin: "0 auto" }}>
      <Stack gap="md">
        <Group gap="sm" align="center">
          <ThemeIcon variant="light" color="violet" size={44} radius="md"><IconTarget size={22} /></ThemeIcon>
          <Stack gap={0}>
            <Text component="h1" fw={800} fz={22} c="dark.9" ff="var(--font-display),sans-serif">Умный подбор авто</Text>
            <Text size="xs" c="gray.5">Подберём лучшие варианты под ваш бюджет и критерии</Text>
          </Stack>
        </Group>

        <Paper withBorder radius="md" p="lg">
          <Stack gap="md">
            <NumberInput label="Бюджет, ₽" value={budget} onChange={(v) => setBudget(Number(v) || 0)} size="sm" min={100000} step={100000} />
            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
              <Select label="Кузов" data={BODY_TYPES.map((b) => ({ value: b.value, label: b.label }))} value={bodyType} onChange={(value) => setBodyType(value || "SUV")} size="sm" />
              <Select label="Двигатель" data={FUEL_TYPES.map((f) => ({ value: f.value, label: f.label }))} value={fuel} onChange={(value) => setFuel(value || "GASOLINE")} size="sm" />
              <Select label="КПП" data={TRANSMISSIONS.map((t) => ({ value: t.value, label: t.label }))} value={transmission} onChange={(value) => setTransmission(value || "AUTOMATIC")} size="sm" />
            </SimpleGrid>
            <Button onClick={() => setSubmitted(true)} color="violet" radius="md" size="md" leftSection={<IconSparkles size={18} />}>Подобрать автомобиль</Button>
          </Stack>
        </Paper>

        {submitted && (
          <Stack gap="md">
            <Group gap="sm" align="center">
              <ThemeIcon variant="light" color="violet" size={32} radius="md"><IconSparkles size={18} /></ThemeIcon>
              <Text fw={700} fz="md" c="dark.9">Рекомендации для вас</Text>
              {!isLoading && <Badge size="sm" color="violet" variant="light">{results.length} совпадений</Badge>}
            </Group>

            {isLoading ? (
              <Center py={40}><Loader size="sm" color="violet" /></Center>
            ) : error ? (
              <AsyncErrorState
                title="Не удалось подобрать автомобили"
                description="Проверьте параметры и повторите поиск — данные каталога временно недоступны."
                onRetry={() => void mutate()}
              />
            ) : results.length === 0 ? (
              <Paper radius="md" p="xl" withBorder>
                <Center>
                  <Stack align="center" gap="sm">
                    <IconCar size={40} color="gray.4" />
                    <Text c="gray.5">Ничего не найдено. Попробуйте увеличить бюджет или изменить критерии.</Text>
                  </Stack>
                </Center>
              </Paper>
            ) : (
              <Stack gap="sm">
                {results.map((l, i) => {
                  const v = l.vehicle
                  const images = parseImages(v?.images)
                  const image = images[0] || ""
                  return (
                    <Paper key={l.id} radius="md" p="md" withBorder style={{ borderColor: i === 0 ? "#7c3aed" : "#f4f4f5", background: i === 0 ? "#faf5ff" : "#fff" }}>
                      <Group gap="md" align="flex-start" wrap="nowrap">
                        <Box style={{ position: "relative", flexShrink: 0 }}>
                          <Box style={{ width: 120, height: 90, borderRadius: 8, overflow: "hidden", background: "var(--mantine-color-gray-1)", position: "relative" }}>
                            <VehicleFallback type={v?.vehicleType || "CAR"} bodyType={v?.bodyType} compact />
                            {image && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={image} alt={l.title} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} onError={(event) => { event.currentTarget.style.display = "none" }} />
                            )}
                          </Box>
                          {i === 0 && <Badge pos="absolute" top={-8} left={-8} color="violet" variant="filled" size="xs" circle><IconSparkles size={10} /></Badge>}
                        </Box>
                        <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
                          <Group gap="sm" align="center">
                            {v && <BrandIcon brand={v.make} size={28} />}
                            <Link href={`/listings/vehicle/${v?.id}`} style={{ textDecoration: "none" }}>
                              <Text fw={700} fz="sm" c="dark.9">{l.title}</Text>
                            </Link>
                          </Group>
                          <Text fz="xs" c="gray.5">{v ? `${v.year} г. · ${formatMileage(v.mileage)} · ${v.location || "—"}` : ""}</Text>
                          <Group gap="sm" mt={2}>
                            <Text fw={800} fz="lg" c="dark.9" ff="var(--font-display),sans-serif">{formatPriceShort(l.price)}</Text>
                            <Badge size="xs" color="green" variant="light">Подходит по 4 критериям</Badge>
                          </Group>
                        </Stack>
                        <Button component={Link} href={v ? `/listings/vehicle/${v.id}` : "/"} variant="light" color="violet" size="xs" radius="md">Открыть</Button>
                      </Group>
                    </Paper>
                  )
                })}
                <Divider my="xs" />
                <Button component={Link} href={`/category/cars`} variant="subtle" color="violet" size="sm">Смотреть все варианты →</Button>
              </Stack>
            )}
          </Stack>
        )}
      </Stack>
    </Box>
  )
}
