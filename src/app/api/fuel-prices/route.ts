import { NextRequest, NextResponse } from "next/server"
import { createHash } from "node:crypto"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit"
import { buildConsensusPrices, isFuelReportType, parseReportedPrice } from "@/lib/fuel-price-reports"

export const dynamic = "force-dynamic"

// Идентификатор точки приходит с карты и попадает в запрос к базе, поэтому
// принимается только тот формат, который карта действительно выдаёт.
const STATION_ID_PATTERN = /^[a-z]+-[a-z]+-\d+$/i
const MAX_STATIONS_PER_REQUEST = 300
const REPORT_HISTORY_LIMIT = 400

function hashClientIp(ip: string) {
  return createHash("sha256").update(`fuel-price:${ip}`).digest("hex").slice(0, 32)
}

function normalizeStationIds(raw: string | null) {
  if (!raw) return []
  return [...new Set(
    raw.split(",")
      .map((value) => value.trim())
      .filter((value) => STATION_ID_PATTERN.test(value)),
  )].slice(0, MAX_STATIONS_PER_REQUEST)
}

/** Отдаёт согласованные цены по запрошенным точкам карты. */
export async function GET(request: NextRequest) {
  const stationIds = normalizeStationIds(request.nextUrl.searchParams.get("stations"))
  if (!stationIds.length) return NextResponse.json({ stations: {} })

  const reports = await prisma.fuelPriceReport.findMany({
    where: { stationId: { in: stationIds }, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    take: REPORT_HISTORY_LIMIT,
    select: { stationId: true, fuel: true, priceRub: true, createdAt: true, userId: true },
  })

  const byStation = new Map<string, Array<{ fuel: string; priceRub: number; createdAt: Date; userId: string | null }>>()
  for (const report of reports) {
    const bucket = byStation.get(report.stationId)
    if (bucket) bucket.push(report)
    else byStation.set(report.stationId, [report])
  }

  const stations: Record<string, ReturnType<typeof buildConsensusPrices>> = {}
  for (const [stationId, bucket] of byStation) {
    const consensus = buildConsensusPrices(bucket)
    if (consensus.length) stations[stationId] = consensus
  }

  return NextResponse.json({ stations }, {
    headers: { "Cache-Control": "public, max-age=60, s-maxage=120, stale-while-revalidate=600" },
  })
}

/** Принимает отметку цены от водителя. */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id || null
  const ip = getClientIp(request)

  // Анонимная отметка разрешена, но заметно строже: цена влияет на карту,
  // поэтому массовая накрутка с одного адреса не должна проходить.
  const limit = rateLimit(`fuel-price:${userId || ip}`, userId
    ? { windowMs: 60 * 60 * 1_000, maxRequests: 20 }
    : { windowMs: 60 * 60 * 1_000, maxRequests: 5 })
  if (!limit.success) {
    return NextResponse.json(
      { error: "Слишком много отметок подряд. Попробуйте позже." },
      { status: 429, headers: rateLimitHeaders(limit) },
    )
  }

  const body = await request.json().catch(() => null)
  const stationId = typeof body?.stationId === "string" ? body.stationId.trim() : ""
  const fuel = body?.fuel
  const priceRub = parseReportedPrice(body?.price)
  const latitude = Number(body?.latitude)
  const longitude = Number(body?.longitude)

  if (!STATION_ID_PATTERN.test(stationId)) {
    return NextResponse.json({ error: "Некорректная точка на карте" }, { status: 400 })
  }
  if (!isFuelReportType(fuel)) {
    return NextResponse.json({ error: "Выберите вид топлива" }, { status: 400 })
  }
  if (priceRub === null) {
    return NextResponse.json({ error: "Цена должна быть от 10 до 300 ₽ за литр" }, { status: 400 })
  }
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    return NextResponse.json({ error: "Некорректные координаты точки" }, { status: 400 })
  }

  const ipHash = hashClientIp(ip)
  // Повторная отметка того же топлива на той же АЗС заменяет предыдущую:
  // водитель уточняет цену, а не добавляет себе второй голос.
  await prisma.fuelPriceReport.updateMany({
    where: {
      stationId,
      fuel,
      status: "ACTIVE",
      ...(userId ? { userId } : { userId: null, ipHash }),
    },
    data: { status: "SUPERSEDED" },
  })

  await prisma.fuelPriceReport.create({
    data: { stationId, latitude, longitude, fuel, priceRub, userId, ipHash },
  })

  const reports = await prisma.fuelPriceReport.findMany({
    where: { stationId, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    take: 60,
    select: { fuel: true, priceRub: true, createdAt: true, userId: true },
  })

  return NextResponse.json({ prices: buildConsensusPrices(reports) }, { status: 201 })
}
