import { prisma } from "@/lib/prisma"
import { getTelegramBotUsername, getTelegramMiniAppUrl, getTelegramRegistrationStep } from "@/lib/telegram"
import { markTelegramContactBlocked } from "@/lib/telegram-contacts"
import { FIRST_NUDGE_DELAY_MS, NUDGE_INTERVAL_MS, nudgeIndex, nudgeText } from "@/lib/signup-nudge-schedule"
import { WEEKLY_DIGEST_OFF_CALLBACK } from "@/lib/telegram-weekly-digest-message"
import { buildWeeklyDigestFor } from "@/lib/telegram-weekly-digest-content"
import { sendTelegramCampaignPhoto } from "@/lib/telegram-campaign-photo"

const BATCH_SIZE = 25
const SEND_INTERVAL_MS = 200
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function registrationKeyboard() {
  const username = getTelegramBotUsername()
  if (!username) throw new Error("Telegram bot username is required for registration campaigns")
  const mini = getTelegramMiniAppUrl()
  return { inline_keyboard: [
    [{ text: "✅ Продолжить регистрацию", url: `https://t.me/${username}?start=register` }],
    ...(mini ? [[{ text: "📱 Открыть мини-приложение", web_app: { url: mini } }]] : []),
    [{ text: "🔕 Не присылать", callback_data: WEEKLY_DIGEST_OFF_CALLBACK }],
  ] }
}

/** All historical cron endpoints share this durable per-contact claim.
 * Live account fields determine the campaign, never the stale contact flag.
 * An uncertain send consumes this week's attempt, avoiding duplicate spam.
 */
export async function processTelegramLifecycle(options: { now?: Date; dryRun?: boolean } = {}) {
  const now = options.now ?? new Date()
  const dueBefore = new Date(now.getTime() - NUDGE_INTERVAL_MS)
  const candidates = await prisma.telegramContact.findMany({
    where: {
      blocked: false, weeklyOptOut: false,
      startedAt: { lte: new Date(now.getTime() - FIRST_NUDGE_DELAY_MS) },
      AND: [
        { OR: [{ lastBroadcastAt: null }, { lastBroadcastAt: { lte: dueBefore } }] },
        { OR: [{ lastWeeklyAt: null }, { lastWeeklyAt: { lte: dueBefore } }] },
      ],
    },
    orderBy: [{ lastBroadcastAt: "asc" }, { startedAt: "asc" }],
    take: BATCH_SIZE,
    select: { telegramId: true, firstName: true, startedAt: true, lastBroadcastAt: true, lastWeeklyAt: true },
  })
  const result = { checked: candidates.length, due: 0, sent: 0, registration: 0, seller: 0, blocked: 0, failed: 0, skipped: 0, retryAfterSeconds: 0, dryRun: options.dryRun === true }
  for (const contact of candidates) {
    if (nudgeIndex(contact.startedAt, now) < 0) { result.skipped++; continue }
    const user = await prisma.user.findUnique({ where: { telegramId: contact.telegramId }, select: {
      email: true, emailVerified: true, phone: true, telegramVerifiedAt: true, hashedPassword: true,
      accountStatus: true, regReminderAt: true,
    } })
    const restricted = user && user.accountStatus !== "ACTIVE"
    const legacyRecent = user?.regReminderAt && user.regReminderAt > dueBefore
    if (!restricted && !legacyRecent) result.due++
    if (result.dryRun) continue
    const claim = await prisma.telegramContact.updateMany({
      where: { telegramId: contact.telegramId, blocked: false, weeklyOptOut: false,
        lastBroadcastAt: contact.lastBroadcastAt, lastWeeklyAt: contact.lastWeeklyAt },
      data: { lastBroadcastAt: legacyRecent ? user.regReminderAt : now },
    })
    if (claim.count !== 1 || restricted || legacyRecent) { result.skipped++; continue }
    const started = Date.now()
    try {
      // Re-read after the claim: registration may have finished during the scan.
      const current = await prisma.user.findUnique({ where: { telegramId: contact.telegramId }, select: {
        email: true, emailVerified: true, phone: true, telegramVerifiedAt: true, hashedPassword: true, accountStatus: true,
      } })
      if (current && current.accountStatus !== "ACTIVE") { result.skipped++; continue }
      const registered = getTelegramRegistrationStep(current) === "complete"
      const stillAllowed = await prisma.telegramContact.updateMany({ where: {
        telegramId: contact.telegramId, lastBroadcastAt: now, blocked: false, weeklyOptOut: false,
      }, data: { registered } })
      if (stillAllowed.count !== 1) { result.skipped++; continue }
      if (registered) {
        const message = await buildWeeklyDigestFor(contact.telegramId)
        await sendTelegramCampaignPhoto(contact.telegramId, "seller", message.text, message.reply_markup)
        result.seller++
      } else {
        await sendTelegramCampaignPhoto(contact.telegramId, "registration", nudgeText(nudgeIndex(contact.startedAt, now), contact.firstName), registrationKeyboard())
        result.registration++
      }
      await prisma.telegramContact.updateMany({ where: { telegramId: contact.telegramId, lastBroadcastAt: now }, data: { lastWeeklyAt: now } })
      result.sent++
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const retryAfter = /retry after (\d+)/i.exec(message)
      if (retryAfter) {
        // A definite flood-limit rejection did not deliver the photo. Release
        // only our claim and stop; untouched contacts wait for the next cron.
        await prisma.telegramContact.updateMany({ where: {
          telegramId: contact.telegramId, lastBroadcastAt: now, lastWeeklyAt: contact.lastWeeklyAt,
        }, data: { lastBroadcastAt: contact.lastBroadcastAt } })
        result.retryAfterSeconds = Number(retryAfter[1])
        result.failed++
        break
      }
      if (/blocked by the user|user is deactivated|chat not found/i.test(message)) {
        await markTelegramContactBlocked(contact.telegramId)
        result.blocked++
      } else { result.failed++; console.error("[telegram-lifecycle] Delivery failed:", message) }
    } finally {
      const elapsed = Date.now() - started
      if (elapsed < SEND_INTERVAL_MS) await sleep(SEND_INTERVAL_MS - elapsed)
    }
  }
  return result
}
