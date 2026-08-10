import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit"

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const limit = rateLimit(`price-prediction:user:${session.user.id}:ip:${getClientIp(request)}`, { windowMs: 60_000, maxRequests: 8 })
    if (!limit.success) return NextResponse.json({ error: "Слишком много прогнозов. Попробуйте через минуту." }, { status: 429, headers: rateLimitHeaders(limit) })

    const body = await request.json().catch(() => null)
    const vehicleId = typeof body?.vehicleId === "string" ? body.vehicleId.trim() : ""
    const months = Number(body?.monthsAhead)
    if (!vehicleId || vehicleId.length > 80 || !Number.isSafeInteger(months) || months < 1 || months > 36) {
      return NextResponse.json({ error: "Выберите автомобиль и укажите период от 1 до 36 месяцев" }, { status: 400 })
    }

    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId }, select: { id: true, userId: true, year: true, price: true, vehicleType: true } })
    if (!vehicle) return NextResponse.json({ error: "Автомобиль не найден" }, { status: 404 })
    if (vehicle.userId !== session.user.id) return NextResponse.json({ error: "Прогноз доступен только владельцу автомобиля" }, { status: 403 })
    if (vehicle.vehicleType !== "CAR") return NextResponse.json({ error: "Прогноз пока доступен для легковых автомобилей" }, { status: 400 })

    const currentPrice = Math.max(200_000, vehicle.price || 0)
    const age = Math.max(0, new Date().getFullYear() - vehicle.year)
    const monthlyDepreciationRate = Math.min(0.015, 0.004 + age * 0.0002)
    const predictedPrice = Math.max(Math.round(currentPrice * (1 - monthlyDepreciationRate) ** months), Math.round(currentPrice * 0.2))
    const confidenceScore = Math.max(0.5, 0.88 - 0.006 * months)

    const aiLog = await prisma.aIServiceLog.create({
      data: {
        serviceType: "PRICE_PREDICTION",
        status: "COMPLETED",
        provider: "PLATFORM_RULES_V1",
        subjectVehicleId: vehicle.id,
        inputData: JSON.stringify({ vehicleId: vehicle.id, monthsAhead: months, currentPrice, year: vehicle.year }),
        resultData: JSON.stringify({ predictedPrice, confidenceScore, monthlyDepreciationRate, timestamp: new Date().toISOString() }),
        userId: session.user.id,
      },
    })

    return NextResponse.json({
      predictedPrice,
      confidenceScore,
      monthsAhead: months,
      disclaimer: "Прогноз основан только на данных объявления и типовом коэффициенте амортизации. Он не учитывает реальный спрос, ДТП, курс валют или состояние рынка.",
      aiLogId: aiLog.id,
    })
  } catch (error) {
    console.error("Price prediction service error:", error)
    return NextResponse.json({ error: "Не удалось рассчитать прогноз" }, { status: 500 })
  }
}
