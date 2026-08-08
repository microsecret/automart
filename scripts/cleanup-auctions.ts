/**
 * Скрипт очистки старых аукционных лотов.
 * Запуск через cron: 0 3 * * * cd /root/AutoMart && npx tsx scripts/cleanup-auctions.ts
 */
import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)

  // 1. Лоты без заявок старше 30 дней → EXPIRED
  const expired = await prisma.auctionListing.updateMany({
    where: { status: "ACTIVE", createdAt: { lt: thirtyDaysAgo }, inquiries: { none: {} } },
    data: { status: "EXPIRED" },
  })
  console.log("Expired (no inquiries, 30+ days): " + expired.count)

  // 2. Лоты с прошедшей датой аукциона (7+ дней назад) → SOLD
  const sold = await prisma.auctionListing.updateMany({
    where: { status: "ACTIVE", auctionDate: { lt: sevenDaysAgo } },
    data: { status: "SOLD" },
  })
  console.log("Marked SOLD (auction passed 7+ days ago): " + sold.count)

  // 3. Удаление очень старых EXPIRED (90+ дней)
  const deleted = await prisma.auctionListing.deleteMany({
    where: { status: "EXPIRED", updatedAt: { lt: ninetyDaysAgo } },
  })
  console.log("Deleted very old expired (90+ days): " + deleted.count)

  const active = await prisma.auctionListing.count({ where: { status: "ACTIVE" } })
  const totalSold = await prisma.auctionListing.count({ where: { status: "SOLD" } })
  const totalExpired = await prisma.auctionListing.count({ where: { status: "EXPIRED" } })
  console.log("Final: " + active + " active, " + totalSold + " sold, " + totalExpired + " expired")
}

main().catch(console.error).finally(() => prisma.$disconnect())
