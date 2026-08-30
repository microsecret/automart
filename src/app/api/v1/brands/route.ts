import { NextRequest, NextResponse } from "next/server"
import { ALL_BRANDS, type BrandCategory } from "@/lib/catalog"

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
 * Public brand directory for the web interface, Telegram Mini App and
 * external consumers. Models remain available through the existing
 * `/api/v1/models` and `/api/v1/brands/:brandId/models` endpoints.
 */
export async function GET(request: NextRequest) {
  const categoryParam = request.nextUrl.searchParams.get("category")?.trim() || ""
  const category = categoryParam ? CATEGORY_ALIASES[categoryParam] : undefined

  if (categoryParam && !category) {
    return NextResponse.json({ error: "Некорректная категория транспорта" }, { status: 400 })
  }

  const brands = ALL_BRANDS
    .filter((brand) => !category || brand.category === category)
    .map((brand) => ({
      id: brand.name,
      name: brand.name,
      country: brand.country,
      category: brand.category,
      popular: brand.popular,
      modelCount: brand.models.length,
    }))

  return NextResponse.json({
    brands,
    total: brands.length,
    category: category || null,
  }, { headers: DIRECTORY_CACHE_HEADERS })
}
