import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const CBR_DAILY_URL = process.env.AUCTION_CBR_URL || "https://www.cbr.ru/scripts/XML_daily.asp"
const TARGET_CURRENCIES = new Set(["USD", "EUR", "JPY", "KRW", "CNY"])

function decodeXml(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
}

function tagValue(block, tag) {
  const match = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`))
  return match ? decodeXml(match[1]) : ""
}

function parseCbrRates(xml) {
  const rates = []
  const blocks = xml.match(/<Valute[^>]*>[\s\S]*?<\/Valute>/g) || []

  for (const block of blocks) {
    const currency = tagValue(block, "CharCode").toUpperCase()
    if (!TARGET_CURRENCIES.has(currency)) continue

    const nominal = Number.parseInt(tagValue(block, "Nominal"), 10)
    const value = Number(tagValue(block, "Value").replace(",", "."))
    if (!Number.isFinite(nominal) || nominal <= 0 || !Number.isFinite(value) || value <= 0) continue

    rates.push({ currency, rateToRub: Math.round((value / nominal) * 1_000_000) / 1_000_000 })
  }

  if (rates.length !== TARGET_CURRENCIES.size) {
    throw new Error(`CBR response is incomplete: received ${rates.map((rate) => rate.currency).join(", ") || "no target currencies"}`)
  }

  return rates
}

async function fetchCbrRates() {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12_000)

  try {
    const response = await fetch(CBR_DAILY_URL, {
      headers: { "User-Agent": "AutoMart auction rate updater/1.0" },
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`CBR responded with ${response.status}`)
    return parseCbrRates(await response.text())
  } finally {
    clearTimeout(timeout)
  }
}

async function main() {
  const rates = await fetchCbrRates()
  const refreshedAt = new Date()
  const rateMap = new Map([["RUB", 1], ...rates.map((rate) => [rate.currency, rate.rateToRub])])

  await prisma.$transaction(rates.map((rate) => prisma.exchangeRate.upsert({
    where: { currency: rate.currency },
    update: { rateToRub: rate.rateToRub, source: "CBR", effectiveAt: refreshedAt },
    create: { currency: rate.currency, rateToRub: rate.rateToRub, source: "CBR", effectiveAt: refreshedAt },
  })))

  const activeLots = await prisma.auctionListing.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, sourcePrice: true, sourceCurrency: true, markup: true },
  })

  const updates = activeLots.flatMap((lot) => {
    const rate = rateMap.get(lot.sourceCurrency.toUpperCase())
    if (!rate) return []
    const priceRub = Math.max(0, Math.round(lot.sourcePrice * rate))
    return prisma.auctionListing.update({
      where: { id: lot.id },
      data: {
        exchangeRate: rate,
        priceRub,
        finalPrice: priceRub + Math.max(0, lot.markup),
        pricingUpdatedAt: refreshedAt,
      },
    })
  })

  for (let offset = 0; offset < updates.length; offset += 100) {
    await prisma.$transaction(updates.slice(offset, offset + 100))
  }

  console.log(JSON.stringify({
    source: "CBR",
    refreshedAt: refreshedAt.toISOString(),
    rates,
    activeLots: activeLots.length,
    repricedLots: updates.length,
    skippedLots: activeLots.length - updates.length,
  }))
}

main()
  .catch((error) => {
    console.error("Failed to refresh auction exchange rates", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
