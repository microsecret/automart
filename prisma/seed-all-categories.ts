import { prisma } from "../src/lib/prisma"
import { getBrandsByCategory, type BrandCategory } from "../src/lib/catalog"

const CATEGORY_META: Record<string, { name: string; description: string; icon: string }> = {
  MOTORCYCLE: { name: "Мототехника", description: "Мотоциклы, скутеры и квадроциклы", icon: "Motorbike" },
  TRUCK: { name: "Грузовой транспорт", description: "Коммерческий и грузовой транспорт", icon: "Truck" },
  SPECIAL: { name: "Спецтехника", description: "Строительная, дорожная и сельскохозяйственная техника", icon: "Tractor" },
  WATER: { name: "Водный транспорт", description: "Катера, яхты и гидроциклы", icon: "Speedboat" },
  AIR: { name: "Воздушный транспорт", description: "Самолёты, вертолёты и другая авиация", icon: "Plane" },
}

function createSeedVin(vehicleType: string, index: number) {
  const segment = vehicleType === "MOTORCYCLE" ? "M" : vehicleType === "TRUCK" ? "T" : "C"
  return `D${segment}${String(index).padStart(15, "0")}`
}

async function main() {
  if (process.env.ALLOW_DEMO_SEED !== "true") {
    throw new Error("Demo category listings are disabled. Set ALLOW_DEMO_SEED=true only for an isolated development database.")
  }

  console.log("Генерация объявлений всех категорий...")

  const categoryIds = new Map<string, string>()
  for (const [vehicleType, category] of Object.entries(CATEGORY_META)) {
    const record = await prisma.category.upsert({
      where: { name: category.name },
      update: { description: category.description, icon: category.icon },
      create: category,
      select: { id: true },
    })
    categoryIds.set(vehicleType, record.id)
  }

  const seller = await prisma.user.upsert({
    where: { email: "demo@avtorynok.ru" },
    update: {},
    create: {
      email: "demo@avtorynok.ru",
      name: "Авторынок Demo",
      role: "ADMIN",
      hashedPassword: "$2a$10$placeholderhashplaceholderhashplaceholderhashplaceholder",
    },
  })

  // Удаляем только некар-объявления
  await prisma.listing.deleteMany({ where: { vehicle: { vehicleType: { not: "CAR" } } } })
  await prisma.vehicle.deleteMany({ where: { vehicleType: { not: "CAR" } } })

  const cities = ["Москва", "Санкт-Петербург", "Казань", "Новосибирск", "Екатеринбург", "Краснодар", "Сочи", "Владивосток"]
  const conditions = ["NEW", "LIKE_NEW", "EXCELLENT", "GOOD"]

  const catMap: Record<string, string> = {
    moto: "MOTORCYCLE", trucks: "TRUCK", special: "SPECIAL", water: "WATER", air: "AIR",
  }

  let count = 0

  for (const [catSlug, vehicleType] of Object.entries(catMap)) {
    const brands = getBrandsByCategory(catSlug as BrandCategory)
    console.log(`${catSlug}: ${brands.length} брендов`)

    for (const brand of brands.slice(0, 12)) { // топ-12 брендов в каждой категории
      const models = brand.models.slice(0, 2)
      for (const model of models) {
        const year = 2017 + Math.floor(Math.random() * 8)
        const price = getPriceForCategory(catSlug, brand.name)
        const isRoadTransport = vehicleType === "MOTORCYCLE" || vehicleType === "TRUCK"
        const vin = isRoadTransport ? createSeedVin(vehicleType, count) : null
        const categoryId = categoryIds.get(vehicleType)
        if (!categoryId) throw new Error(`Missing category for ${vehicleType}`)

        const vehicle = await prisma.vehicle.create({
          data: {
            make: brand.name,
            model,
            year,
            price,
            mileage: isRoadTransport ? Math.floor(Math.random() * 80000) : null,
            operatingHours: vehicleType === "SPECIAL" || vehicleType === "WATER" ? Math.floor(Math.random() * 5000) : null,
            flightHours: vehicleType === "AIR" ? Math.floor(Math.random() * 5000) : null,
            vin,
            serialNumber: vehicleType === "SPECIAL" ? `SN-${String(count).padStart(8, "0")}` : null,
            registrationNumber: vehicleType === "WATER" ? `HIN-${String(count).padStart(8, "0")}` : vehicleType === "AIR" ? `RA-${String(count).padStart(8, "0")}` : null,
            fuelType: vehicleType === "AIR" ? (/(Cessna|Piper|Beechcraft)/i.test(brand.name) ? "AVGAS" : "JET_A1") : vehicleType === "WATER" || vehicleType === "MOTORCYCLE" ? "GASOLINE" : "DIESEL",
            transmission: vehicleType === "MOTORCYCLE" || vehicleType === "TRUCK" ? "MANUAL" : "",
            bodyType: null,
            color: null,
            power: 100 + Math.floor(Math.random() * 500),
            driveType: isRoadTransport ? "RWD" : null,
            condition: conditions[Math.floor(Math.random() * conditions.length)],
            vehicleType,
            location: cities[Math.floor(Math.random() * cities.length)],
            description: getDesc(brand.name, model),
            images: JSON.stringify([getPhoto()]),
            userId: seller.id,
            categoryId,
          },
        })

        await prisma.listing.create({
          data: {
            title: `${year} ${brand.name} ${model}`,
            description: getDesc(brand.name, model),
            price,
            isFeatured: Math.random() > 0.75,
            userId: seller.id,
            vehicleId: vehicle.id,
          },
        })
        count++
      }
    }
  }

  console.log(`Добавлено: ${count} объявлений (мото/грузовики/спец/вода/авиа)`)

  const total = await prisma.listing.count()
  const vehicles = await prisma.vehicle.count()
  console.log(`Всего в БД: listings=${total}, vehicles=${vehicles}`)
  await prisma.$disconnect()
}

function getPriceForCategory(cat: string, brand: string): number {
  const premium = ["Robinson", "Bell", "Cessna", "Gulfstream", "Bombardier", "Airbus Helicopters", "AgustaWestland", "Azimut", "Ferretti", "Caterpillar", "Komatsu", "Liebherr", "Scania", "Volvo Trucks", "MAN"]
  if (premium.includes(brand)) return 15000000 + Math.floor(Math.random() * 80000000)
  if (cat === "air") return 8000000 + Math.floor(Math.random() * 40000000)
  if (cat === "water") return 2000000 + Math.floor(Math.random() * 15000000)
  if (cat === "special") return 3000000 + Math.floor(Math.random() * 12000000)
  if (cat === "trucks") return 2500000 + Math.floor(Math.random() * 8000000)
  if (cat === "moto") return 300000 + Math.floor(Math.random() * 2500000)
  return 1000000 + Math.floor(Math.random() * 5000000)
}

function getDesc(brand: string, model: string): string {
  const variants = [
    `Отличное состояние. Регулярное обслуживание. Все документы в порядке.`,
    `${brand} ${model}. Полностью исправен. Возможен trade-in.`,
    `Идеальное состояние. Один владелец. Гаражное хранение.`,
    `Премиум комплектация. Все опции. Сезонное обслуживание.`,
  ]
  return variants[Math.floor(Math.random() * variants.length)]
}

function getPhoto(): string {
  const ids = ["1556203940-3b0c7d18d8f7", "1605559424843-9e3c7dc3e4a4", "1503376780355-7e1b8d2c9e4a"]
  return `https://images.unsplash.com/photo-${ids[Math.floor(Math.random() * ids.length)]}?w=1200&q=80`
}

main().catch((e) => { console.error(e); process.exit(1) })
