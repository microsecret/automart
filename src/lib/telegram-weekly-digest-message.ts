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
  createPart: Target
  dashboard: Target
}): WeeklyDigestMessage {
  const text = [
    "🚘 <b>Продаёте автомобиль или запчасти? Покажите их на LeWheel</b>", "",
    "Добавьте фотографии, цену, характеристики и контакты. После модерации покупатели смогут увидеть предложение и написать вам.", "",
    "✅ Базовое размещение на сайте бесплатно.",
    "📱 Создание и управление объявлениями — в мини-приложении Telegram.",
    "💬 Для автомобилей доступна публикация в чатах авторынка; повторные размещения подключаются отдельно в продвижении.", "",
    input.hasAccount ? "🤝 Пригласите друзей по личной ссылке — получайте вознаграждение по условиям партнёрской программы." : "Завершите регистрацию, чтобы размещать свои предложения.", "",
    "<i>Одно приглашение в неделю. Отключить — кнопкой ниже.</i>",
  ].join("\n")
  const open = (text: string, target: Target): InlineButton => target.webApp
    ? { text, web_app: { url: target.url } } : { text, url: target.url }
  return { text, reply_markup: { inline_keyboard: [
    [open("🚘 Разместить автомобиль", input.createListing)],
    [open("🔧 Разместить запчасть", input.createPart)],
    [open("📋 Мои объявления и продвижение", input.dashboard)],
    [{ text: "🤝 Пригласить друга", url: `https://t.me/share/url?url=${encodeURIComponent(input.inviteUrl)}&text=${encodeURIComponent("LeWheel — автомобили и запчасти в Telegram")}` }],
    [{ text: "🔕 Не присылать", callback_data: WEEKLY_DIGEST_OFF_CALLBACK }],
  ] } }
}
