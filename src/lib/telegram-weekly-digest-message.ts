/** One weekly lifecycle invitation; incomplete registrations use their own copy. */
export const WEEKLY_DIGEST_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000
export const WEEKLY_DIGEST_FIRST_DELAY_MS = WEEKLY_DIGEST_INTERVAL_MS
export const WEEKLY_DIGEST_QUIET_MS = WEEKLY_DIGEST_INTERVAL_MS
export const WEEKLY_DIGEST_OFF_CALLBACK = "digest_off"

export type WeeklyDigestContact = {
  blocked: boolean
  weeklyOptOut: boolean
  startedAt: Date
  lastWeeklyAt: Date | null
  lastBroadcastAt: Date | null
  registered?: boolean
}

export function isWeeklyDigestDue(contact: WeeklyDigestContact, now: Date): boolean {
  if (contact.blocked || contact.weeklyOptOut || contact.registered === false) return false
  const time = now.getTime()
  return [contact.startedAt, contact.lastWeeklyAt, contact.lastBroadcastAt]
    .every((date) => date === null || (Number.isFinite(time - date.getTime()) && time - date.getTime() >= WEEKLY_DIGEST_INTERVAL_MS))
}

type Target = { url: string; webApp: boolean }
type InlineButton = { text: string; url: string } | { text: string; web_app: { url: string } } | { text: string; callback_data: string }
export type WeeklyDigestMessage = { text: string; reply_markup: { inline_keyboard: InlineButton[][] } }

export function buildWeeklyDigestMessage(input: {
  inviteUrl: string
  hasAccount: boolean
  createListing: Target
  createWebsite: string
  createPart: Target
  dashboard: Target
  promotions: Target
  promotionPriceRub: number
  promotionDays: number
}): WeeklyDigestMessage {
  const text = [
    "🚘 <b>Ваш автомобиль или запчасти уже могут искать</b>", "",
    "Продаёте машину? Остались шины, диски, фары, детали двигателя или кузова? Покажите их покупателям на LeWheel.", "",
    "✅ <b><u>Размещение объявлений совершенно бесплатно</u></b>",
    "📱 Откройте Mini App, добавьте фото, цену и характеристики. После модерации покупатели увидят объявление и смогут написать вам.", "",
    `🚀 <b>Хотите показать объявление в городских чатах?</b> Подключите на сайте продвижение от <b>${input.promotionPriceRub} ₽ за ${input.promotionDays} дней</b>.`, "",
    input.hasAccount ? "🤝 Пригласите друзей по личной ссылке — получайте вознаграждение по условиям партнёрской программы." : "Завершите регистрацию, чтобы размещать свои предложения.", "",
    "<i>Одно приглашение в неделю. Отключить — кнопкой ниже.</i>",
  ].join("\n")
  const open = (text: string, target: Target): InlineButton => target.webApp
    ? { text, web_app: { url: target.url } } : { text, url: target.url }
  return { text, reply_markup: { inline_keyboard: [
    [open("🚘 Разместить авто бесплатно", input.createListing)],
    [open("🔧 Разместить запчасть бесплатно", input.createPart)],
    [open("🚀 Продвижение на сайте", input.promotions)],
    [{ text: "🌐 Подать на сайте", url: input.createWebsite }],
    [open("📋 Мои объявления", input.dashboard)],
    [{ text: "🤝 Пригласить друга", url: `https://t.me/share/url?url=${encodeURIComponent(input.inviteUrl)}&text=${encodeURIComponent("LeWheel — автомобили и запчасти в Telegram")}` }],
    [{ text: "🔕 Не присылать", callback_data: WEEKLY_DIGEST_OFF_CALLBACK }],
  ] } }
}
