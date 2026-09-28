/**
 * Еженедельное письмо в боте: текст, кнопки и правило «кому пора».
 *
 * Здесь нет базы и сети — только решения, чтобы их можно было проверить
 * тестом. Отправка — в telegram-weekly-digest.ts.
 *
 * Каждое утверждение в тексте опирается на то, что площадка делает сейчас:
 * карта АЗС обновляется сборщиком каждые пятнадцать минут, отметки цены и
 * наличия видны всем водителям города, объявление бесплатно, партнёр
 * получает от 20% с платных объявлений приглашённых (стартовый уровень
 * REFERRAL_TIERS).
 */

export const WEEKLY_DIGEST_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000
/** Новичку первое письмо — не раньше чем через неделю после «Старта». */
export const WEEKLY_DIGEST_FIRST_DELAY_MS = WEEKLY_DIGEST_INTERVAL_MS
/** Если бот писал человеку недавно (напоминание о регистрации), письмо ждёт. */
export const WEEKLY_DIGEST_QUIET_MS = 3 * 24 * 60 * 60 * 1000
export const WEEKLY_DIGEST_OFF_CALLBACK = "digest_off"

export type WeeklyDigestContact = {
  blocked: boolean
  weeklyOptOut: boolean
  startedAt: Date
  lastWeeklyAt: Date | null
  lastBroadcastAt: Date | null
}

/** Пора ли слать письмо этому человеку. */
export function isWeeklyDigestDue(contact: WeeklyDigestContact, now: Date): boolean {
  if (contact.blocked || contact.weeklyOptOut) return false
  const time = now.getTime()
  if (time - contact.startedAt.getTime() < WEEKLY_DIGEST_FIRST_DELAY_MS) return false
  if (contact.lastWeeklyAt && time - contact.lastWeeklyAt.getTime() < WEEKLY_DIGEST_INTERVAL_MS) return false
  if (contact.lastBroadcastAt && time - contact.lastBroadcastAt.getTime() < WEEKLY_DIGEST_QUIET_MS) return false
  return true
}

type InlineButton =
  | { text: string; url: string }
  | { text: string; web_app: { url: string } }
  | { text: string; callback_data: string }

export type WeeklyDigestMessage = {
  text: string
  reply_markup: { inline_keyboard: InlineButton[][] }
}

export function buildWeeklyDigestMessage(input: {
  /** Личная ссылка с кодом приглашения. */
  inviteUrl: string
  /** Есть ли у человека аккаунт: без него вознаграждение пока не копится. */
  hasAccount: boolean
  /** Карта АЗС: мини-приложение, если настроено, иначе сайт. */
  fuelMap: { url: string; webApp: boolean }
  createListing: { url: string; webApp: boolean }
}): WeeklyDigestMessage {
  const invite = input.hasAccount
    ? "🤝 <b>Расскажите другу.</b> По вашей личной ссылке вам начисляется от 20% с его платных объявлений."
    : "🤝 <b>Расскажите другу</b> по вашей личной ссылке. Войдите на сайт через Telegram — и с платных объявлений приглашённых вам начнёт начисляться от 20%."

  const text = [
    "🚗 <b>LeWheel: коротко о главном</b>",
    "",
    "⛽ <b>Где заправиться.</b> Карта АЗС с ценами и наличием топлива обновляется каждые 15 минут.",
    "",
    "📍 <b>Помогите соседям.</b> Нет бензина или на табло другая цена — отметьте на карте. Водители города сразу увидят, где дефицит.",
    "",
    "🚘 <b>Продаёте машину?</b> Объявление на LeWheel бесплатно.",
    "",
    invite,
    "",
    "<i>Пишем раз в неделю. Не нужно — нажмите «Не присылать».</i>",
  ].join("\n")

  const shareText = "⛽ Цены на бензин и наличие топлива на заправках рядом — карта обновляется каждые 15 минут."
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(input.inviteUrl)}&text=${encodeURIComponent(shareText)}`

  const open = (text: string, target: { url: string; webApp: boolean }): InlineButton =>
    target.webApp ? { text, web_app: { url: target.url } } : { text, url: target.url }

  return {
    text,
    reply_markup: {
      inline_keyboard: [
        [open("⛽ Карта АЗС", input.fuelMap)],
        [{ text: "🤝 Рассказать другу", url: shareUrl }],
        [open("➕ Подать объявление", input.createListing)],
        [{ text: "🔕 Не присылать", callback_data: WEEKLY_DIGEST_OFF_CALLBACK }],
      ],
    },
  }
}
