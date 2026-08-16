export const AUCTION_DAMAGE_KINDS = [
  "SERIOUS",
  "COMMON",
  "BODY_REPAIR_PAINT",
  "REPAINT",
  "FILM",
  "REPLACED",
] as const

export type AuctionDamageKind = (typeof AUCTION_DAMAGE_KINDS)[number]

export type AuctionDamagePhoto = {
  url: string
  note: string
  kinds: AuctionDamageKind[]
}

export type AuctionDamageItem = {
  id: string
  part: string
  note: string
  kinds: AuctionDamageKind[]
  x: number | null
  y: number | null
  photos: AuctionDamagePhoto[]
}

export type AuctionDamageSection = {
  code: string
  label: string
  diagramUrl: string | null
  items: AuctionDamageItem[]
}

/**
 * Source-neutral inspection payload stored with an auction listing.
 * It intentionally contains only text, coordinates and remote HTTPS URLs;
 * image bytes remain at the source and are fetched only when a visitor opens
 * the related defect.
 */
export type AuctionDamageReport = {
  sourceLabel: string
  sections: AuctionDamageSection[]
}
