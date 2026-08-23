import { isSafeMediaUrl } from "@/lib/media-url"

export type ListingEditInput = {
  title?: string
  description?: string | null
  price?: number
  location?: string
  images?: string[]
  reason?: string | null
  /* Характеристики машины.

     Раньше правка их не касалась, и владелец объявления, поданного до
     введения обязательных полей, не мог дозаполнить коробку или объём
     двигателя — исправить неполную карточку было нечем. */
  mileage?: number | null
  operatingHours?: number | null
  flightHours?: number | null
  fuelType?: string | null
  transmission?: string | null
  engineVolume?: number | null
  power?: number | null
  vin?: string | null
  serialNumber?: string | null
  registrationNumber?: string | null
  bodyType?: string | null
  driveType?: string | null
  color?: string | null
  condition?: string
  steeringWheel?: string | null
  ownersCount?: number | null
  documentsStatus?: string | null
  damageInfo?: string | null
  sellerType?: string | null
  availability?: string | null
  customsCleared?: boolean | null
  generation?: string | null
}

type ParseResult = { value?: ListingEditInput; error?: string }

function hasOwn(input: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(input, key)
}

export function parseStoredImages(value: string | null | undefined) {
  if (!value) return [] as string[]
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []
  } catch {
    return [] as string[]
  }
}

function parseImageUrls(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > 12) return null
  const unique = Array.from(new Set(value))
  if (unique.some((item) => typeof item !== "string" || item.length > 2_000)) return null

  const urls = unique as string[]
  return urls.every(isSafeMediaUrl) ? urls : null
}

/** Validates only the owner-editable common marketplace fields. */
export function parseListingEditInput(raw: unknown): ParseResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { error: "Некорректные данные" }
  const input = raw as Record<string, unknown>
  const value: ListingEditInput = {}

  if (hasOwn(input, "title")) {
    if (typeof input.title !== "string") return { error: "Заголовок должен быть текстом" }
    const title = input.title.trim()
    if (title.length < 3 || title.length > 200) return { error: "Заголовок должен содержать от 3 до 200 символов" }
    value.title = title
  }
  if (hasOwn(input, "description")) {
    if (input.description !== null && typeof input.description !== "string") return { error: "Описание должно быть текстом" }
    const description = typeof input.description === "string" ? input.description.trim() : null
    if (description && description.length > 5_000) return { error: "Описание не должно превышать 5000 символов" }
    value.description = description || null
  }
  if (hasOwn(input, "price")) {
    const price = Number(input.price)
    if (!Number.isSafeInteger(price) || price < 0) return { error: "Укажите корректную цену" }
    value.price = price
  }
  if (hasOwn(input, "location")) {
    if (typeof input.location !== "string") return { error: "Город должен быть текстом" }
    const location = input.location.trim()
    if (location.length < 2 || location.length > 120) return { error: "Укажите город от 2 до 120 символов" }
    value.location = location
  }
  if (hasOwn(input, "images")) {
    const images = parseImageUrls(input.images)
    if (!images) return { error: "Допустимы до 12 изображений из защищённого источника" }
    value.images = images
  }
  /* Числовые характеристики.

     Пустая строка и null означают «убрать значение» — владелец мог
     ошибиться при подаче. Ноль допустим для счётчиков пробега (новая
     техника действительно «0 км»), но не для объёма и мощности: ноль
     литров у двигателя невозможен. */
  const numericSpecs: Array<{ key: "mileage" | "operatingHours" | "flightHours" | "engineVolume" | "power" | "ownersCount"; label: string; max: number; allowZero: boolean }> = [
    { key: "mileage", label: "Пробег", max: 2_000_000, allowZero: true },
    { key: "operatingHours", label: "Наработка", max: 200_000, allowZero: true },
    { key: "flightHours", label: "Налёт", max: 200_000, allowZero: true },
    { key: "engineVolume", label: "Объём двигателя", max: 100, allowZero: false },
    { key: "power", label: "Мощность", max: 100_000, allowZero: false },
    { key: "ownersCount", label: "Количество владельцев", max: 100, allowZero: true },
  ]
  for (const spec of numericSpecs) {
    if (!hasOwn(input, spec.key)) continue
    const raw = input[spec.key]
    if (raw === null || raw === "") {
      value[spec.key] = null
      continue
    }
    const parsed = Number(raw)
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > spec.max) {
      return { error: `${spec.label}: недопустимое значение` }
    }
    if (!spec.allowZero && parsed === 0) {
      return { error: `${spec.label} не может быть нулевым` }
    }
    value[spec.key] = parsed
  }

  /* Топливо и коробка проверяются на длину, а не на принадлежность
     справочнику: набор значений зависит от вида транспорта, и он уже
     проверяется там, где известен этот вид. */
  for (const key of ["fuelType", "transmission", "condition"] as const) {
    if (!hasOwn(input, key)) continue
    const raw = input[key]
    if (raw === null || raw === "") return { error: "Обязательную характеристику нельзя оставить пустой" }
    if (typeof raw !== "string" || raw.length > 40) {
      return { error: "Недопустимое значение характеристики" }
    }
    value[key] = raw
  }

  const optionalTextSpecs = [
    { key: "vin", max: 17, uppercase: true },
    { key: "serialNumber", max: 32, uppercase: true },
    { key: "registrationNumber", max: 32, uppercase: true },
    { key: "bodyType", max: 40, uppercase: false },
    { key: "driveType", max: 20, uppercase: false },
    { key: "color", max: 40, uppercase: false },
    { key: "steeringWheel", max: 16, uppercase: false },
    { key: "documentsStatus", max: 24, uppercase: false },
    { key: "damageInfo", max: 24, uppercase: false },
    { key: "sellerType", max: 20, uppercase: false },
    { key: "availability", max: 24, uppercase: false },
    { key: "generation", max: 80, uppercase: false },
  ] as const
  for (const spec of optionalTextSpecs) {
    if (!hasOwn(input, spec.key)) continue
    const raw = input[spec.key]
    if (raw === null || raw === "") {
      value[spec.key] = null
      continue
    }
    if (typeof raw !== "string" || raw.length > spec.max) return { error: "Недопустимое значение характеристики" }
    const normalized = raw.trim()
    value[spec.key] = spec.uppercase ? normalized.toUpperCase() : normalized
  }

  if (hasOwn(input, "customsCleared")) {
    if (input.customsCleared !== null && typeof input.customsCleared !== "boolean") {
      return { error: "Таможенный статус должен быть выбран из списка" }
    }
    value.customsCleared = input.customsCleared as boolean | null
  }

  if (hasOwn(input, "reason")) {
    if (input.reason !== null && typeof input.reason !== "string") return { error: "Причина должна быть текстом" }
    value.reason = typeof input.reason === "string" ? input.reason.trim().slice(0, 500) || null : null
  }

  if (Object.keys(value).filter((key) => key !== "reason").length === 0) {
    return { error: "Нет изменений для сохранения" }
  }
  return { value }
}
