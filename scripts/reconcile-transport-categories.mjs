import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

// Kept in deployable JavaScript deliberately: this runs after `prisma generate`
// and before the Next.js build, without requiring a TypeScript runtime on prod.
const TRANSPORT_CATEGORIES = {
  CAR: { name: "Легковые автомобили", description: "Легковые автомобили и кроссоверы", icon: "Car" },
  MOTORCYCLE: { name: "Мототехника", description: "Мотоциклы, скутеры и квадроциклы", icon: "Motorbike" },
  TRUCK: { name: "Грузовой транспорт", description: "Коммерческий и грузовой транспорт", icon: "Truck" },
  SPECIAL: { name: "Спецтехника", description: "Строительная, дорожная и сельскохозяйственная техника", icon: "Tractor" },
  WATER: { name: "Водный транспорт", description: "Катера, яхты и гидроциклы", icon: "Speedboat" },
  AIR: { name: "Воздушный транспорт", description: "Самолёты, вертолёты и другая авиация", icon: "Plane" },
}

async function main() {
  await prisma.$transaction(async (tx) => {
    const categoryIds = new Map()

    for (const [vehicleType, category] of Object.entries(TRANSPORT_CATEGORIES)) {
      const record = await tx.category.upsert({
        where: { name: category.name },
        update: { description: category.description, icon: category.icon },
        create: category,
        select: { id: true },
      })
      categoryIds.set(vehicleType, record.id)
    }

    for (const [vehicleType, categoryId] of categoryIds) {
      await tx.vehicle.updateMany({ where: { vehicleType }, data: { categoryId } })
    }

    for (const categoryId of categoryIds.values()) {
      const vehicleCount = await tx.vehicle.count({ where: { categoryId } })
      await tx.category.update({ where: { id: categoryId }, data: { vehicleCount } })
    }
  })

  console.log("Transport categories reconciled")
}

main()
  .catch((error) => {
    console.error("Failed to reconcile transport categories", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
