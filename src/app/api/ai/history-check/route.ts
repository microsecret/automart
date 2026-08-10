import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit"

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const limit = rateLimit(`history-check:user:${session.user.id}:ip:${getClientIp(request)}`, { windowMs: 15 * 60_000, maxRequests: 5 })
    if (!limit.success) return NextResponse.json({ error: "Слишком много заявок. Попробуйте через 15 минут." }, { status: 429, headers: rateLimitHeaders(limit) })

    const body = await request.json().catch(() => null)
    const vehicleId = typeof body?.vehicleId === "string" ? body.vehicleId.trim() : ""

    if (!vehicleId || vehicleId.length > 80) {
      return NextResponse.json(
        { error: "Выберите автомобиль для проверки" },
        { status: 400 }
      )
    }

    // Get vehicle details
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId }
    })

    if (!vehicle) {
      return NextResponse.json(
        { error: "Автомобиль не найден" },
        { status: 404 }
      )
    }

    // Check authorization (similar to valuation)
    if (vehicle.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Проверка доступна только владельцу автомобиля" },
        { status: 403 }
      )
    }

    if (vehicle.vehicleType !== "CAR") {
      return NextResponse.json({ error: "Проверка истории пока доступна для легковых автомобилей" }, { status: 400 })
    }

    const aiLog = await prisma.aIServiceLog.create({
      data: {
        serviceType: "HISTORY_CHECK",
        status: "REQUESTED",
        provider: "NOT_CONNECTED",
        subjectVehicleId: vehicle.id,
        inputData: JSON.stringify({ vehicleId: vehicle.id, make: vehicle.make, model: vehicle.model, year: vehicle.year }),
        resultData: JSON.stringify({
          status: "REQUESTED",
          reason: "Проверка сохранена до подключения авторизованного провайдера данных",
          timestamp: new Date().toISOString()
        }),
        userId: session.user.id
      }
    })

    return NextResponse.json({
      request: { id: aiLog.id, status: aiLog.status, createdAt: aiLog.createdAt },
      message: "Заявка сохранена. Автоматический отчёт появится только после подключения проверенного поставщика данных.",
    }, { status: 201 })
  } catch (error) {
    console.error("Error in history check AI service:", error)
    return NextResponse.json(
      { error: "Failed to process history check request" },
      { status: 500 }
    )
  }
}
