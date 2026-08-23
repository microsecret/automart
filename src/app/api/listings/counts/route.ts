import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { publicListingWhere } from "@/lib/listing-lifecycle"

export const dynamic = "force-dynamic"

/* Счётчики держатся в памяти процесса на минуту.

   Плитки на главной запрашивают их при каждом открытии страницы, а
   меняются они не чаще, чем публикуются объявления. */
const CACHE_TTL_MS = 60_000

let cache: { at: number; counts: Record<string, number> } | null = null

/**
 * Счётчики объявлений по направлениям.
 *
 * Витрина на главной обещает человеку, что за плиткой что-то есть. Пустое
 * направление лучше показать честным нулём, чем отправить в пустой список,
 * поэтому считаем на сервере одним запросом, а не гадаем на клиенте.
 */
export async function GET() {
  try {
    const now = Date.now()
    if (cache && now - cache.at < CACHE_TTL_MS) {
      return NextResponse.json({ counts: cache.counts })
    }

    /* Считает база, а не перебор в памяти.

       Раньше сюда выбирались ВСЕ активные объявления, чтобы посчитать их
       по видам транспорта циклом. Замер на копии базы с 8757
       объявлениями: 279 мс и все строки в памяти — на каждое открытие
       главной.

       Условие видимости берётся общее: голый `status: "ACTIVE"` не
       исключал мягко удалённые, и плитка обещала бы больше, чем
       откроется в каталоге. */
    const [byTypeRows, partsCount] = await Promise.all([
      prisma.vehicle.groupBy({
        by: ["vehicleType"],
        where: { listings: { some: publicListingWhere } },
        _count: true,
      }),
      prisma.listing.count({ where: { ...publicListingWhere, part: { isNot: null } } }),
    ])

    const byType: Record<string, number> = {}
    for (const row of byTypeRows) {
      if (row.vehicleType) byType[row.vehicleType] = Number(row._count)
    }

    const counts = {
      cars: byType.CAR || 0,
      moto: byType.MOTORCYCLE || 0,
      trucks: byType.TRUCK || 0,
      special: byType.SPECIAL || 0,
      water: byType.WATER || 0,
      air: byType.AIR || 0,
      parts: partsCount,
    }
    cache = { at: now, counts }

    return NextResponse.json({ counts })
  } catch (error) {
    console.error("Listing counts failed:", error)
    // Витрина переживёт отсутствие чисел — она не должна падать целиком.
    return NextResponse.json({ counts: {} })
  }
}
