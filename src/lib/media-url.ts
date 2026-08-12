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

type EncarRendition = { rh: number; cw: number; ch: number }

function encarImageUrl(value: string, rendition: EncarRendition): string {
  if (!isSafeMediaUrl(value)) return value

  try {
    const url = new URL(value)
    if (url.hostname !== "ci.encar.com" || !url.pathname.startsWith("/carpicture/")) return value

    url.searchParams.set("impolicy", "heightRate")
    url.searchParams.set("rh", String(rendition.rh))
    url.searchParams.set("cw", String(rendition.cw))
    url.searchParams.set("ch", String(rendition.ch))
    url.searchParams.set("cg", "Center")
    return url.toString()
  } catch {
    return value
  }
}

/** A compact rendition for the thumbnail rail; never request full gallery files there. */
export function auctionThumbnailImageUrl(value: string): string {
  return encarImageUrl(value, { rh: 320, cw: 480, ch: 320 })
}

/** A balanced image for auction-result cards. */
export function auctionCardImageUrl(value: string): string {
  return encarImageUrl(value, { rh: 720, cw: 1120, ch: 720 })
}

/**
 * The detail gallery is displayed below 1600px wide. Keep it sharp without
 * fetching the former 2560px variant again after a 1600px source preview.
 */
export function highQualityAuctionImageUrl(value: string): string {
  return encarImageUrl(value, { rh: 1024, cw: 1600, ch: 1024 })
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

/**
 * Auction sources can expose substantially more inspection photos than a
 * marketplace listing. They are only shown after the same HTTPS validation,
 * while keeping the stricter 12-photo limit for user-uploaded listings.
 */
export function parseAuctionImages(value: unknown, maxItems = 100): string[] | null {
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
