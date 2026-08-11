import { Box, ThemeIcon } from "@mantine/core"
import { IconCar, IconHelicopter, IconMotorbike, IconPlane, IconSailboat, IconTools, IconTractor, IconTruck } from "@tabler/icons-react"

type VehicleKind = "CAR" | "MOTORCYCLE" | "TRUCK" | "SPECIAL" | "WATER" | "AIR" | "PART" | string | null | undefined

const FALLBACKS = {
  CAR: { label: "Автомобиль", Icon: IconCar, color: "indigo" },
  MOTORCYCLE: { label: "Мотоцикл", Icon: IconMotorbike, color: "violet" },
  TRUCK: { label: "Грузовой транспорт", Icon: IconTruck, color: "orange" },
  SPECIAL: { label: "Спецтехника", Icon: IconTractor, color: "yellow" },
  WATER: { label: "Водный транспорт", Icon: IconSailboat, color: "cyan" },
  AIR: { label: "Воздушный транспорт", Icon: IconPlane, color: "blue" },
  PART: { label: "Запчасть", Icon: IconTools, color: "indigo" },
} as const

export function vehicleTypeLabel(type: VehicleKind, bodyType?: string | null) {
  if (type === "AIR" && bodyType === "HELICOPTER") return "Вертолёт"
  return FALLBACKS[type as keyof typeof FALLBACKS]?.label || "Транспорт"
}

export default function VehicleFallback({ type, bodyType, compact = false }: { type: VehicleKind; bodyType?: string | null; compact?: boolean }) {
  const item = FALLBACKS[type as keyof typeof FALLBACKS] || FALLBACKS.CAR
  const Icon = type === "AIR" && bodyType === "HELICOPTER" ? IconHelicopter : item.Icon

  return (
    <Box
      className={`vehicle-fallback vehicle-fallback--${String(type || "CAR").toLowerCase()}`}
      data-compact={compact || undefined}
      data-kind={type === "AIR" && bodyType === "HELICOPTER" ? "helicopter" : String(type || "CAR").toLowerCase()}
      aria-label={`Фото не добавлено: ${vehicleTypeLabel(type, bodyType)}`}
      role="img"
    >
      <Box className="vehicle-fallback__glow" aria-hidden="true" />
      <Box className="vehicle-fallback__beam vehicle-fallback__beam--one" aria-hidden="true" />
      <Box className="vehicle-fallback__beam vehicle-fallback__beam--two" aria-hidden="true" />
      <Box className="vehicle-fallback__halo" aria-hidden="true" />
      <ThemeIcon variant="light" color={item.color} radius="xl" size={compact ? 38 : 54}>
        <Icon size={compact ? 21 : 30} stroke={1.6} />
      </ThemeIcon>
    </Box>
  )
}
