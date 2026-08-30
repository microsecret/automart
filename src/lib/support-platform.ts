/**
 * Откуда человек пишет в поддержку.
 *
 * Один и тот же вопрос решается по-разному в зависимости от места.
 * «Не могу загрузить фото» в мини-приложении Telegram — это одна
 * причина, в мобильном браузере — другая, на десктопе — третья. Оператор
 * спрашивал это первым сообщением и терял на переписку минуту, а
 * половина людей отвечала «с телефона», не различая приложение и
 * браузер.
 *
 * Определяем сами: приложение сообщает о себе через пометку в адресе,
 * мобильный браузер — через строку клиента. Ошибиться здесь не страшно,
 * подсказка остаётся подсказкой: оператор видит её как пометку, а не как
 * приговор.
 */

export type SupportPlatform = "TELEGRAM" | "MOBILE" | "DESKTOP"

export const SUPPORT_PLATFORM_LABELS: Record<SupportPlatform, string> = {
  TELEGRAM: "мини-приложение Telegram",
  MOBILE: "мобильный браузер",
  DESKTOP: "десктоп",
}

/** Короткая пометка для карточки обращения у оператора. */
export const SUPPORT_PLATFORM_SHORT: Record<SupportPlatform, string> = {
  TELEGRAM: "Telegram",
  MOBILE: "Телефон",
  DESKTOP: "Компьютер",
}

const MOBILE_HINTS = /android|iphone|ipad|ipod|windows phone|mobile|opera mini/i

export function detectSupportPlatform(input: {
  fromTelegram?: boolean
  userAgent?: string | null
}): SupportPlatform {
  /* Признак мини-приложения надёжнее строки клиента: внутри Telegram
     она выглядит как обычный мобильный браузер. */
  if (input.fromTelegram) return "TELEGRAM"

  const agent = input.userAgent || ""
  /* Telegram Desktop открывает мини-приложение во встроенном окне, и
     строка клиента там содержит собственную пометку. */
  if (/telegram/i.test(agent)) return "TELEGRAM"
  if (MOBILE_HINTS.test(agent)) return "MOBILE"
  return "DESKTOP"
}

/**
 * Приветствие с учётом того, откуда пишут.
 *
 * Человеку не нужно объяснять, где он находится, — нужно, чтобы его
 * поняли. Поэтому платформа не спрашивается, а называется: если мы
 * ошиблись, он поправит одним словом, а если угадали, разговор начнётся
 * сразу с дела.
 */
export function supportGreeting(platform: SupportPlatform, name?: string | null) {
  const hello = name?.trim() ? `Здравствуйте, ${name.trim()}!` : "Здравствуйте!"
  return `${hello} Вижу, вы пишете через ${SUPPORT_PLATFORM_LABELS[platform]} — подскажу по нему. Опишите, что не получается, или выберите вопрос ниже.`
}

/**
 * Частые вопросы под платформу.
 *
 * Общий список одинаков для всех, но первым идёт то, о чём спрашивают
 * именно отсюда: в мини-приложении — про вход и фотографии, на десктопе
 * — про подачу объявления и оплату.
 */
export function supportQuickReplies(platform: SupportPlatform): string[] {
  const common = [
    "Как подать объявление?",
    "Как найти запчасть, которой нет в каталоге?",
    "Не работает карта заправок",
    "Как пригласить друга и получить вознаграждение?",
  ]

  if (platform === "TELEGRAM") {
    return ["Не открывается страница в приложении", "Как привязать Telegram к аккаунту?", ...common]
  }

  if (platform === "MOBILE") {
    return ["Не загружаются фотографии с телефона", "Как войти без пароля?", ...common]
  }

  return ["Как зарегистрироваться?", "Как восстановить доступ?", ...common]
}
