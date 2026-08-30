import { NextRequest, NextResponse } from "next/server"
import { getModels, ALL_BRANDS, type BrandCategory } from "@/lib/catalog"

/* Справочник кэшируется надолго.

   Марки и модели лежат в коде: ответ на один и тот же запрос
   байт в байт одинаков и меняется только с выкатом новой версии.
   Заголовка не было вовсе, поэтому каждый выпадающий список в
   мини-приложении и на сайте шёл до сервера заново.

   stale-while-revalidate отдаёт прошлый ответ мгновенно и обновляет
   его в фоне: список появляется сразу, а свежесть не страдает. */
const DIRECTORY_CACHE_HEADERS = {
  "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
} as const

const CATEGORY_ALIASES: Record<string, BrandCategory> = {
  CAR: "cars",
  cars: "cars",
  MOTORCYCLE: "moto",
  moto: "moto",
  TRUCK: "trucks",
  trucks: "trucks",
  SPECIAL: "special",
  special: "special",
  WATER: "water",
  water: "water",
  AIR: "air",
  air: "air",
}

/**
 * Справочник моделей для каскадных полей. Название марки временно служит ID,
 * пока справочник не вынесен в отдельную таблицу.
 */
export async function GET(request: NextRequest) {
  const brandId = request.nextUrl.searchParams.get("brand_id")?.trim()
  if (!brandId) {
    return NextResponse.json({ error: "brand_id is required" }, { status: 400 })
  }

  const category = request.nextUrl.searchParams.get("category") || ""
  const brandCategory = CATEGORY_ALIASES[category]
  const brand = ALL_BRANDS.find((item) =>
    item.name.toLocaleLowerCase("ru") === brandId.toLocaleLowerCase("ru") && (!brandCategory || item.category === brandCategory),
  )
  if (!brand) {
    return NextResponse.json({ brand: brandId, models: [] }, { headers: DIRECTORY_CACHE_HEADERS })
  }

  return NextResponse.json(
    { brand: brand.name, category: brand.category, models: getModels(brand.name, brand.category) },
    { headers: DIRECTORY_CACHE_HEADERS },
  )
}
