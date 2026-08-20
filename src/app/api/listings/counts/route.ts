import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

/**
 * Счётчики объявлений по направлениям.
 *
 * Витрина на главной обещает человеку, что за плиткой что-то есть. Пустое
 * направление лучше показать честным нулём, чем отправить в пустой список,
 * поэтому считаем на сервере одним запросом, а не гадаем на клиенте.
 */
export async function GET() {
  try {
    // Считаем от объявлений, а не от машин: у транспорта может не быть
    // активного объявления, и витрина показала бы завышенные числа.
    const [active, partsCount] = await Promise.all([
      prisma.listing.findMany({
        where: { status: "ACTIVE", vehicle: { isNot: null } },
        select: { vehicle: { select: { vehicleType: true } } },
      }),
      prisma.listing.count({ where: { status: "ACTIVE", part: { isNot: null } } }),
    ])

    const byType: Record<string, number> = {}
    for (const item of active) {
      const type = item.vehicle?.vehicleType
      if (type) byType[type] = (byType[type] || 0) + 1
    }

    return NextResponse.json({
      counts: {
        cars: byType.CAR || 0,
        moto: byType.MOTORCYCLE || 0,
        trucks: byType.TRUCK || 0,
        special: byType.SPECIAL || 0,
        water: byType.WATER || 0,
        air: byType.AIR || 0,
        parts: partsCount,
      },
    })
  } catch (error) {
    console.error("Listing counts failed:", error)
    // Витрина переживёт отсутствие чисел — она не должна падать целиком.
    return NextResponse.json({ counts: {} })
  }
}
