import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

const USERS = [
  { name: "Иван Петров", email: "ivan@automart.ru", city: "Москва" },
  { name: "Анна Сидорова", email: "anna@automart.ru", city: "Санкт-Петербург" },
  { name: "Дмитрий Козлов", email: "dmitry@automart.ru", city: "Екатеринбург" },
  { name: "Мария Иванова", email: "maria@automart.ru", city: "Казань" },
  { name: "Сергей Волков", email: "sergey@automart.ru", city: "Новосибирск" },
  { name: "Елена Морозова", email: "elena@automart.ru", city: "Краснодар" },
  { name: "Александр Смирнов", email: "alex@automart.ru", city: "Ростов-на-Дону" },
  { name: "Ольга Кузнецова", email: "olga@automart.ru", city: "Самара" },
]

const REVIEW_TEXTS = [
  "Отличный продавец, всё честно. Машина в описанном состоянии.",
  "Быстро ответил, встретились в тот же день. Рекомендую!",
  "Сделка прошла через безопасную оплату, всё гладко.",
  "Спасибо за честность, авто лучше чем ожидал.",
  "Продавец адекватный, торг уместен. Покупкой доволен.",
  "Всё как в объявлении, без сюрпризов. 5 звёзд!",
  "Хороший продавец, но опоздал на встречу на 20 мин.",
  "Рекомендую! Честный, показал все косяки сразу.",
]

async function main() {
  if (process.env.ALLOW_DEMO_SEED !== "true") {
    throw new Error("Demo users and reviews are disabled. Set ALLOW_DEMO_SEED=true only for an isolated development database.")
  }

  let created = 0
  for (const u of USERS) {
    const ex = await prisma.user.findUnique({ where: { email: u.email } }).catch(() => null)
    if (ex) continue
    await prisma.user.create({
      data: { name: u.name, email: u.email, role: "USER", hashedPassword: "$2a$10$demo" + Date.now() },
    })
    created++
  }
  console.log("Users created:", created)

  // Создать отзывы на существующие listings
  const users = await prisma.user.findMany({ where: { role: "USER" } })
  const listings = await prisma.listing.findMany({ take: 50 })

  let reviewsCreated = 0
  for (const listing of listings) {
    if (Math.random() < 0.4) {
      const reviewer = users[Math.floor(Math.random() * users.length)]
      if (reviewer.id === listing.userId) continue
      const existing = await prisma.review.findFirst({ where: { userId: reviewer.id, listingId: listing.id } }).catch(() => null)
      if (existing) continue
      await prisma.review.create({
        data: {
          rating: Math.floor(Math.random() * 2) + 4,
          comment: REVIEW_TEXTS[Math.floor(Math.random() * REVIEW_TEXTS.length)],
          userId: reviewer.id,
          listingId: listing.id,
        },
      })
      reviewsCreated++
    }
  }
  console.log("Reviews created:", reviewsCreated)
}

main().catch(console.error).finally(() => prisma.$disconnect())
