import { NextResponse } from "next/server"

/**
 * Совместимый ответ для старых клиентов. Создание неполного транспортного
 * объявления через этот endpoint отключено: публикация проходит только через
 * единый контракт /api/vehicles.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: "Быстрая подача обновлена. Откройте полную форму и заполните обязательные сведения.",
      formUrl: "/listings/create/vehicle",
    },
    { status: 410 },
  )
}
