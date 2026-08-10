import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

const STEERING = ["LEFT", "RIGHT"]
const DOCS = ["CLEAN", "CLEAN", "CLEAN", "ISSUES", "MISSING"] // взвешенно
const DAMAGE = ["NONE", "NONE", "NONE", "NONE", "REPAINTED", "DAMAGED", "SEVERE"]
const SELLER = ["OWNER", "OWNER", "OWNER", "DEALER", "DEALER"]
const AVAIL = ["IN_STOCK", "IN_STOCK", "IN_STOCK", "IN_TRANSIT", "ON_ORDER"]
const COLORS = ["Белый", "Чёрный", "Серебристый", "Серый", "Синий", "Красный", "Зелёный", "Коричневый", "Бордовый", "Золотистый"]

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }

async function main() {
  const vehicles = await prisma.vehicle.findMany()
  console.log(`Updating ${vehicles.length} vehicles...`)

  let updated = 0
  for (const v of vehicles) {
    const isRightWheel = Math.random() < 0.12 // 12% правый руль
    const isNew = v.condition === "NEW" || (v.mileage !== null && v.mileage < 100)
    const owners = isNew ? 1 : Math.floor(Math.random() * 4) + 1
    const isDamaged = Math.random() < 0.25 // 25% имеют повреждения
    const isDealer = Math.random() < 0.35 // 35% дилеры

    await prisma.vehicle.update({
      where: { id: v.id },
      data: {
        steeringWheel: isRightWheel ? "RIGHT" : "LEFT",
        ownersCount: owners,
        documentsStatus: isNew ? "CLEAN" : pick(DOCS),
        damageInfo: isDamaged ? pick(DAMAGE.filter(d => d !== "NONE")) : "NONE",
        sellerType: isDealer ? "DEALER" : "OWNER",
        availability: isNew && Math.random() < 0.3 ? "IN_TRANSIT" : pick(AVAIL),
        customsCleared: Math.random() < 0.92, // 92% растаможены
        color: v.color || pick(COLORS),
        keywords: isNew ? "новый, гарантия, дилер" : pick([
          "один хозяин, гаражное хранение",
          "не бита, не крашена",
          "сервисная книжка, ТО вовремя",
          "зимняя резина в подарок",
          "панорама, кожа, подогрев",
          "VAG, оригинал, чистый",
        ]),
      },
    })
    updated++
    if (updated % 50 === 0) console.log(`  ...${updated}`)
  }

  console.log(`Done! Updated ${updated} vehicles with new fields`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
