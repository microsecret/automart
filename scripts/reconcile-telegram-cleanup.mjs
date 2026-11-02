// Reconcile only recorded bot campaign IDs. No sending and no chat history guessing.
import { PrismaClient } from "@prisma/client"
import { sqliteConnectionUrl } from "../src/lib/prisma-connection-policy.mjs"
const prisma = new PrismaClient({ datasources: { db: { url: sqliteConnectionUrl(process.env.DATABASE_URL) } } })
const apply = process.argv.includes("--apply")
const boundary = new Date(Date.now() - 48 * 60 * 60_000)
try {
  const records = [
    ...(await prisma.auctionTelegramPost.findMany({ where: { createdAt: { gt: boundary }, messageId: { not: null } } })).map(row => ({ ...row, sentAt: row.createdAt })),
    ...(await prisma.fuelInvitePost.findMany({ where: { publishedAt: { gt: boundary } } })).map(row => ({ ...row, sentAt: row.publishedAt })),
    ...(await prisma.fuelDigestPost.findMany({ where: { publishedAt: { gt: boundary } } })).map(row => ({ ...row, sentAt: row.publishedAt })),
  ]
  let queued = 0
  for (const row of records) {
    const messageId = Number(row.messageId)
    if (!Number.isSafeInteger(messageId) || messageId <= 0 || !row.chatId.startsWith("-")) continue
    if (apply) await prisma.telegramMessageCleanup.upsert({
      where: { chatId_messageId: { chatId: row.chatId, messageId } },
      create: { chatId: row.chatId, messageId, createdAt: row.sentAt, deleteAt: new Date(row.sentAt.getTime() + 5 * 60_000) },
      update: {},
    })
    queued += 1
  }
  const retryable = { processedAt: { not: null }, createdAt: { gt: boundary }, lastError: { not: null }, NOT: { lastError: { contains: "message to delete not found" } } }
  const retry = apply ? (await prisma.telegramMessageCleanup.updateMany({ where: retryable, data: { processedAt: null, deleteAt: new Date() } })).count
    : await prisma.telegramMessageCleanup.count({ where: retryable })
  console.log(JSON.stringify({ apply, recordedCampaignMessages: queued, retryableFailures: retry }))
} finally { await prisma.$disconnect() }
