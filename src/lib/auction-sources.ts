/**
 * Canonical registry for external vehicle sources.
 *
 * Keep the country mapping and public labels together: the parser, API and
 * client filters must agree on a source before imported inventory is exposed.
 * Adding an entry here authorizes the source for the protected feed endpoint;
 * it does not authorize scraping or replace the source's commercial agreement.
 */
export const AUCTION_SOURCE_COUNTRY: Record<string, string> = {
  USS: "JP",
  TAA: "JP",
  EMARAAT: "KR",
  AJ: "KR",
  KCAR: "KR",
  KB_CHA_CHA_CHA: "KR",
  ENCAR: "KR",
  COPART: "US",
  IAAI: "US",
  MOBILE_DE: "DE",
  CARVAGO: "DE",
  GOONET: "JP",
  IAUTOS: "CN",
  YCHEZHAI: "CN",
  GUAZI: "CN",
  CHE168: "CN",
  AUTOHOME: "CN",
  DONGCHEDI: "CN",
  TAOCHE: "CN",
  UCAR: "CN",
}

export const AUCTION_SOURCE_OPTIONS = [
  { value: "USS", label: "USS (Япония)" },
  { value: "TAA", label: "TAA (Япония)" },
  { value: "EMARAAT", label: "Emaraat (Корея)" },
  { value: "AJ", label: "AJ (Корея)" },
  { value: "KCAR", label: "K Car (Корея)" },
  { value: "KB_CHA_CHA_CHA", label: "KB ChaChaCha (Корея)" },
  { value: "ENCAR", label: "Encar (Корея)" },
  { value: "COPART", label: "Copart (США)" },
  { value: "IAAI", label: "IAAI (США)" },
  { value: "MOBILE_DE", label: "Mobile.de (Европа)" },
  { value: "CARVAGO", label: "Carvago (Европа)" },
  { value: "GOONET", label: "Goo-net Exchange (Япония)" },
  { value: "IAUTOS", label: "Iautos (Китай)" },
  { value: "YCHEZHAI", label: "YCheZhai (Китай)" },
  { value: "GUAZI", label: "Guazi (Китай)" },
  { value: "CHE168", label: "Che168 (Китай)" },
  { value: "AUTOHOME", label: "Autohome (Китай)" },
  { value: "DONGCHEDI", label: "Dongchedi (Китай)" },
  { value: "TAOCHE", label: "Taoche (Китай)" },
  { value: "UCAR", label: "Ucar (Китай)" },
] as const

export type AuctionSourcePipeline = "PUBLIC_COLLECTOR" | "OFFICIAL_API" | "PARTNER_FEED"

/**
 * Operational status of every source listed in the product. A source may be
 * accepted by the protected import endpoint without being an autonomous
 * collector yet; keeping this distinction prevents the UI from advertising
 * inventory that has not been legally and technically connected.
 */
export const AUCTION_SOURCE_PIPELINES: Record<string, { pipeline: AuctionSourcePipeline; label: string }> = {
  USS: { pipeline: "PARTNER_FEED", label: "Защищённый партнёрский feed" },
  TAA: { pipeline: "PARTNER_FEED", label: "Защищённый партнёрский feed" },
  EMARAAT: { pipeline: "PARTNER_FEED", label: "Защищённый партнёрский feed" },
  AJ: { pipeline: "PARTNER_FEED", label: "Защищённый партнёрский feed" },
  KCAR: { pipeline: "PUBLIC_COLLECTOR", label: "Штатный публичный каталог" },
  KB_CHA_CHA_CHA: { pipeline: "PARTNER_FEED", label: "Защищённый партнёрский feed" },
  ENCAR: { pipeline: "PUBLIC_COLLECTOR", label: "Штатный публичный каталог" },
  COPART: { pipeline: "PARTNER_FEED", label: "Защищённый партнёрский feed" },
  IAAI: { pipeline: "OFFICIAL_API", label: "Официальный B2B API" },
  MOBILE_DE: { pipeline: "OFFICIAL_API", label: "Официальный Search API" },
  CARVAGO: { pipeline: "PUBLIC_COLLECTOR", label: "Штатный публичный каталог" },
  GOONET: { pipeline: "PUBLIC_COLLECTOR", label: "Штатный публичный каталог" },
  IAUTOS: { pipeline: "PUBLIC_COLLECTOR", label: "Штатный публичный каталог" },
  YCHEZHAI: { pipeline: "PARTNER_FEED", label: "Защищённый партнёрский feed" },
  GUAZI: { pipeline: "PARTNER_FEED", label: "Защищённый партнёрский feed" },
  CHE168: { pipeline: "PARTNER_FEED", label: "Защищённый партнёрский feed" },
  AUTOHOME: { pipeline: "OFFICIAL_API", label: "Одобренный business API / feed" },
  DONGCHEDI: { pipeline: "OFFICIAL_API", label: "Одобренный business API / feed" },
  TAOCHE: { pipeline: "PARTNER_FEED", label: "Защищённый партнёрский feed" },
  UCAR: { pipeline: "PARTNER_FEED", label: "Защищённый партнёрский feed" },
}

export function isAuctionSource(value: string): boolean {
  return Object.prototype.hasOwnProperty.call(AUCTION_SOURCE_COUNTRY, value)
}

export function auctionSourceCountry(source: string) {
  return AUCTION_SOURCE_COUNTRY[source] || null
}

export function auctionSourceLabel(source: string) {
  const configured = AUCTION_SOURCE_OPTIONS.find((option) => option.value === source)?.label
  return configured ? configured.replace(/\s+\([^)]*\)$/, "") : source
}
