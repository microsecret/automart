/** Форматирование цены в рублях */
export function formatPrice(price: number | null | undefined): string {
  if (price == null) return "Договорная"
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(price)
}

/** Краткая цена: 4.5 млн ₽ вместо 4 500 000 ₽ */
export function formatPriceShort(price: number | null | undefined): string {
  if (price == null) return "Договорная"
  if (price >= 1_000_000) {
    const mln = price / 1_000_000
    return `${mln % 1 === 0 ? mln.toFixed(0) : mln.toFixed(1).replace(".", ",")} млн ₽`
  }
  if (price >= 1_000) {
    const k = price / 1_000
    return `${k % 1 === 0 ? k.toFixed(0) : k.toFixed(0)} тыс ₽`
  }
  return `${price} ₽`
}

/** Форматирование пробега: 45000 → 45 000 км */
export function formatMileage(mileage: number | null | undefined): string {
  if (mileage == null) return "—"
  return `${new Intl.NumberFormat("ru-RU").format(mileage)} км`
}

/** Объём двигателя: 2.0 л */
export function formatEngineVolume(volume: number | null | undefined): string {
  if (volume == null) return "—"
  return `${volume} л`
}

/** Мощность: 190 л.с. */
export function formatPower(power: number | null | undefined): string {
  if (power == null) return "—"
  return `${power} л.с.`
}

/** Относительная дата: "2 дня назад", "только что" */
export function formatRelativeDate(date: Date | string | null | undefined): string {
  if (!date) return "—"
  const d = typeof date === "string" ? new Date(date) : date
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 30) {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "numeric",
      month: "long",
      year: d.getFullYear() === now.getFullYear() ? undefined : "numeric",
    }).format(d)
  }
  if (days > 0) return `${days} ${plural(days, "день", "дня", "дней")} назад`
  if (hours > 0) return `${hours} ${plural(hours, "час", "часа", "часов")} назад`
  if (minutes > 0) return `${minutes} мин назад`
  return "только что"
}

/** Полная дата: 7 августа 2026 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—"
  const d = typeof date === "string" ? new Date(date) : date
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d)
}

/** Русская плюрализация */
export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few
  return many
}

/** Склонение "объявление" */
export function listingsWord(n: number): string {
  return `${n} ${plural(n, "объявление", "объявления", "объявлений")}`
}

/** Парсит JSON-строку изображений (из Prisma/SQLite) */
export function parseImages(images: string | null | undefined): string[] {
  if (!images) return []
  try {
    const parsed = JSON.parse(images)
    return Array.isArray(parsed) ? parsed.filter(Boolean) : []
  } catch {
    return []
  }
}

/** Первое изображение или fallback */
export function firstImage(images: string | null | undefined, fallback = "/placeholder.svg"): string {
  const arr = parseImages(images)
  return arr[0] || fallback
}
