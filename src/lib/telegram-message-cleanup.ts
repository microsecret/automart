import { prisma } from "@/lib/prisma"
import { telegramApi } from "@/lib/telegram"
import { runTelegramCleanup } from "./telegram-cleanup-worker.mjs"

const AUTO_DELETE_DELAY_MS = 5 * 60 * 1000
const MIN_DELETE_DELAY_MS = 30_000
const MAX_DELETE_DELAY_MS = 60 * 60 * 1000

function scheduleDelayMs() {
  const configured = Number(process.env.TELEGRAM_SYSTEM_MESSAGE_TTL_MS || "")
  if (!Number.isFinite(configured) || configured <= 0) return AUTO_DELETE_DELAY_MS
  return Math.max(MIN_DELETE_DELAY_MS, Math.min(MAX_DELETE_DELAY_MS, Math.floor(configured)))
}

export async function scheduleTelegramMessageCleanup(chatId: string, messageId: number, deleteAt?: Date | number) {
  if (!chatId || !Number.isInteger(messageId) || messageId <= 0) return
  const timestamp = deleteAt ? new Date(deleteAt).getTime() : Date.now() + scheduleDelayMs()
  await prisma.telegramMessageCleanup.upsert({
    where: { chatId_messageId: { chatId, messageId } },
    create: { chatId, messageId, deleteAt: new Date(timestamp) },
    update: { deleteAt: new Date(timestamp), attempts: 0, lastError: null, processedAt: null },
  })
}

export async function processDueTelegramMessageCleanup(limit = 50) {
  return runTelegramCleanup({ store: prisma.telegramMessageCleanup, api: telegramApi }, limit)
}
