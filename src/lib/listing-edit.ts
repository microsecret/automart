export type ListingEditInput = {
  title?: string
  description?: string | null
  price?: number
  location?: string
  images?: string[]
  reason?: string | null
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
  return urls.every((item) => {
    if (item.startsWith("/uploads/")) return true
    try {
      const url = new URL(item)
      return url.protocol === "https:" && !url.username && !url.password
    } catch {
      return false
    }
  }) ? urls : null
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
  if (hasOwn(input, "reason")) {
    if (input.reason !== null && typeof input.reason !== "string") return { error: "Причина должна быть текстом" }
    value.reason = typeof input.reason === "string" ? input.reason.trim().slice(0, 500) || null : null
  }

  if (Object.keys(value).filter((key) => key !== "reason").length === 0) {
    return { error: "Нет изменений для сохранения" }
  }
  return { value }
}
