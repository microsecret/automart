import { processTelegramLifecycle } from "@/lib/telegram-lifecycle-campaign"

/** Compatibility endpoint; all scheduled campaigns share one weekly claim. */
export async function processSignupNudges(now = new Date()) {
  return processTelegramLifecycle({ now })
}
