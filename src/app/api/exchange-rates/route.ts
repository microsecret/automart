import { NextResponse } from "next/server"
import { getAuctionExchangeRates } from "@/lib/exchange-rates"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const rates = await getAuctionExchangeRates()
    return NextResponse.json({ rates, updated: Object.keys(rates).length > 0 })
  } catch (error) {
    console.error("Exchange rates GET error:", error)
    return NextResponse.json({ error: "Курсы временно недоступны" }, { status: 503 })
  }
}
