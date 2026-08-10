import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit"

const CURRENT_YEAR = new Date().getFullYear()

function conditionFactor(condition: string) {
  return ({ NEW: 1.08, LIKE_NEW: 1.03, EXCELLENT: 1, GOOD: 0.94, FAIR: 0.84, POOR: 0.7 } as Record<string, number>)[condition] || 0.94
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const limit = rateLimit(`valuation:user:${session.user.id}:ip:${getClientIp(request)}`, { windowMs: 60_000, maxRequests: 12 })
    if (!limit.success) return NextResponse.json({ error: "Слишком много запросов на оценку. Попробуйте через минуту." }, { status: 429, headers: rateLimitHeaders(limit) })

    const body = await request.json().catch(() => null)
    const vehicleId = typeof body?.vehicleId === "string" ? body.vehicleId.trim() : ""

    if (!vehicleId || vehicleId.length > 80) {
      return NextResponse.json(
        { error: "Выберите автомобиль для оценки" },
        { status: 400 }
      )
    }

    // Get vehicle details
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { id: true, userId: true, vehicleType: true, make: true, model: true, year: true, price: true, mileage: true, condition: true }
    })

    if (!vehicle) {
      return NextResponse.json(
        { error: "Автомобиль не найден" },
        { status: 404 }
      )
    }

    // Check if vehicle belongs to current user (for privacy)
    // In a real marketplace, valuation might be available for any vehicle
    // but for now we'll restrict to user's own vehicles
    if (vehicle.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Оценка доступна только владельцу автомобиля" },
        { status: 403 }
      )
    }

    if (vehicle.vehicleType !== "CAR") {
      return NextResponse.json({ error: "Предварительная оценка пока доступна для легковых автомобилей" }, { status: 400 })
    }

    // This is intentionally deterministic. It is a transparent preliminary
    // estimate from the seller's data, not a claim of a live market or registry check.
    const basePrice = Math.max(200_000, vehicle.price || 0)
    const ageFactor = Math.max(0.48, 1 - (CURRENT_YEAR - vehicle.year) * 0.025)
    const mileageFactor = vehicle.mileage
      ? Math.max(0.55, 1 - (vehicle.mileage / 100_000) * 0.28)
      : 1
    const stateFactor = conditionFactor(vehicle.condition)
    const estimatedValue = Math.round(basePrice * ageFactor * mileageFactor * stateFactor)
    const min = Math.round(estimatedValue * 0.88)
    const max = Math.round(estimatedValue * 1.12)

    const aiLog = await prisma.aIServiceLog.create({
      data: {
        serviceType: "VALUATION",
        status: "COMPLETED",
        provider: "PLATFORM_RULES_V1",
        subjectVehicleId: vehicle.id,
        inputData: JSON.stringify({ vehicleId: vehicle.id, make: vehicle.make, model: vehicle.model, year: vehicle.year, mileage: vehicle.mileage, condition: vehicle.condition, price: vehicle.price }),
        resultData: JSON.stringify({
          estimatedValue, min, max,
          factors: {
            ageFactor,
            mileageFactor,
            stateFactor,
          },
          timestamp: new Date().toISOString()
        }),
        userId: session.user.id
      }
    })

    return NextResponse.json({
      estimatedValue,
      min,
      max,
      disclaimer: "Предварительная оценка по данным вашего объявления. Она не является офертой, экспертизой или независимой рыночной оценкой.",
      factors: {
        ageFactor,
        mileageFactor,
        stateFactor,
      },
      aiLogId: aiLog.id
    })
  } catch (error) {
    console.error("Error in valuation AI service:", error)
    return NextResponse.json(
      { error: "Failed to process valuation request" },
      { status: 500 }
    )
  }
}
