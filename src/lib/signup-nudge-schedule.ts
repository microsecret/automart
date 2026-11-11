/** Weekly reminders continue until registration, opt-out or blocking. */
export const FIRST_NUDGE_DELAY_MS = 7 * 24 * 60 * 60 * 1000
export const NUDGE_INTERVAL_MS = FIRST_NUDGE_DELAY_MS

export const NUDGE_VARIANTS: readonly (readonly string[])[] = [
  [
    "👋 <b>Вы ещё не завершили авторизацию на LeWheel</b>", "",
    "Завершите авторизацию, чтобы бесплатно разместить автомобиль или запчасти на <b>lewheel.ru</b>.",
    "После модерации объявление появится на сайте; для автомобиля доступна публикация в чате авторынка вашего города.", "",
    "Нажмите «Продолжить авторизацию» — бот откроет ваш текущий шаг.",
  ],
  [
    "🚘 <b>Покупатели ищут — покажите им своё предложение</b>", "",
    "Автомобиль стоит без дела или остались запчасти? Завершите авторизацию в LeWheel и создайте объявление с фотографиями, ценой и контактами.", "",
    "Базовое размещение на сайте бесплатно. Оплаченное продвижение подключается отдельно.",
  ],
  [
    "🔑 <b>Продолжите с того места, где остановились</b>", "",
    "Повторять уже заполненные шаги не нужно. Бот подскажет, что осталось: телефон, почта или пароль.", "",
    "После авторизации сможете сохранять предложения, писать продавцам и размещать свои объявления.",
  ],
  [
    "📱 <b>Ваш авторынок — прямо в Telegram</b>", "",
    "Завершите авторизацию, добавьте фотографии и характеристики — отправьте предложение на модерацию из мини-приложения LeWheel.", "",
    "Напоминаем раз в неделю, пока авторизация не завершена. Напоминания можно отключить кнопкой ниже.",
  ],
]

/** Cycle the copy, never retire older contacts from the queue. */
export function nudgeIndex(startedAt: Date, now: Date): number {
  const elapsed = now.getTime() - startedAt.getTime()
  if (!Number.isFinite(elapsed) || elapsed < FIRST_NUDGE_DELAY_MS) return -1
  return (Math.floor(elapsed / NUDGE_INTERVAL_MS) - 1) % NUDGE_VARIANTS.length
}

export function nudgeText(index: number, firstName?: string | null): string {
  if (!Number.isInteger(index) || index < 0 || index >= NUDGE_VARIANTS.length) return ""
  const lines = [...NUDGE_VARIANTS[index]]
  const name = firstName?.trim().slice(0, 64)
  if (name && index === 0) {
    const safe = name.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    lines[0] = lines[0].replace(/<b>(.)/u, (_match, first: string) => `<b>${safe}, ${first.toLocaleLowerCase("ru-RU")}`)
  }
  return lines.join("\n")
}
