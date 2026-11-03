import { prisma } from "@/lib/prisma"
import { getTelegramPageUrl, isTelegramUserRegistered } from "@/lib/telegram"
import { ensureReferralCode } from "@/lib/referral-accrual"
import { referralCodeForTelegram } from "@/lib/referral"
import { getSiteUrl } from "@/lib/site-url"
import { CREATE_VEHICLE_HREF } from "@/lib/navigation-registry"
import { buildWeeklyDigestMessage } from "@/lib/telegram-weekly-digest-message"

export async function buildWeeklyDigestFor(telegramId: string) {
  const user = await prisma.user.findUnique({
    where: { telegramId },
    select: { id: true, referralCode: true, accountStatus: true, email: true, emailVerified: true, phone: true, telegramVerifiedAt: true, hashedPassword: true },
  })
  const hasAccount = user?.accountStatus === "ACTIVE" && isTelegramUserRegistered(user)
  const code = hasAccount && user
    ? user.referralCode || await ensureReferralCode(user.id)
    : referralCodeForTelegram(telegramId)
  const site = getSiteUrl()
  const target = (href: string) => {
    const mini = getTelegramPageUrl(href)
    return mini ? { url: mini, webApp: true } : { url: `${site}${href}`, webApp: false }
  }
  return buildWeeklyDigestMessage({
    inviteUrl: `${site}/?ref=${encodeURIComponent(code)}`, hasAccount,
    createListing: target(CREATE_VEHICLE_HREF),
    createPart: target("/listings/create/part"), dashboard: target("/dashboard"),
  })
}
