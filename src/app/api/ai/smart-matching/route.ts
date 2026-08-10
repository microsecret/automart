import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { LISTING_STATUS } from "@/lib/listing-lifecycle"
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit"

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const limitResult = rateLimit(`smart-matching:user:${session.user.id}:ip:${getClientIp(request)}`, { windowMs: 60_000, maxRequests: 12 })
    if (!limitResult.success) return NextResponse.json({ error: "Слишком много подборов. Попробуйте через минуту." }, { status: 429, headers: rateLimitHeaders(limitResult) })

    const body = await request.json().catch(() => null)
    const vehicleId = typeof body?.vehicleId === "string" ? body.vehicleId.trim() : ""
    const rawLimit = Number(body?.limit ?? 5)
    if (!vehicleId || vehicleId.length > 80 || !Number.isSafeInteger(rawLimit)) {
      return NextResponse.json({ error: "Выберите автомобиль и корректный лимит результатов" }, { status: 400 })
    }
    const queryLimit = Math.min(Math.max(rawLimit, 1), 20)

    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { id: true, userId: true, vehicleType: true, make: true, model: true, categoryId: true, year: true, price: true },
    })
    if (!vehicle) return NextResponse.json({ error: "Автомобиль не найден" }, { status: 404 })
    if (vehicle.userId !== session.user.id) return NextResponse.json({ error: "Подбор доступен только владельцу автомобиля" }, { status: 403 })

    const similarVehicles = await prisma.vehicle.findMany({
      where: {
        id: { not: vehicle.id },
        vehicleType: vehicle.vehicleType,
        userId: { not: session.user.id },
        listings: { some: { status: LISTING_STATUS.ACTIVE, deletedAt: null } },
        OR: [
          { make: vehicle.make },
          { model: vehicle.model },
          { categoryId: vehicle.categoryId },
          { year: { gte: vehicle.year - 2, lte: vehicle.year + 2 } },
        ],
      },
      select: {
        id: true,
        make: true,
        model: true,
        year: true,
        price: true,
        mileage: true,
        location: true,
        images: true,
        listings: { where: { status: LISTING_STATUS.ACTIVE, deletedAt: null }, select: { id: true, title: true, price: true }, take: 1 },
      },
      take: 100,
    })

    const matches = similarVehicles.map((candidate) => {
      let score = 0
      if (candidate.make === vehicle.make) score += 30
      if (candidate.model === vehicle.model) score += 25
      score += 20 // identical transport type is enforced in the query
      score += Math.max(0, 15 - Math.abs(candidate.year - vehicle.year) * 2)
      if (candidate.price && vehicle.price) {
        const priceGap = Math.abs(candidate.price - vehicle.price) / Math.max(candidate.price, vehicle.price)
        score += Math.max(0, 10 - priceGap * 10)
      }
      return { vehicle: candidate, matchScore: Math.min(Math.round(score), 100) }
    }).sort((left, right) => right.matchScore - left.matchScore).slice(0, queryLimit)

    const aiLog = await prisma.aIServiceLog.create({
      data: {
        serviceType: "SMART_MATCHING",
        status: "COMPLETED",
        provider: "PLATFORM_RULES_V1",
        subjectVehicleId: vehicle.id,
        inputData: JSON.stringify({ vehicleId: vehicle.id, limit: queryLimit }),
        resultData: JSON.stringify({ matches: matches.map((match) => ({ vehicleId: match.vehicle.id, listingId: match.vehicle.listings[0]?.id, matchScore: match.matchScore })), timestamp: new Date().toISOString() }),
        userId: session.user.id,
      },
    })

    return NextResponse.json({ matches, aiLogId: aiLog.id })
  } catch (error) {
    console.error("Smart matching service error:", error)
    return NextResponse.json({ error: "Не удалось подобрать похожие предложения" }, { status: 500 })
  }
}
