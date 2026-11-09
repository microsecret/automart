import { prisma } from "@/lib/prisma"

// Shared across the two route bundles in this process. The external cron
// must also use one shared flock when multiple application workers run.
const fuelWorkerState = globalThis as typeof globalThis & { __lewheelFuelBroadcastRunning?: boolean }
export async function withFuelChatBroadcast<T>(work: () => Promise<T>, busy: T): Promise<T> {
  if (fuelWorkerState.__lewheelFuelBroadcastRunning) return busy
  fuelWorkerState.__lewheelFuelBroadcastRunning = true
  try { return await work() } finally { fuelWorkerState.__lewheelFuelBroadcastRunning = false }
}

export async function hasRecentFuelChatPost(chatId: string, now: Date) {
  const configured = Number(process.env.FUEL_INVITE_INTERVAL_HOURS)
  // A longer operator override is respected; even an invalid/short override
  // cannot send an invitation and a digest within the same rolling eight hours.
  const hours = Number.isFinite(configured) && configured > 0 ? Math.max(8, configured) : 8
  const where = { chatId, publishedAt: { gt: new Date(now.getTime() - hours * 60 * 60_000) } }
  const [invite, digest] = await Promise.all([
    prisma.fuelInvitePost.findFirst({ where, select: { id: true } }),
    prisma.fuelDigestPost.findFirst({ where, select: { id: true } }),
  ])
  return Boolean(invite || digest)
}
