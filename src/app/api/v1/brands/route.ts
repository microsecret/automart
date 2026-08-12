import { NextRequest, NextResponse } from "next/server"
import { ALL_BRANDS, type BrandCategory } from "@/lib/catalog"

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
  })
}
