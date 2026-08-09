import { NextRequest, NextResponse } from "next/server"
import { getModels, POPULAR_BRANDS } from "@/lib/catalog"

/**
 * Справочник моделей для каскадных полей. Название марки временно служит ID,
 * пока справочник не вынесен в отдельную таблицу.
 */
export async function GET(request: NextRequest) {
  const brandId = request.nextUrl.searchParams.get("brand_id")?.trim()
  if (!brandId) {
    return NextResponse.json({ error: "brand_id is required" }, { status: 400 })
  }

  const brand = POPULAR_BRANDS.find((item) => item.name.toLocaleLowerCase("ru") === brandId.toLocaleLowerCase("ru"))
  if (!brand) {
    return NextResponse.json({ brand: brandId, models: [] })
  }

  return NextResponse.json({ brand: brand.name, models: getModels(brand.name) })
}
