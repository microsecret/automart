import { prisma } from "../src/lib/prisma"
import { BRANDS, TRANSPORT_CATEGORIES } from "../src/lib/catalog"
import { ELECTRIC_ONLY_CAR_MAKES, isKnownInvalidCarFuel } from "../src/lib/constants"

async function main() {
  console.log("Генерация объявлений из каталога...")

  // Категория
  const category = await prisma.category.upsert({
    where: { name: "Легковые автомобили" },
    update: {},
    create: { name: "Легковые автомобили", description: "Все легковые", icon: "Car" },
  })

  // Продавец
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

  // Очистка
  await prisma.listing.deleteMany({})
  await prisma.vehicle.deleteMany({})
  await prisma.part.deleteMany({})

  const cities = ["Москва", "Санкт-Петербург", "Казань", "Новосибирск", "Екатеринбург", "Краснодар", "Самара", "Уфа", "Воронеж", "Ростов-на-Дону"]
  const colors = ["Чёрный", "Белый", "Серый", "Серебристый", "Синий", "Красный", "Зелёный", "Коричневый", "Бордовый"]
  const fuels = ["GASOLINE", "DIESEL", "HYBRID", "ELECTRIC"]
  const transmissions = ["MANUAL", "AUTOMATIC", "VARIATOR", "ROBOTIC"]
  const bodies = ["SEDAN", "HATCHBACK", "SUV", "CROSSOVER", "COUPE", "WAGON", "LIFTBACK"]
  const drives = ["FWD", "RWD", "AWD"]
  const conditions = ["NEW", "LIKE_NEW", "EXCELLENT", "GOOD"]

  let vCount = 0
  let pCount = 0

  // Генерируем авто для популярных брендов (по 2-3 модели каждый)
  for (const brand of BRANDS.filter((b) => b.popular)) {
    const models = brand.models.slice(0, 3)
    for (const model of models) {
      const rawYear = 2018 + Math.floor(Math.random() * 7) // 2018-2024
      const year = brand.name === "Tesla" && model === "Model Y" ? Math.max(2020, rawYear) : rawYear
      const mileage = Math.floor(Math.random() * 120000)
      const basePrice = getBasePrice(brand.name, year)
      const price = basePrice + Math.floor(Math.random() * 500000) - 250000
      const randomFuel = brand.country === "CN" && Math.random() > 0.7 ? "ELECTRIC" : fuels[Math.floor(Math.random() * fuels.length)]
      const fuel = ELECTRIC_ONLY_CAR_MAKES.has(brand.name)
        ? "ELECTRIC"
        : isKnownInvalidCarFuel(brand.name, model, year, randomFuel)
          ? "GASOLINE"
          : randomFuel
      const transmission = ELECTRIC_ONLY_CAR_MAKES.has(brand.name)
        ? "AUTOMATIC"
        : transmissions[Math.floor(Math.random() * transmissions.length)]
      const vin = createSeedVin("C", vCount)

      const vehicle = await prisma.vehicle.create({
        data: {
          make: brand.name,
          model,
          year,
          price: Math.max(300000, price),
          mileage,
          vin,
          fuelType: fuel,
          transmission,
          bodyType: bodies[Math.floor(Math.random() * bodies.length)],
          color: colors[Math.floor(Math.random() * colors.length)],
          engineVolume: fuel === "ELECTRIC" ? null : parseFloat((1.4 + Math.random() * 2.5).toFixed(1)),
          power: fuel === "ELECTRIC" ? 150 + Math.floor(Math.random() * 400) : 90 + Math.floor(Math.random() * 300),
          driveType: drives[Math.floor(Math.random() * drives.length)],
          condition: conditions[Math.floor(Math.random() * conditions.length)],
          location: cities[Math.floor(Math.random() * cities.length)],
          description: getDesc(brand.name, model, year, fuel),
          images: JSON.stringify([getPhoto(brand.name)]),
          userId: seller.id,
          categoryId: category.id,
        },
      })

      await prisma.listing.create({
        data: {
          title: `${year} ${brand.name} ${model}`,
          description: getDesc(brand.name, model, year, fuel),
          price: Math.max(300000, price),
          isFeatured: Math.random() > 0.7,
          userId: seller.id,
          vehicleId: vehicle.id,
        },
      })
      vCount++
    }
  }

  // Запчасти
  const partTypes = ["ENGINE", "TRANSMISSION", "SUSPENSION", "BRAKES", "ELECTRICAL", "BODY", "INTERIOR", "WHEELS", "LIGHTING", "ACCESSORIES"]
  const partNames: Record<string, string[]> = {
    ENGINE: ["Двигатель в сборе", "Головка блока цилиндров", "Поршневая группа", "Турбина"],
    TRANSMISSION: ["АКПП в сборе", "МКПП", "Сцепление комплект", "Вариатор"],
    SUSPENSION: ["Амортизатор передний", "Стойка стабилизатора", "Рычаг подвески", "Пружины"],
    BRAKES: ["Колодки тормозные (комплект)", "Диски тормозные", "Суппорт", "Барабан"],
    ELECTRICAL: ["Генератор", "Стартер", "Аккумулятор", "Комплект проводки"],
    BODY: ["Бампер передний", "Капот", "Крыло заднее", "Дверь"],
    INTERIOR: ["Кожаный салон комплект", "Панель приборов", "Сиденья передние", "Руль"],
    WHEELS: ["Диски R17 (комплект)", "Шины зимние", "Диски R18 оригинал", "Колпаки"],
    LIGHTING: ["Фара LED", "Противотуманки", "Задний фонарь", "Поворотник"],
    ACCESSORIES: ["Видеорегистратор", "Эврик", "Коврики", "Брызговики"],
  }

  const partBrands = ["BMW", "Toyota", "Mercedes-Benz", "Audi", "Volkswagen", "Lada (ВАЗ)", "Hyundai", "Kia", "Geely", "Chery"]

  for (let i = 0; i < 25; i++) {
    const pt = partTypes[Math.floor(Math.random() * partTypes.length)]
    const names = partNames[pt]
    const name = names[Math.floor(Math.random() * names.length)]
    const make = partBrands[Math.floor(Math.random() * partBrands.length)]
    const brandData = BRANDS.find((b) => b.name === make)
    const model = brandData?.models?.[Math.floor(Math.random() * (brandData.models.length || 1))] || "X5"

    const part = await prisma.part.create({
      data: {
        name,
        price: 3000 + Math.floor(Math.random() * 200000),
        condition: conditions[Math.floor(Math.random() * conditions.length)],
        make,
        model,
        yearFrom: 2015,
        yearTo: 2024,
        partType: pt,
        location: cities[Math.floor(Math.random() * cities.length)],
        images: JSON.stringify(["https://images.unsplash.com/photo-1486754735734-325b5831c3ad?w=800&q=80"]),
        userId: seller.id,
      },
    })

    await prisma.listing.create({
      data: {
        title: name,
        description: `${make} ${model}`,
        price: part.price,
        userId: seller.id,
        partId: part.id,
      },
    })
    pCount++
  }

  console.log(`Готово: ${vCount} авто, ${pCount} запчастей, ${vCount + pCount} объявлений`)
  await prisma.$disconnect()
}

function getBasePrice(brand: string, year: number): number {
  const premium = ["BMW", "Mercedes-Benz", "Audi", "Porsche", "Lexus", "Land Rover", "Volvo", "Tesla"]
  const cheap = ["Lada (ВАЗ)", "УАЗ", "ГАЗ", "Renault", "Dacia", "Daewoo"]
  const cnEv = ["Zeekr", "BYD", "Li Auto", "Nio", "Xpeng", "Avatr", "Tesla"]

  let base = 2000000
  if (premium.includes(brand)) base = 5000000
  else if (cnEv.includes(brand)) base = 4500000
  else if (cheap.includes(brand)) base = 800000

  // Новее = дороже
  base += (year - 2018) * 400000
  return base
}

function getDesc(brand: string, model: string, year: number, fuel: string): string {
  const variants = [
    `Идеальное состояние. Один владелец, полное ТО у дилера. ${fuel === "ELECTRIC" ? "Электродвигатель, зарядка 80% за 40 мин." : "Двигатель работает идеально."} Зимняя резина в подарок.`,
    `${brand} ${model} ${year}. Не бит, не крашен. Все документы в порядке. Возможен trade-in.`,
    `Премиум комплектация. Кожаный салон, панорамная крыша, подогрев всех сидений, проекция, circle vision.`,
    `Машина в отличном состоянии. Регулярное обслуживание. Сигнализация с автозапуском. Тонировка.`,
    `Один хозяин, гаражное хранение. Сезонная резина. Фаркоп. К hook.`,
  ]
  return variants[Math.floor(Math.random() * variants.length)]
}

function getPhoto(brand: string): string {
  const photos: Record<string, string> = {
    BMW: "1556203940-3b0c7d18d8f7",
    "Mercedes-Benz": "1617886263173-8c00c5f3a1c0",
    Audi: "1606664515524-ed2f4ebfb455",
    Toyota: "1621007938521-0b4d0b8bf2f8",
    Porsche: "1503376780355-7e1b8d2c9e4a",
    Volkswagen: "1549317661-1d0d1b8f3e4a",
    Tesla: "1560958089b8f16525779fb2-1d0d1b8f3e4a",
    Lexus: "1614026480209-cb5c5c5d5c5d",
    Honda: "1605559424843-9e3c7dc3e4a4",
    Mazda: "1605559424843-9e3c7dc3e4a4",
    Kia: "1605559424843-9e3c7dc3e4a4",
    Hyundai: "1549924232-8d3b9c4f3e4a",
    "Lada (ВАЗ)": "1583121274602-3e2820c12298",
    Volvo: "1605559424843-9e3c7dc3e4a4",
    Skoda: "1605559424843-9e3c7dc3e4a4",
    Geely: "1605559424843-9e3c7dc3e4a4",
    Chery: "1605559424843-9e3c7dc3e4a4",
    Haval: "1605559424843-9e3c7dc3e4a4",
    Changan: "1605559424843-9e3c7dc3e4a4",
    Zeekr: "1560958089b8f16525779fb2-1d0d1b8f3e4a",
    BYD: "1605559424843-9e3c7dc3e4a4",
  }
  const id = photos[brand] || "1503376780355-7e1b8d2c9e4a"
  return `https://images.unsplash.com/photo-${id}?w=1200&q=80`
}

function createSeedVin(segment: string, index: number) {
  return `D${segment}${String(index).padStart(15, "0")}`
}

main().catch((e) => {
  console.error("Ошибка:", e)
  process.exit(1)
})
