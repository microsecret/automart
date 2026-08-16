import { prisma } from "@/lib/prisma"

export const AUCTION_CURRENCIES = ["USD", "EUR", "JPY", "KRW", "CNY"] as const

export type AuctionCurrency = typeof AUCTION_CURRENCIES[number]

export type ExchangeRateMap = Record<string, { rateToRub: number; updatedAt: Date | null; source: string }>

export async function getAuctionExchangeRates(): Promise<ExchangeRateMap> {
  const rows = await prisma.exchangeRate.findMany({
    where: { currency: { in: AUCTION_CURRENCIES as unknown as string[] } },
    select: { currency: true, rateToRub: true, source: true, updatedAt: true },
  })

  return rows.reduce<ExchangeRateMap>((rates, row) => {
    rates[row.currency] = { rateToRub: row.rateToRub, source: row.source, updatedAt: row.updatedAt }
    return rates
  }, {})
}

export function getAuctionRateToRub(currency: string | null | undefined, rates: ExchangeRateMap): number {
  const normalized = (currency || "RUB").trim().toUpperCase()
  if (normalized === "RUB") return 1
  const officialRate = rates[normalized]?.rateToRub
  if (!Number.isFinite(officialRate) || officialRate <= 0) {
    throw new Error(`Official exchange rate is unavailable for ${normalized}`)
  }
  return officialRate
}

export function calculateAuctionRubPricing(sourcePrice: number, exchangeRate: number, markup: number) {
  const priceRub = Math.max(0, Math.round(sourcePrice * exchangeRate))
  return {
    priceRub,
    finalPrice: priceRub + Math.max(0, Math.trunc(markup)),
  }
}
