import { NextRequest, NextResponse } from "next/server"
import { getModels, POPULAR_BRANDS } from "@/lib/catalog"

/** Совместимый маршрут для мини-приложения и внешних клиентов. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params
  const decoded = decodeURIComponent(brandId).trim()
  const brand = POPULAR_BRANDS.find((item) => item.name.toLocaleLowerCase("ru") === decoded.toLocaleLowerCase("ru"))
  if (!brand) return NextResponse.json({ brand: decoded, models: [] })

  return NextResponse.json({ brand: brand.name, models: getModels(brand.name) })
}
