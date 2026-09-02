"use client"

import Link from "next/link"
import { ActionIcon, Badge, Box, Button, Center, Group, Paper, SimpleGrid, Stack, Text, ThemeIcon } from "@mantine/core"
import { IconArrowRight, IconCar, IconChecklist, IconEdit, IconPlus, IconTrash } from "@tabler/icons-react"
import BrandIcon from "@/components/brands/BrandIcon"
import VehicleFallback from "@/components/listings/VehicleFallback"
import { AsyncErrorState, ResultsGridSkeleton } from "@/components/ui/AsyncStates"
import { BODY_TYPES, findLabel, FUEL_TYPES, TRANSMISSIONS } from "@/lib/constants"
import { formatMileage, parseImages } from "@/lib/format"

export type GarageVehicle = {
  id: string
  make: string
  model: string
  year: number
  mileage: number | null
  fuelType: string
  transmission: string
  bodyType: string | null
  color: string | null
  condition: string
  location: string
  images: string | null
  createdAt: string
  publicationReadiness: {
    total: number
    completed: number
    ready: boolean
    missing: Array<{ field: string; label: string; unit?: string }>
  }
}

export type GarageResponse = { vehicles: GarageVehicle[] }

type GaragePanelProps = {
  data?: GarageResponse
  error: unknown
  isLoading: boolean
  deletingId: string | null
  onRetry: () => void
  onRequestDelete: (vehicle: GarageVehicle) => void
}

export default function GaragePanel({ data, error, isLoading, deletingId, onRetry, onRequestDelete }: GaragePanelProps) {
  return (
    <Paper className="dashboard-garage" radius="md" p={{ base: "md", md: "lg" }} withBorder>
      <Group justify="space-between" align="flex-start" mb="md" gap="md" wrap="wrap">
        <Group gap="sm" align="center">
          <ThemeIcon variant="light" color="teal" size={42} radius="md"><IconCar size={21} /></ThemeIcon>
          <Stack gap={1}>
            <Text fw={800} fz="lg" c="var(--market-ink)" ff="var(--font-display),sans-serif">Личный гараж</Text>
            <Text size="sm" c="dimmed">Ваши автомобили не публикуются в каталоге и доступны только вам.</Text>
          </Stack>
        </Group>
        <Button component={Link} href="/listings/create/vehicle?mode=garage" color="teal" size="sm" leftSection={<IconPlus size={16} />}>Добавить автомобиль</Button>
      </Group>

      {isLoading ? (
        <ResultsGridSkeleton count={3} mediaHeight={96} />
      ) : error ? (
        <AsyncErrorState title="Не удалось открыть гараж" description="Список автомобилей временно недоступен. Повторите запрос." onRetry={onRetry} />
      ) : data?.vehicles.length ? (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
          {data.vehicles.map((vehicle) => {
            const vehicleImages = parseImages(vehicle.images)
            const vehicleImage = vehicleImages[0]
            const readiness = vehicle.publicationReadiness
            const missingLabels = readiness.missing.map((item) => item.label)
            return (
              <Paper key={vehicle.id} className="garage-vehicle-card" radius="md" withBorder style={{ overflow: "hidden" }}>
                <Box className="garage-vehicle-card__media">
                  {vehicleImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={vehicleImage} alt={`${vehicle.make} ${vehicle.model}`} loading="lazy" />
                  ) : <VehicleFallback type="CAR" bodyType={vehicle.bodyType} compact />}
                  <Box className="garage-vehicle-card__brand"><BrandIcon brand={vehicle.make} size={30} /></Box>
                </Box>
                <Stack gap={8} p="sm">
                  <Group justify="space-between" gap="xs" wrap="nowrap">
                    <Stack gap={1} style={{ minWidth: 0 }}>
                      <Text fw={800} fz="sm" c="var(--market-ink)" truncate>{vehicle.make} {vehicle.model}</Text>
                      <Text size="xs" c="dimmed">{vehicle.year} г.{vehicle.mileage != null ? ` · ${formatMileage(vehicle.mileage)}` : ""}</Text>
                    </Stack>
                    <Badge color="teal" variant="light" radius="xl" size="sm">Личный</Badge>
                  </Group>
                  <Group gap={5} wrap="wrap">
                    {vehicle.bodyType && <Badge color="gray" variant="light" size="xs">{findLabel(BODY_TYPES, vehicle.bodyType)}</Badge>}
                    <Badge color="indigo" variant="light" size="xs">{findLabel(FUEL_TYPES, vehicle.fuelType)}</Badge>
                    <Badge color="violet" variant="light" size="xs">{findLabel(TRANSMISSIONS, vehicle.transmission)}</Badge>
                    {vehicle.color && <Badge color="gray" variant="outline" size="xs">{vehicle.color}</Badge>}
                  </Group>
                  <Box className="garage-vehicle-card__readiness" data-ready={readiness.ready || undefined}>
                    <Group justify="space-between" align="center" gap="xs" wrap="nowrap">
                      <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
                        <IconChecklist size={16} aria-hidden="true" />
                        <Text size="xs" fw={700} c="var(--market-ink)" truncate>
                          Для объявления заполнено {readiness.completed} из {readiness.total}
                        </Text>
                      </Group>
                      <Badge color={readiness.ready ? "teal" : "orange"} variant="light" size="xs" radius="sm">
                        {readiness.ready ? "Готово" : `Осталось ${readiness.missing.length}`}
                      </Badge>
                    </Group>
                    {!readiness.ready && (
                      <Text size="11px" c="var(--market-muted)" mt={4} lineClamp={2}>
                        Добавьте: {missingLabels.slice(0, 3).join(", ")}{missingLabels.length > 3 ? ` и ещё ${missingLabels.length - 3}` : ""}
                      </Text>
                    )}
                  </Box>
                  <Group justify="space-between" align="center" mt={2}>
                    <Text size="xs" c="gray.5" truncate>{vehicle.location || "Город не указан"}</Text>
                    <Group gap={2} wrap="nowrap">
                      <ActionIcon component={Link} href={`/listings/create/vehicle?mode=garage&garageId=${encodeURIComponent(vehicle.id)}`} color="indigo" variant="subtle" size="sm" aria-label={`Редактировать ${vehicle.make} ${vehicle.model}`}>
                        <IconEdit size={16} />
                      </ActionIcon>
                      <ActionIcon color="red" variant="subtle" size="sm" aria-label={`Удалить ${vehicle.make} ${vehicle.model} из гаража`} loading={deletingId === vehicle.id} onClick={() => onRequestDelete(vehicle)}>
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                  </Group>
                  <Button component={Link} href={`/listings/create/vehicle?garageId=${encodeURIComponent(vehicle.id)}`} variant="light" color="teal" size="xs" fullWidth rightSection={<IconArrowRight size={14} />}>Продолжить объявление</Button>
                </Stack>
              </Paper>
            )
          })}
        </SimpleGrid>
      ) : (
        <Center py={{ base: "xl", md: 56 }}>
          <Stack align="center" gap="sm" maw={420} ta="center">
            <ThemeIcon variant="light" color="teal" size={54} radius="xl"><IconCar size={27} /></ThemeIcon>
            <Text fw={700} fz="lg">В гараже пока нет автомобилей</Text>
            <Text size="sm" c="dimmed">Добавьте свою машину, чтобы хранить данные приватно. Когда понадобится, создайте из неё объявление без повторного ввода.</Text>
            <Button component={Link} href="/listings/create/vehicle?mode=garage" color="teal" size="sm" leftSection={<IconPlus size={16} />}>Добавить первый автомобиль</Button>
          </Stack>
        </Center>
      )}
    </Paper>
  )
}
