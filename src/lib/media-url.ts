const MAX_MEDIA_URL_LENGTH = 2_000

/**
 * Browser-safe media URL for catalogue cards.
 *
 * Marketplace uploads are stored under `/uploads`. HTTPS links are retained
 * for already imported auction and editorial media, but schemes with an
 * executable payload, credentials or a malformed URL never reach a `src`
 * attribute.
 */
export function isSafeMediaUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_MEDIA_URL_LENGTH) return false
  if (value.startsWith("/uploads/")) return !value.includes("\\") && !value.includes("..")

  try {
    const url = new URL(value)
    return url.protocol === "https:" && !url.username && !url.password
  } catch {
    return false
  }
}

/** Normalizes an optional URL used as a source link or imported remote image. */
export function safeHttpsUrl(value: unknown, maxLength = MAX_MEDIA_URL_LENGTH): string | null {
  if (typeof value !== "string") return null
  const normalized = value.trim()
  if (!normalized || normalized.length > maxLength) return null
  try {
    const url = new URL(normalized)
    return url.protocol === "https:" && !url.username && !url.password ? url.toString() : null
  } catch {
    return null
  }
}

/**
 * Parses the JSON payload sent by listing forms and rejects malformed or
 * unsafe image values before they can be persisted.
 */
export function parseMarketplaceImages(value: unknown, maxItems = 12): string[] | null {
  if (value === undefined || value === null || value === "") return []

  let raw = value
  if (typeof value === "string") {
    try {
      raw = JSON.parse(value)
    } catch {
      return null
    }
  }
  if (!Array.isArray(raw) || raw.length > maxItems) return null

  const images = Array.from(new Set(raw))
  return images.every(isSafeMediaUrl) ? images : null
}
