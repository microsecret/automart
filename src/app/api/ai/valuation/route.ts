import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit"
import { valuateFromMarket } from "@/lib/market-valuation"

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

    /* Оценка идёт от рынка, а не от цены продавца.

       Прежний расчёт брал за основу цену, которую продавец сам же и
       указал, умножал её на возраст, пробег и состояние — и всегда
       возвращал число меньше введённого. Человек спрашивал «сколько
       стоит моя машина», а получал «на столько-то меньше, чем вы
       написали». Про рынок это не говорило ничего.

       Теперь берутся настоящие лоты: в базе их больше восьми тысяч с
       ценой и пробегом из десяти источников. Похожие машины приводятся
       к возрасту и пробегу оцениваемой, и по этому ряду считается
       медиана.

       Выборка ограничена свежими лотами: цены годовой давности говорят
       о прошлогоднем рынке. Две тысячи — с запасом на любую марку,
       дальше выборка только тяжелеет, не становясь точнее. */
    const marketListings = await prisma.auctionListing.findMany({
      where: { priceRub: { gt: 0 }, year: { gte: vehicle.year - 5, lte: vehicle.year + 5 } },
      orderBy: { createdAt: "desc" },
      take: 2_000,
      select: { make: true, model: true, year: true, mileage: true, priceRub: true },
    })

    const market = valuateFromMarket(marketListings, {
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      mileage: vehicle.mileage,
    })

    /* Состояние машины рынок не знает: в аукционных лотах его нет.
       Поправка остаётся, но применяется к рыночной медиане, а не к
       цене продавца. */
    const stateFactor = conditionFactor(vehicle.condition)

    /* Сравнивать не с чем — честно говорим об этом, а не выдаём
       выдуманное число за оценку: человек примет его за рынок и будет
       торговаться по нему. */
    if (!market) {
      return NextResponse.json({
        error: "Пока не с чем сравнивать: похожих машин в базе слишком мало для рыночной оценки.",
      }, { status: 422 })
    }

    const estimatedValue = Math.round(market.estimatedValue * stateFactor)
    const min = Math.round(market.min * stateFactor)
    const max = Math.round(market.max * stateFactor)

    const aiLog = await prisma.aIServiceLog.create({
      data: {
        serviceType: "VALUATION",
        status: "COMPLETED",
        provider: "MARKET_COMPARABLES_V1",
        subjectVehicleId: vehicle.id,
        inputData: JSON.stringify({ vehicleId: vehicle.id, make: vehicle.make, model: vehicle.model, year: vehicle.year, mileage: vehicle.mileage, condition: vehicle.condition, price: vehicle.price }),
        resultData: JSON.stringify({
          estimatedValue, min, max,
          sampleSize: market.sampleSize,
          matchLevel: market.matchLevel,
          confidencePercent: market.confidencePercent,
          stateFactor,
          timestamp: new Date().toISOString()
        }),
        userId: session.user.id
      }
    })

    return NextResponse.json({
      estimatedValue,
      min,
      max,
      /* Человек должен видеть, на чём стоит число: двадцать лотов той
         же модели и три разномастных лота того же года — разного веса
         ответы, и разница между ними важнее самой цифры. */
      sampleSize: market.sampleSize,
      matchLevel: market.matchLevel,
      confidencePercent: market.confidencePercent,
      confidenceLabel: market.confidenceLabel,
      disclaimer: "Оценка по ценам похожих машин из базы аукционных лотов, приведённым к возрасту и пробегу вашей. Она не является офертой, экспертизой или независимой рыночной оценкой.",
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
