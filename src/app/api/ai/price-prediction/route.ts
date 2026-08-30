import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit"
import { valuateFromMarket } from "@/lib/market-valuation"

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

    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId }, select: { id: true, userId: true, year: true, price: true, vehicleType: true, make: true, model: true, mileage: true } })
    if (!vehicle) return NextResponse.json({ error: "Автомобиль не найден" }, { status: 404 })
    if (vehicle.userId !== session.user.id) return NextResponse.json({ error: "Прогноз доступен только владельцу автомобиля" }, { status: 403 })
    if (vehicle.vehicleType !== "CAR") return NextResponse.json({ error: "Прогноз пока доступен для легковых автомобилей" }, { status: 400 })

    /* Точка отсчёта — рынок, а не цена из объявления.

       Прогноз брал цену, которую продавец сам же и указал, и уводил её
       вниз по амортизации. Если человек выставил машину вдвое дороже
       рынка, прогноз добросовестно обещал ему вдвое дороже рынка через
       год. Цена продавца — это его желание, а не стоимость.

       Рыночная оценка по сопоставимым лотам даёт настоящую точку
       отсчёта; от неё и считается амортизация. */
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

    /* Нет сопоставимых лотов — остаётся цена объявления. Это слабее, и
       уверенность ниже, но отказывать в прогнозе из-за редкой марки
       было бы хуже: человек не виноват, что его машину редко возят. */
    const currentPrice = market
      ? market.estimatedValue
      : Math.max(200_000, vehicle.price || 0)

    const age = Math.max(0, new Date().getFullYear() - vehicle.year)
    const monthlyDepreciationRate = Math.min(0.015, 0.004 + age * 0.0002)
    const predictedPrice = Math.max(Math.round(currentPrice * (1 - monthlyDepreciationRate) ** months), Math.round(currentPrice * 0.2))
    /* Уверенность прогноза не выше уверенности его точки отсчёта:
       предсказание на шатком основании не становится твёрже от того,
       что срок короткий. */
    const baseConfidence = market ? market.confidencePercent / 100 : 0.5
    const confidenceScore = Math.max(0.2, Math.min(baseConfidence, 0.88 - 0.006 * months))

    const aiLog = await prisma.aIServiceLog.create({
      data: {
        serviceType: "PRICE_PREDICTION",
        status: "COMPLETED",
        provider: market ? "MARKET_COMPARABLES_V1" : "PLATFORM_RULES_V1",
        subjectVehicleId: vehicle.id,
        inputData: JSON.stringify({ vehicleId: vehicle.id, monthsAhead: months, currentPrice, year: vehicle.year, basedOnMarket: Boolean(market), sampleSize: market?.sampleSize ?? 0 }),
        resultData: JSON.stringify({ predictedPrice, confidenceScore, monthlyDepreciationRate, timestamp: new Date().toISOString() }),
        userId: session.user.id,
      },
    })

    return NextResponse.json({
      predictedPrice,
      confidenceScore,
      monthsAhead: months,
      /* Видно, на чём стоит прогноз: рыночная точка отсчёта или цена
         из объявления — это ответы разного веса. */
      basedOnMarket: Boolean(market),
      currentPrice,
      sampleSize: market?.sampleSize ?? 0,
      disclaimer: market
        ? "Отсчёт — медиана цен похожих машин из базы аукционных лотов, дальше применяется типовая амортизация. Прогноз не учитывает спрос, ДТП и курс валют."
        : "Похожих машин в базе слишком мало, поэтому отсчёт взят из вашего объявления и уводится вниз по типовому коэффициенту амортизации. Это грубая оценка.",
      aiLogId: aiLog.id,
    })
  } catch (error) {
    console.error("Price prediction service error:", error)
    return NextResponse.json({ error: "Не удалось рассчитать прогноз" }, { status: 500 })
  }
}
