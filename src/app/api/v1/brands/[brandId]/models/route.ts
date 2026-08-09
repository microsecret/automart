import { NextRequest, NextResponse } from "next/server"
import { getModels, ALL_BRANDS, type BrandCategory } from "@/lib/catalog"

const CATEGORY_ALIASES: Record<string, BrandCategory> = {
  CAR: "cars", cars: "cars", MOTORCYCLE: "moto", moto: "moto", TRUCK: "trucks", trucks: "trucks",
  SPECIAL: "special", special: "special", WATER: "water", water: "water", AIR: "air", air: "air",
}

/** Совместимый маршрут для мини-приложения и внешних клиентов. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params
  const decoded = decodeURIComponent(brandId).trim()
  const category = request.nextUrl.searchParams.get("category") || ""
  const brandCategory = CATEGORY_ALIASES[category]
  const brand = ALL_BRANDS.find((item) =>
    item.name.toLocaleLowerCase("ru") === decoded.toLocaleLowerCase("ru") && (!brandCategory || item.category === brandCategory),
  )
  if (!brand) return NextResponse.json({ brand: decoded, models: [] })

  return NextResponse.json({ brand: brand.name, category: brand.category, models: getModels(brand.name, brand.category) })
}
