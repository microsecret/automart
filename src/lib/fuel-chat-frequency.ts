import { prisma } from "@/lib/prisma"

export async function hasRecentFuelChatPost(chatId: string, now: Date) {
  const configured = Number(process.env.FUEL_INVITE_INTERVAL_HOURS)
  const hours = Number.isFinite(configured) && configured > 0 ? Math.max(72, configured) : 72
  const where = { chatId, publishedAt: { gt: new Date(now.getTime() - hours * 60 * 60_000) } }
  const [invite, digest] = await Promise.all([
    prisma.fuelInvitePost.findFirst({ where, select: { id: true } }),
    prisma.fuelDigestPost.findFirst({ where, select: { id: true } }),
  ])
  return Boolean(invite || digest)
}
