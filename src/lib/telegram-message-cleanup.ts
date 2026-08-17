import { prisma } from "@/lib/prisma"
import { telegramApi } from "@/lib/telegram"

const AUTO_DELETE_DELAY_MS = 5 * 60 * 1000
const MAX_DELETE_ATTEMPTS = 5
const MIN_DELETE_DELAY_MS = 30_000
const MAX_DELETE_DELAY_MS = 60 * 60 * 1000

function scheduleDelayMs() {
  const configured = Number(process.env.TELEGRAM_SYSTEM_MESSAGE_TTL_MS || "")
  if (!Number.isFinite(configured) || configured <= 0) return AUTO_DELETE_DELAY_MS
  return Math.max(MIN_DELETE_DELAY_MS, Math.min(MAX_DELETE_DELAY_MS, Math.floor(configured)))
}

function isFinalTelegramDeleteError(message: string) {
  return /message to delete not found|message can't be deleted|message identifier is not specified/iu.test(message)
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
  const now = new Date()
  const due = await prisma.telegramMessageCleanup.findMany({
    where: { processedAt: null, deleteAt: { lte: now }, attempts: { lt: MAX_DELETE_ATTEMPTS } },
    orderBy: { deleteAt: "asc" },
    take: Math.max(1, Math.min(limit, 100)),
  })

  let deleted = 0
  let failed = 0
  for (const item of due) {
    const claim = await prisma.telegramMessageCleanup.updateMany({
      where: { id: item.id, processedAt: null, attempts: item.attempts },
      data: { attempts: { increment: 1 } },
    })
    if (!claim.count) continue

    try {
      await telegramApi("deleteMessage", { chat_id: item.chatId, message_id: item.messageId })
      await prisma.telegramMessageCleanup.update({ where: { id: item.id }, data: { processedAt: new Date(), lastError: null } })
      deleted += 1
    } catch (error) {
      const message = error instanceof Error ? error.message : "Неизвестная ошибка Telegram"
      const attempts = item.attempts + 1
      const finalFailure = attempts >= MAX_DELETE_ATTEMPTS || isFinalTelegramDeleteError(message)
      await prisma.telegramMessageCleanup.update({
        where: { id: item.id },
        data: {
          lastError: message.slice(0, 500),
          processedAt: finalFailure ? new Date() : null,
          deleteAt: finalFailure ? item.deleteAt : new Date(Date.now() + Math.min(5 * 60_000, attempts * 30_000)),
        },
      })
      failed += 1
    }
  }

  return { checked: due.length, deleted, failed }
}
