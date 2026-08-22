"use client"

import { useEffect, useState } from "react"
import useSWR from "swr"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { Alert, Box, Button, Group, Loader, Paper, Select, SimpleGrid, Stack, Text, ThemeIcon } from "@mantine/core"
import { IconCalculator, IconCar, IconInfoCircle, IconTrendingDown, IconTrendingUp } from "@tabler/icons-react"
import { formatPrice } from "@/lib/format"
import { fetchJson } from "@/lib/api-client"

type OwnedVehicle = {
  id: string
  make: string
  model: string
  year: number
  price: number
  mileage: number | null
  condition: string
  location: string
}

type VehiclesResponse = { vehicles: OwnedVehicle[] }
type ValuationResponse = {
  estimatedValue: number
  min: number
  max: number
  disclaimer: string
  factors: { ageFactor: number; mileageFactor: number; stateFactor: number }
}

function percentage(value: number) {
  return `${Math.round((value - 1) * 100)}%`
}

export default function ValuationPage() {
  const { status } = useSession()
  const { data, error, isLoading } = useSWR<VehiclesResponse>(status === "authenticated" ? "/api/vehicles" : null, fetchJson)
  const [vehicleId, setVehicleId] = useState<string | null>(null)
  const [result, setResult] = useState<ValuationResponse | null>(null)
  const [requestError, setRequestError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!vehicleId && data?.vehicles[0]) setVehicleId(data.vehicles[0].id)
  }, [data?.vehicles, vehicleId])

  const calculate = async () => {
    if (!vehicleId) return
    setSubmitting(true)
    setRequestError(null)
    setResult(null)
    try {
      const payload = await fetchJson<ValuationResponse>("/api/ai/valuation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicleId }),
      })
      setResult(payload)
    } catch (requestError) {
      setRequestError(requestError instanceof Error ? requestError.message : "Не удалось рассчитать оценку")
    } finally {
      setSubmitting(false)
    }
  }

  const selectedVehicle = data?.vehicles.find((vehicle) => vehicle.id === vehicleId)

  return (
    <Box p={{ base: "sm", md: "md" }} maw={720} mx="auto">
      <Stack gap="md">
        <Group gap="sm" align="center">
          <ThemeIcon variant="light" color="indigo" size={44} radius="md"><IconCalculator size={22} /></ThemeIcon>
          <Stack gap={0}>
            <Text component="h1" fw={800} fz={22} c="var(--market-ink)" ff="var(--font-display),sans-serif">Предварительная оценка</Text>
            <Text size="xs" c="gray.5">Прозрачный ориентир по данным вашего объявления — без ложных обещаний рыночной экспертизы</Text>
          </Stack>
        </Group>

        {status === "unauthenticated" ? (
          <Paper withBorder radius="lg" p="xl"><Stack align="center" gap="sm"><ThemeIcon size={52} radius="xl" variant="light" color="indigo"><IconCar size={25} /></ThemeIcon><Text fw={700}>Войдите, чтобы оценить свой автомобиль</Text><Text size="sm" c="dimmed" ta="center">Сервис работает только с вашими сохранёнными объявлениями или автомобилями в гараже.</Text><Button component={Link} href="/auth/signin?callbackUrl=%2Fservices%2Fvaluation" color="indigo">Войти</Button></Stack></Paper>
        ) : status === "loading" || isLoading ? (
          <Paper withBorder radius="lg" p="xl"><Group justify="center"><Loader color="indigo" size="sm" /><Text size="sm" c="dimmed">Загружаем ваши автомобили…</Text></Group></Paper>
        ) : error ? (
          <Alert color="red" radius="md">Не удалось загрузить ваши автомобили. Обновите страницу и повторите попытку.</Alert>
        ) : !data || data.vehicles.length === 0 ? (
          <Paper withBorder radius="lg" p="xl"><Stack align="center" gap="sm"><ThemeIcon size={52} radius="xl" variant="light" color="indigo"><IconCar size={25} /></ThemeIcon><Text fw={700}>Нет автомобиля для оценки</Text><Text size="sm" c="dimmed" ta="center">Сначала разместите легковой автомобиль или добавьте его в личный гараж.</Text><Button component={Link} href="/listings/create/vehicle" color="indigo">Разместить объявление</Button></Stack></Paper>
        ) : (
          <Paper withBorder radius="lg" p="lg">
            <Stack gap="md">
              <Select label="Ваш автомобиль" value={vehicleId} onChange={setVehicleId} data={data.vehicles.map((vehicle) => ({ value: vehicle.id, label: `${vehicle.make} ${vehicle.model}, ${vehicle.year}` }))} description={selectedVehicle ? `${selectedVehicle.mileage != null ? `${selectedVehicle.mileage.toLocaleString("ru-RU")} км` : "Пробег не указан"} · ${selectedVehicle.location || "город не указан"}` : undefined} />
              <Button onClick={calculate} loading={submitting} disabled={!vehicleId} color="indigo" radius="md" size="md" leftSection={<IconCalculator size={18} />}>Рассчитать ориентир</Button>
            </Stack>
          </Paper>
        )}

        {requestError && <Alert color="red" radius="md">{requestError}</Alert>}

        {result && (
          <Stack gap="md">
            <Paper radius="lg" p="xl" withBorder style={{ background: "linear-gradient(135deg, #eef2fb 0%, #fff 100%)", borderColor: "#b9caee" }}>
              <Stack gap="sm" align="center">
                <Text size="xs" c="gray.5" tt="uppercase" fw={700}>Предварительный ориентир</Text>
                <Text fz="2.2rem" fw={800} c="#1c4291" ff="var(--font-display),sans-serif" lh={1}>{formatPrice(result.estimatedValue)}</Text>
                <Group gap="xl">
                  <Stack gap={0} align="center"><Group gap={4}><IconTrendingDown size={14} color="#e11d48" /><Text size="xs" c="gray.5">Нижняя граница</Text></Group><Text fw={700} fz="md" c="#e11d48">{formatPrice(result.min)}</Text></Stack>
                  <Stack gap={0} align="center"><Group gap={4}><IconTrendingUp size={14} color="#059669" /><Text size="xs" c="gray.5">Верхняя граница</Text></Group><Text fw={700} fz="md" c="#059669">{formatPrice(result.max)}</Text></Stack>
                </Group>
              </Stack>
            </Paper>
            <Paper radius="lg" p="md" withBorder><SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm"><Factor label="Возраст" value={percentage(result.factors.ageFactor)} /><Factor label="Пробег" value={percentage(result.factors.mileageFactor)} /><Factor label="Состояние" value={percentage(result.factors.stateFactor)} /></SimpleGrid></Paper>
            <Alert icon={<IconInfoCircle size={16} />} color="gray" radius="md" variant="light">{result.disclaimer}</Alert>
          </Stack>
        )}
      </Stack>
    </Box>
  )
}

function Factor({ label, value }: { label: string; value: string }) {
  return <Stack gap={2}><Text size="xs" c="gray.5">{label}</Text><Text fw={700} c="var(--market-ink)">{value}</Text></Stack>
}
