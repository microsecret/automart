import { processTelegramLifecycle } from "@/lib/telegram-lifecycle-campaign"

/** Keep the historical cron URL without a second, daily reminder stream. */
export async function processRegistrationReminders(now = new Date()) {
  const result = await processTelegramLifecycle({ now })
  return { ...result, candidates: result.checked, delivered: result.sent }
}
