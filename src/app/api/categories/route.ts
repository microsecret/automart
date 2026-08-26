import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getVehicleTypeForCategoryName } from "@/lib/vehicleCategories"

export const dynamic = "force-dynamic"

/** GET /api/categories — список категорий */
export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    })
    return NextResponse.json({
      categories: categories.map((category) => ({
        ...category,
        vehicleType: getVehicleTypeForCategoryName(category.name),
      })),
    })
  } catch (error) {
    /* Сбой базы — не «категорий нет»: ответ 200 с пустым списком прятал
       поломку и от клиента, и от мониторинга. */
    console.error("Не удалось загрузить категории:", error)
    return NextResponse.json({ error: "Категории временно недоступны" }, { status: 503 })
  }
}
