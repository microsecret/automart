import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

/** GET /api/garage — список авто пользователя в гараже */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const vehicles = await prisma.vehicle.findMany({
      where: { userId: session.user.id, category: { name: "Личный гараж" } },
      select: {
        id: true, make: true, model: true, year: true, mileage: true,
        fuelType: true, transmission: true, bodyType: true, color: true,
        condition: true, location: true, images: true, createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ vehicles })
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}

/** POST /api/garage — добавить авто в гараж (без создания объявления) */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const { make, model, year, mileage, fuelType, transmission, bodyType, color, condition, vin, location } = body

    if (!make || !model || !year) {
      return NextResponse.json({ error: "Марка, модель и год обязательны" }, { status: 400 })
    }

    const garageCategory = await prisma.category.upsert({
      where: { name: "Личный гараж" },
      update: {},
      create: {
        name: "Личный гараж",
        description: "Служебная категория личного гаража без публикации в каталоге",
        icon: "garage",
      },
    })

    // У гаражного автомобиля нет Listing, поэтому он не попадает в публичный каталог.
    const vehicle = await prisma.vehicle.create({
      data: {
        make, model, year: parseInt(year),
        price: 0,
        mileage: parseInt(mileage) || 0,
        vin: vin || `GARAGE-${Date.now()}`,
        fuelType: fuelType || "GASOLINE",
        transmission: transmission || "MANUAL",
        bodyType: bodyType || null,
        color: color || null,
        condition: condition || "EXCELLENT",
        location: location || "",
        vehicleType: "CAR",
        userId: session.user.id,
        categoryId: garageCategory.id,
      },
    })

    return NextResponse.json(vehicle, { status: 201 })
  } catch (e: any) {
    if (e?.code === "P2002") return NextResponse.json({ error: "VIN уже существует" }, { status: 409 })
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
