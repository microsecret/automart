import { prisma } from "@/lib/prisma"
import { isModeratedChat, telegramApi } from "@/lib/telegram"
import { guardTelegramBots } from "@/lib/telegram-bot-guard.mjs"

export async function moderateTelegramBotUpdate(update: unknown) {
  const ownBotId = (process.env.TELEGRAM_BOT_TOKEN || "").split(":")[0]
  if (!/^\d+$/.test(ownBotId)) return false
  return guardTelegramBots(update, {
    ownBotId,
    enabled: isModeratedChat,
    api: telegramApi,
    approved: async (chatId: string, botId: string) => Boolean(await prisma.telegramBotApproval.findUnique({ where: { chatId_botId: { chatId, botId } } })),
    approve: async (chatId: string, botId: string, approvedBy: string) => prisma.telegramBotApproval.upsert({
      where: { chatId_botId: { chatId, botId } },
      create: { chatId, botId, approvedBy }, update: { approvedBy, approvedAt: new Date() },
    }),
    forget: async (chatId: string, botId: string) => prisma.telegramBotApproval.deleteMany({ where: { chatId, botId } }),
    warn: (reason: string, chatId: string) => console.warn("Telegram bot guard:", reason, { chatId }),
  })
}
