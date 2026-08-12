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
  ENCAR: "KR",
  COPART: "US",
  IAAI: "US",
  MOBILE_DE: "DE",
  YCHEZHAI: "CN",
  GUAZI: "CN",
  TAOCHE: "CN",
  UCAR: "CN",
}

export const AUCTION_SOURCE_OPTIONS = [
  { value: "USS", label: "USS (Япония)" },
  { value: "TAA", label: "TAA (Япония)" },
  { value: "EMARAAT", label: "Emaraat (Корея)" },
  { value: "AJ", label: "AJ (Корея)" },
  { value: "ENCAR", label: "Encar (Корея)" },
  { value: "COPART", label: "Copart (США)" },
  { value: "IAAI", label: "IAAI (США)" },
  { value: "MOBILE_DE", label: "Mobile.de (Европа)" },
  { value: "YCHEZHAI", label: "YCheZhai (Китай)" },
  { value: "GUAZI", label: "Guazi (Китай)" },
  { value: "TAOCHE", label: "Taoche (Китай)" },
  { value: "UCAR", label: "Ucar (Китай)" },
] as const

export function isAuctionSource(value: string): boolean {
  return Object.prototype.hasOwnProperty.call(AUCTION_SOURCE_COUNTRY, value)
}

export function auctionSourceCountry(source: string) {
  return AUCTION_SOURCE_COUNTRY[source] || null
}
