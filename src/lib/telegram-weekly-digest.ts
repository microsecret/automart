import { prisma } from "@/lib/prisma"
import { getTelegramPageUrl, telegramApi } from "@/lib/telegram"
import { markTelegramContactBlocked } from "@/lib/telegram-contacts"
import { ensureReferralCode } from "@/lib/referral-accrual"
import { referralCodeForTelegram } from "@/lib/referral"
import { getSiteUrl } from "@/lib/site-url"
import { CREATE_VEHICLE_HREF } from "@/lib/navigation-registry"
import {
  WEEKLY_DIGEST_FIRST_DELAY_MS,
  WEEKLY_DIGEST_INTERVAL_MS,
  WEEKLY_DIGEST_QUIET_MS,
  buildWeeklyDigestMessage,
  isWeeklyDigestDue,
} from "@/lib/telegram-weekly-digest-message"

/**
 * Еженедельное письмо всем, кто нажал «Старт» в боте.
 *
 * Запускается раз в день, а неделя считается для каждого человека своя:
 * от «Старта» и от прошлого письма. Так нагрузка размазана по дням, и
 * новичок не получает письмо в день знакомства с ботом.
 *
 * Отписка — кнопкой «Не присылать» (weeklyOptOut). Заблокировавших бота
 * помечает общая обработка ошибок, и им больше ничего не уходит.
 */

const MESSAGES_PER_SECOND = 20
/** Больше за один прогон не шлём: остаток уйдёт завтра, запрос не висит. */
const MAX_PER_RUN = 400
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export type WeeklyDigestResult = {
  due: number
  sent: number
  blocked: number
  failed: number
  dryRun: boolean
}

async function inviteCodeFor(telegramId: string): Promise<{ code: string; hasAccount: boolean }> {
  const user = await prisma.user.findFirst({
    where: { telegramId, accountStatus: "ACTIVE" },
    select: { id: true, referralCode: true },
  })
  if (user) return { code: user.referralCode || await ensureReferralCode(user.id), hasAccount: true }

  const code = referralCodeForTelegram(telegramId)
  await prisma.telegramContact.updateMany({ where: { telegramId, referralCode: null }, data: { referralCode: code } }).catch(() => undefined)
  return { code, hasAccount: false }
}

export async function buildWeeklyDigestFor(telegramId: string) {
  const { code, hasAccount } = await inviteCodeFor(telegramId)
  const site = getSiteUrl()
  const fuelMini = getTelegramPageUrl("/services/fuel-map")
  const createMini = getTelegramPageUrl(CREATE_VEHICLE_HREF)
  return buildWeeklyDigestMessage({
    // Друг попадает сразу на карту АЗС — ради неё бота и советуют.
    inviteUrl: `${site}/services/fuel-map?ref=${encodeURIComponent(code)}`,
    hasAccount,
    fuelMap: fuelMini ? { url: fuelMini, webApp: true } : { url: `${site}/services/fuel-map`, webApp: false },
    createListing: createMini ? { url: createMini, webApp: true } : { url: `${site}${CREATE_VEHICLE_HREF}`, webApp: false },
  })
}

/** Отправка с учётом «подождите N секунд» от Telegram — один повтор. */
async function sendWithRetry(chatId: string, payload: Record<string, unknown>) {
  try {
    await telegramApi("sendMessage", { chat_id: chatId, ...payload })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const retryAfter = /retry after (\d+)/i.exec(message)
    if (!retryAfter) throw error
    await sleep((Number(retryAfter[1]) + 1) * 1000)
    await telegramApi("sendMessage", { chat_id: chatId, ...payload })
  }
}

/** Прислать письмо одному человеку — для проверки из админки. */
export async function sendWeeklyDigestPreview(telegramId: string) {
  const message = await buildWeeklyDigestFor(telegramId)
  await sendWithRetry(telegramId, { text: message.text, parse_mode: "HTML", disable_web_page_preview: true, reply_markup: message.reply_markup })
}

export async function processWeeklyDigest(options: { dryRun?: boolean } = {}): Promise<WeeklyDigestResult> {
  const now = new Date()
  const intervalAgo = new Date(now.getTime() - WEEKLY_DIGEST_INTERVAL_MS)
  const firstDelayAgo = new Date(now.getTime() - WEEKLY_DIGEST_FIRST_DELAY_MS)
  const quietAgo = new Date(now.getTime() - WEEKLY_DIGEST_QUIET_MS)

  // Грубый отбор базой, точное правило — isWeeklyDigestDue.
  const candidates = await prisma.telegramContact.findMany({
    where: {
      blocked: false,
      weeklyOptOut: false,
      startedAt: { lte: firstDelayAgo },
      OR: [{ lastWeeklyAt: null }, { lastWeeklyAt: { lte: intervalAgo } }],
      AND: [{ OR: [{ lastBroadcastAt: null }, { lastBroadcastAt: { lte: quietAgo } }] }],
    },
    select: { telegramId: true, blocked: true, weeklyOptOut: true, startedAt: true, lastWeeklyAt: true, lastBroadcastAt: true },
    orderBy: [{ lastWeeklyAt: "asc" }, { startedAt: "asc" }],
    take: MAX_PER_RUN,
  })
  const due = candidates.filter((contact) => isWeeklyDigestDue(contact, now))
  if (options.dryRun) return { due: due.length, sent: 0, blocked: 0, failed: 0, dryRun: true }

  let sent = 0
  let blocked = 0
  let failed = 0
  for (let index = 0; index < due.length; index += 1) {
    const { telegramId } = due[index]
    /* Отметка — до отправки. Если прогон оборвётся посередине, повторный
       запуск не напишет второй раз тем, кому уже ушло; цена — один
       пропущенный человек при сбое сети, а не дубль у сотни. */
    await prisma.telegramContact.update({ where: { telegramId }, data: { lastWeeklyAt: now, lastBroadcastAt: now } })
    try {
      const message = await buildWeeklyDigestFor(telegramId)
      await sendWithRetry(telegramId, { text: message.text, parse_mode: "HTML", disable_web_page_preview: true, reply_markup: message.reply_markup })
      sent += 1
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error)
      if (/blocked by the user|chat not found|user is deactivated/i.test(text)) {
        await markTelegramContactBlocked(telegramId)
        blocked += 1
      } else {
        console.error(`[weekly-digest] Не доставлено ${telegramId}:`, text)
        failed += 1
      }
    }
    if ((index + 1) % MESSAGES_PER_SECOND === 0) await sleep(1000)
  }

  return { due: due.length, sent, blocked, failed, dryRun: false }
}

/** Отписка кнопкой «Не присылать» или командой. */
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
