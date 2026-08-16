import { NextResponse } from "next/server"
import { AUCTION_CURRENCIES, getAuctionExchangeRates } from "@/lib/exchange-rates"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const rates = await getAuctionExchangeRates()
    const timestamps = Object.values(rates)
      .map((rate) => rate.updatedAt?.getTime())
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
    const asOf = timestamps.length ? new Date(Math.min(...timestamps)) : null
    const missingCurrencies = AUCTION_CURRENCIES.filter((currency) => !rates[currency])
    const stale = !asOf || Date.now() - asOf.getTime() > 36 * 60 * 60 * 1_000 || missingCurrencies.length > 0

    return NextResponse.json({
      rates,
      updated: Object.keys(rates).length > 0,
      asOf: asOf?.toISOString() || null,
      stale,
      missingCurrencies,
    })
  } catch (error) {
    console.error("Exchange rates GET error:", error)
    return NextResponse.json({ error: "Курсы временно недоступны" }, { status: 503 })
  }
}
