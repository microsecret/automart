import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { parseMarketplaceImages } from "@/lib/media-url"
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit"

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const limit = rateLimit(`damage-assessment:user:${session.user.id}:ip:${getClientIp(request)}`, { windowMs: 15 * 60_000, maxRequests: 5 })
    if (!limit.success) return NextResponse.json({ error: "Слишком много заявок. Попробуйте через 15 минут." }, { status: 429, headers: rateLimitHeaders(limit) })

    const body = await request.json().catch(() => null)
    const vehicleId = typeof body?.vehicleId === "string" ? body.vehicleId.trim() : ""
    const imageUrl = typeof body?.imageUrl === "string" ? body.imageUrl.trim() : ""
    if (!vehicleId || vehicleId.length > 80 || !imageUrl || imageUrl.length > 2048) {
      return NextResponse.json({ error: "Выберите автомобиль и одну из его фотографий" }, { status: 400 })
    }

    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId }, select: { id: true, userId: true, images: true } })
    if (!vehicle) return NextResponse.json({ error: "Автомобиль не найден" }, { status: 404 })
    if (vehicle.userId !== session.user.id) return NextResponse.json({ error: "Оценка доступна только владельцу автомобиля" }, { status: 403 })
    if (!parseMarketplaceImages(vehicle.images).includes(imageUrl)) {
      return NextResponse.json({ error: "Можно отправить только фотографию из собственной карточки" }, { status: 400 })
    }

    const aiLog = await prisma.aIServiceLog.create({
      data: {
        serviceType: "DAMAGE_ASSESSMENT",
        status: "REQUESTED",
        provider: "NOT_CONNECTED",
        subjectVehicleId: vehicle.id,
        inputData: JSON.stringify({ vehicleId: vehicle.id, imageUrl }),
        resultData: JSON.stringify({ status: "REQUESTED", reason: "Подключение компьютерного зрения ещё не выполнено", timestamp: new Date().toISOString() }),
        userId: session.user.id,
      },
    })

    return NextResponse.json({
      request: { id: aiLog.id, status: aiLog.status, createdAt: aiLog.createdAt },
      message: "Заявка сохранена. Оценка повреждений будет доступна после подключения проверенного сервиса компьютерного зрения.",
    }, { status: 202 })
  } catch (error) {
    console.error("Damage assessment service error:", error)
    return NextResponse.json({ error: "Не удалось сохранить заявку" }, { status: 500 })
  }
}
