"use client"

import { useEffect, useState } from "react"
import useSWR from "swr"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { Alert, Box, Button, Group, Loader, Paper, Select, Stack, Text, ThemeIcon, Timeline } from "@mantine/core"
import { IconCar, IconCheck, IconClock, IconHistory, IconInfoCircle, IconShieldCheck } from "@tabler/icons-react"
import { fetchJson } from "@/lib/api-client"

type OwnedVehicle = { id: string; make: string; model: string; year: number; mileage: number | null; location: string }
type VehiclesResponse = { vehicles: OwnedVehicle[] }
type HistoryRequestResponse = { request: { id: string; status: string; createdAt: string }; message: string }

export default function HistoryCheckPage() {
  const { status } = useSession()
  const { data, error, isLoading } = useSWR<VehiclesResponse>(status === "authenticated" ? "/api/vehicles" : null, fetchJson)
  const [vehicleId, setVehicleId] = useState<string | null>(null)
  const [request, setRequest] = useState<HistoryRequestResponse | null>(null)
  const [requestError, setRequestError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!vehicleId && data?.vehicles[0]) setVehicleId(data.vehicles[0].id)
  }, [data?.vehicles, vehicleId])

  const createRequest = async () => {
    if (!vehicleId) return
    setSubmitting(true)
    setRequestError(null)
    setRequest(null)
    try {
      const response = await fetch("/api/ai/history-check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ vehicleId }) })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(typeof payload?.error === "string" ? payload.error : "Не удалось сохранить заявку")
      setRequest(payload as HistoryRequestResponse)
    } catch (requestError) {
      setRequestError(requestError instanceof Error ? requestError.message : "Не удалось сохранить заявку")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Box p={{ base: "sm", md: "md" }} maw={720} mx="auto">
      <Stack gap="md">
        <Group gap="sm" align="center"><ThemeIcon variant="light" color="green" size={44} radius="md"><IconHistory size={22} /></ThemeIcon><Stack gap={0}><Text component="h1" fw={800} fz={22} c="dark.9" ff="var(--font-display),sans-serif">Проверка истории</Text><Text size="xs" c="gray.5">Заявка на проверку собственных автомобилей с прозрачным статусом</Text></Stack></Group>

        <Alert icon={<IconInfoCircle size={16} />} color="orange" radius="md" variant="light">Площадка пока не подключена к государственным и коммерческим реестрам. Мы не показываем вымышленные ДТП, ограничения или пробег: заявка сохранится и будет обработана только после подключения проверенного поставщика данных.</Alert>

        {status === "unauthenticated" ? (
          <Paper withBorder radius="lg" p="xl"><Stack align="center" gap="sm"><ThemeIcon size={52} radius="xl" variant="light" color="green"><IconCar size={25} /></ThemeIcon><Text fw={700}>Войдите, чтобы создать заявку</Text><Text size="sm" c="dimmed" ta="center">Проверки доступны владельцу автомобиля, чтобы VIN и результаты не раскрывались посторонним.</Text><Button component={Link} href="/auth/signin?callbackUrl=%2Fservices%2Fhistory-check" color="green">Войти</Button></Stack></Paper>
        ) : status === "loading" || isLoading ? (
          <Paper withBorder radius="lg" p="xl"><Group justify="center"><Loader color="green" size="sm" /><Text size="sm" c="dimmed">Загружаем ваши автомобили…</Text></Group></Paper>
        ) : error ? (
          <Alert color="red" radius="md">Не удалось загрузить ваши автомобили. Обновите страницу и повторите попытку.</Alert>
        ) : !data || data.vehicles.length === 0 ? (
          <Paper withBorder radius="lg" p="xl"><Stack align="center" gap="sm"><ThemeIcon size={52} radius="xl" variant="light" color="green"><IconCar size={25} /></ThemeIcon><Text fw={700}>Нет автомобиля для проверки</Text><Text size="sm" c="dimmed" ta="center">Добавьте легковой автомобиль в объявление или личный гараж.</Text><Button component={Link} href="/listings/create/vehicle" color="green">Разместить объявление</Button></Stack></Paper>
        ) : (
          <Paper withBorder radius="lg" p="lg"><Stack gap="md"><Select label="Ваш автомобиль" value={vehicleId} onChange={setVehicleId} data={data.vehicles.map((vehicle) => ({ value: vehicle.id, label: `${vehicle.make} ${vehicle.model}, ${vehicle.year}` }))} /><Button onClick={createRequest} loading={submitting} disabled={!vehicleId} color="green" radius="md" size="md" leftSection={<IconShieldCheck size={18} />}>Создать заявку на проверку</Button></Stack></Paper>
        )}

        {requestError && <Alert color="red" radius="md">{requestError}</Alert>}
        {request && <Paper withBorder radius="lg" p="lg" style={{ borderColor: "#bbf7d0", background: "#f0fdf4" }}><Stack gap="md"><Group gap="sm"><ThemeIcon size={38} radius="xl" color="green" variant="light"><IconCheck size={20} /></ThemeIcon><Stack gap={0}><Text fw={700} c="green.9">Заявка сохранена</Text><Text size="xs" c="green.8">Статус: ожидает подключения проверенного источника</Text></Stack></Group><Timeline bulletSize={22} lineWidth={2} color="green"><Timeline.Item bullet={<IconCheck size={13} />} title="Заявка создана"><Text size="xs" c="dimmed">{new Date(request.request.createdAt).toLocaleString("ru-RU")}</Text></Timeline.Item><Timeline.Item bullet={<IconClock size={13} />} title="Источник данных не подключён"><Text size="xs" c="dimmed">Мы не подменяем этот этап случайным результатом.</Text></Timeline.Item></Timeline><Text size="xs" c="dimmed">Номер заявки: {request.request.id}</Text></Stack></Paper>}
      </Stack>
    </Box>
  )
}
