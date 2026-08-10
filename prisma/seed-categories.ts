import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

interface CatData { type: string; brands: [string, string[]][]; bodyTypes: string[]; fuels: string[] }

const CATEGORIES: CatData[] = [
  {
    type: "MOTORCYCLE",
    brands: [
      ["Yamaha", ["YZF-R1", "MT-07", "MT-09", "XSR900", "FZ-6", "Bolt"]],
      ["Kawasaki", ["Ninja 400", "Z900", "Versys 650", "Vulcan S", "KLR650"]],
      ["Suzuki", ["GSX-R750", "V-Strom 650", "Hayabusa", "SV650"]],
      ["Honda", ["CBR600RR", "Africa Twin", "CB650R", "Gold Wing"]],
      ["BMW Motorrad", ["R1250GS", "S1000RR", "F800GS", "R nineT"]],
      ["Harley-Davidson", ["Sportster", "Street Glide", "Softail", "Iron 883"]],
      ["Ducati", ["Panigale V4", "Monster 821", "Multistrada", "Scrambler"]],
      ["KTM", ["390 Duke", "790 Adventure", "1290 Super Duke"]],
    ],
    bodyTypes: ["OTHER"],
    fuels: ["GASOLINE"],
  },
  {
    type: "TRUCK",
    brands: [
      ["МАЗ", ["6430", "5440", "6312", "5516"]],
      ["ГАЗ", ["Valve Next", "Соболь", "ГАЗон Next"]],
      ["Volvo Trucks", ["FH16", "FMX", "FH", "FE"]],
      ["Scania", ["R450", "S650", "P280", "G410"]],
      ["MAN", ["TGX", "TGS", "TGL", "TGA"]],
      ["Mercedes-Benz Trucks", ["Actros", "Arocs", "Atego", "Unimog"]],
      ["DAF", ["XF", "CF", "LF"]],
      ["Renault Trucks", ["T High", "K-Series", "T-Series"]],
      ["КамАЗ", ["6520", "43118", "5490", "65115"]],
    ],
    bodyTypes: ["OTHER"],
    fuels: ["DIESEL"],
  },
  {
    type: "SPECIAL",
    brands: [
      ["Komatsu", ["PC200", "D65PX", "WA380", "PC300"]],
      ["Hitachi", ["ZX200", "ZX330", "ZX140"]],
      ["JCB", ["3CX", "4CX", "JS220", "540-170"]],
      ["Volvo CE", ["EC220", "L120H", "EC380"]],
      ["XCMG", ["XE215", "LW500", "GR215"]],
      ["Liebherr", ["R 926", "L 586", "PR 736"]],
      ["Doosan", ["DX225", "DL280", "DX300"]],
      ["Hyundai CE", ["R210", "HL760", "R330"]],
    ],
    bodyTypes: ["OTHER"],
    fuels: ["DIESEL"],
  },
  {
    type: "WATER",
    brands: [
      ["Sea-Doo", ["GTX 300", "RXT-X", "Spark", "Wake Pro"]],
      ["Bayliner", ["VR5", "M17", "Element F18"]],
      ["MasterCraft", ["XT21", "NXT22", "XStar"]],
      ["Malibu", ["Response Txi", "Wakesetter 23LSV"]],
      ["Yamaha Marine", ["242X", "212X", "SX210"]],
      ["Mercury", ["Pro XS 300", "Verado 350"]],
      ["Honda Marine", ["BF250", "BF150"]],
      ["Suzuki Marine", ["DF300", "DF200"]],
    ],
    bodyTypes: ["OTHER"],
    fuels: ["GASOLINE"],
  },
  {
    type: "AIR",
    brands: [
      ["Airbus Helicopters", ["H125", "H130", "H145", "H160"]],
      ["Bell Helicopter", ["407", "429", "505", "412"]],
      ["Robinson", ["R44", "R66", "R22"]],
      ["Cessna", ["172 Skyhawk", "182 Skylane", "206 Stationair", "Citation"]],
      ["Piper", ["Cherokee", "Arrow", "Seneca"]],
      ["Eurocopter", ["EC120", "EC130", "AS350"]],
      ["Beechcraft", ["King Air 350", "Baron G58"]],
      ["Mil", ["Mi-8", "Mi-17", "Mi-26"]],
    ],
    bodyTypes: ["OTHER"],
    fuels: ["GASOLINE"],
  },
]

const CITIES = ["Москва", "Санкт-Петербург", "Сочи", "Краснодар", "Казань", "Екатеринбург", "Владивосток", "Ростов-на-Дону", "Самара", "Уфа"]
const CONDITIONS = ["NEW", "LIKE_NEW", "EXCELLENT", "GOOD", "FAIR"]
const DOCS = ["CLEAN", "CLEAN", "CLEAN", "ISSUES"]
const DAMAGE = ["NONE", "NONE", "NONE", "REPAINTED", "DAMAGED"]
const SELLERS = ["OWNER", "OWNER", "DEALER"]
const COLORS = ["Белый", "Чёрный", "Красный", "Синий", "Оранжевый", "Жёлтый", "Зелёный"]
const CATEGORY_META: Record<string, { name: string; description: string; icon: string }> = {
  MOTORCYCLE: { name: "Мототехника", description: "Мотоциклы, скутеры и квадроциклы", icon: "Motorbike" },
  TRUCK: { name: "Грузовой транспорт", description: "Коммерческий и грузовой транспорт", icon: "Truck" },
  SPECIAL: { name: "Спецтехника", description: "Строительная, дорожная и сельскохозяйственная техника", icon: "Tractor" },
  WATER: { name: "Водный транспорт", description: "Катера, яхты и гидроциклы", icon: "Speedboat" },
  AIR: { name: "Воздушный транспорт", description: "Самолёты, вертолёты и другая авиация", icon: "Plane" },
}

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }
function randInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min }
function createSeedVin(vehicleType: string, index: number) {
  const segment = vehicleType === "MOTORCYCLE" ? "M" : vehicleType === "TRUCK" ? "T" : "C"
  return `D${segment}${String(index).padStart(15, "0")}`
}

async function main() {
  const admin = await prisma.user.findFirst({ where: { email: "admin@automart.ru" } })
    || await prisma.user.findFirst({})
  if (!admin) { console.error("No user found"); return }
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

  let created = 0
  for (const cat of CATEGORIES) {
    const count = cat.type === "MOTORCYCLE" ? 30 : cat.type === "TRUCK" ? 25 : 20
    for (let i = 0; i < count; i++) {
      const [make, models] = pick(cat.brands)
      const model = pick(models)
      const year = randInt(2008, 2024)
      const isRoadTransport = cat.type === "MOTORCYCLE" || cat.type === "TRUCK"
      const mileage = isRoadTransport ? randInt(1000, 150000) : null
      const price = cat.type === "AIR" ? randInt(15, 500) * 1000000
        : cat.type === "WATER" ? randInt(500, 15000) * 1000
        : cat.type === "SPECIAL" ? randInt(2000, 25000) * 1000
        : cat.type === "TRUCK" ? randInt(1500, 20000) * 1000
        : randInt(200, 3500) * 1000

      const vin = isRoadTransport ? createSeedVin(cat.type, i) : null
      const existing = vin ? await prisma.vehicle.findUnique({ where: { vin } }).catch(() => null) : null
      if (existing) continue
      const categoryId = categoryIds.get(cat.type)
      if (!categoryId) throw new Error(`Missing category for ${cat.type}`)

      const vehicle = await prisma.vehicle.create({
        data: {
          make, model, year, price, mileage, vin,
          operatingHours: cat.type === "SPECIAL" || cat.type === "WATER" ? randInt(100, 10000) : null,
          flightHours: cat.type === "AIR" ? randInt(100, 5000) : null,
          serialNumber: cat.type === "SPECIAL" ? `SN-${String(i).padStart(8, "0")}` : null,
          registrationNumber: cat.type === "WATER" ? `HIN-${String(i).padStart(8, "0")}` : cat.type === "AIR" ? `RA-${String(i).padStart(8, "0")}` : null,
          fuelType: cat.type === "AIR" ? (/(Cessna|Piper|Beechcraft)/i.test(make) ? "AVGAS" : "JET_A1") : cat.type === "SPECIAL" || cat.type === "TRUCK" ? "DIESEL" : "GASOLINE",
          transmission: cat.type === "MOTORCYCLE" ? "MANUAL" : cat.type === "TRUCK" ? pick(["MANUAL", "AUTOMATIC", "ROBOTIC"]) : "",
          bodyType: pick(cat.bodyTypes),
          color: pick(COLORS),
          engineVolume: cat.type === "AIR" ? null : parseFloat((randInt(10, 60) / 10).toFixed(1)),
          power: randInt(15, 600),
          driveType: isRoadTransport ? pick(["FWD", "RWD", "AWD"]) : null,
          condition: pick(CONDITIONS),
          vehicleType: cat.type,
          location: pick(CITIES),
          description: `${make} ${model} ${year} года. ${pick(["Отличное состояние", "Идеал", "Гаражное хранение", "Сервисная книжка"])}.`,
          images: null,
          userId: admin.id,
          categoryId,
          steeringWheel: "LEFT",
          ownersCount: randInt(1, 4),
          documentsStatus: pick(DOCS),
          damageInfo: pick(DAMAGE),
          sellerType: pick(SELLERS),
          availability: pick(["IN_STOCK", "IN_STOCK", "IN_TRANSIT"]),
          customsCleared: Math.random() < 0.9,
          keywords: pick(["сервисная книжка", "не бита", "один хозяин", "ТО вовремя"]),
        },
      })

      await prisma.listing.create({
        data: {
          title: `${year} ${make} ${model}`,
          description: vehicle.description,
          price,
          userId: admin.id,
          vehicleId: vehicle.id,
          views: randInt(5, 300),
        },
      })
      created++
    }
    console.log(`${cat.type}: done`)
  }
  console.log(`Created ${created} vehicles across categories`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
