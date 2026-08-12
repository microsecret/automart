/**
 * Estimated marketplace service fee for a foreign-auction purchase.
 * It is intentionally separate from statutory payments and always shown to
 * customers as an estimate until the deal is confirmed by a manager.
 */
export function estimatedAuctionServiceFee(priceRub: number): number {
  return priceRub >= 3_000_000 ? 200_000 : 150_000
}
