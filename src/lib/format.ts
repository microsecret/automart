import { parseMarketplaceImages } from "@/lib/media-url"

/* Форматирование чисел живёт отдельным модулем без зависимостей.

   Этот файл тянет разбор адресов картинок, из-за чего правила набора —
   неразрывные пробелы, сокращения, округление — нельзя было проверить
   тестом без запуска всего приложения. Здесь они переэкспортируются,
   чтобы прежние места ссылались как раньше. */
export { formatEngineVolume, formatMileage, formatPower } from "@/lib/format-numbers"
import { formatPriceShort } from "@/lib/format-numbers"
export { formatPriceShort }

/** Форматирование цены в рублях */
export function formatPrice(price: number | null | undefined): string {
  if (price == null || !Number.isFinite(price)) return "Договорная"
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(price)
}


/** Ориентировочный ежемесячный платёж для краткого показа в карточке. */
export function formatMonthlyPayment(price: number | null | undefined): string | null {
  if (!price || !Number.isFinite(price) || price <= 100_000) return null
  return `от ${formatPriceShort(Math.round(price * 0.025))}/мес`
}

/** Относительная дата: "2 дня назад", "только что" */
export function formatRelativeDate(date: Date | string | null | undefined): string {
  if (!date) return "—"
  const d = typeof date === "string" ? new Date(date) : date
  if (Number.isNaN(d.getTime())) return "—"
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
  if (Number.isNaN(d.getTime())) return "—"
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

/**
 * Parses stored listing images for rendering.
 *
 * Database values may have been created before the current upload validation
 * existed, so the read path uses the same allow-list as the write path.  A
 * malformed payload deliberately becomes an empty gallery instead of reaching
 * an image `src` attribute on catalogue, dashboard or detail pages.
 */
export function parseImages(images: string | null | undefined): string[] {
  return parseMarketplaceImages(images) ?? []
}

/** Первое изображение или fallback */
export function firstImage(images: string | null | undefined, fallback = "/placeholder.svg"): string {
  const arr = parseImages(images)
  return arr[0] || fallback
}
