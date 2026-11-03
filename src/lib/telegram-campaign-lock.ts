import { access } from "node:fs/promises"
import path from "node:path"

/** The live wave owns this private marker. Fail closed on filesystem errors;
 * a crashed wave is resumed/repaired explicitly, never by expiring its lock.
 */
export async function isTelegramCampaignWaveActive() {
  try {
    await access(path.join(process.cwd(), ".tmp/telegram-campaign-active.json"))
    return true
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return false
    throw error
  }
}
