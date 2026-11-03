import { prisma } from "@/lib/prisma"
import { processTelegramLifecycle } from "@/lib/telegram-lifecycle-campaign"
import { buildWeeklyDigestFor } from "@/lib/telegram-weekly-digest-content"
import { sendTelegramCampaignPhoto } from "@/lib/telegram-campaign-photo"
import { WEEKLY_DIGEST_INTERVAL_MS } from "@/lib/telegram-weekly-digest-message"

export { buildWeeklyDigestFor }

/** Explicit admin preview does not change the automatic campaign clock. */
export async function sendWeeklyDigestPreview(telegramId: string) {
  const message = await buildWeeklyDigestFor(telegramId)
  await sendTelegramCampaignPhoto(telegramId, "seller", message.text, message.reply_markup)
}

export async function processWeeklyDigest(options: { dryRun?: boolean } = {}) {
  return processTelegramLifecycle(options)
}

export async function setWeeklyDigestOptOut(telegramId: string, optOut: boolean) {
  await prisma.telegramContact.updateMany({ where: { telegramId }, data: { weeklyOptOut: optOut } })
}

export async function getWeeklyDigestStats() {
  const now = Date.now()
  const [subscribed, optedOut, blocked, sentLast7d] = await Promise.all([
    prisma.telegramContact.count({ where: { blocked: false, weeklyOptOut: false } }),
    prisma.telegramContact.count({ where: { weeklyOptOut: true } }),
    prisma.telegramContact.count({ where: { blocked: true } }),
    prisma.telegramContact.count({ where: { lastWeeklyAt: { gte: new Date(now - WEEKLY_DIGEST_INTERVAL_MS) } } }),
  ])
  return { subscribed, optedOut, blocked, sentLast7d }
}
