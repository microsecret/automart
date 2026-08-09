export const VEHICLE_CATEGORY_NAMES = {
  CAR: "Легковые автомобили",
  MOTORCYCLE: "Мототехника",
  TRUCK: "Грузовой транспорт",
  SPECIAL: "Спецтехника",
  WATER: "Водный транспорт",
  AIR: "Воздушный транспорт",
} as const

export type MarketplaceVehicleType = keyof typeof VEHICLE_CATEGORY_NAMES

function normalizedName(name: string) {
  return name.trim().toLocaleLowerCase("ru-RU")
}

/**
 * Категории хранятся в БД как редакционные названия, а не как технические enum.
 * Один источник соответствия не даёт форме и API записать транспорт в чужой раздел.
 */
export function getVehicleTypeForCategoryName(name: string | null | undefined): MarketplaceVehicleType | null {
  if (!name) return null

  const value = normalizedName(name)
  if (value.includes("легков")) return "CAR"
  if (value.includes("мото")) return "MOTORCYCLE"
  if (value.includes("груз") || value.includes("коммерческ")) return "TRUCK"
  if (value.includes("спецтех")) return "SPECIAL"
  if (value.includes("водн") || value.includes("судн")) return "WATER"
  if (value.includes("воздуш") || value.includes("авиа")) return "AIR"
  return null
}

export function isVehicleCategoryCompatible(
  categoryName: string | null | undefined,
  vehicleType: string,
) {
  return getVehicleTypeForCategoryName(categoryName) === vehicleType
}
