import type { TelegramRegistrationStep } from "@/lib/telegram"

/**
 * Тексты о незавершённой регистрации.
 *
 * Вынесены отдельно от рассылки: здесь нет ни базы, ни сети, поэтому
 * формулировки можно проверять тестами. Ошибка в них видна каждому
 * пользователю, а склонения в русском легко сломать.
 */

export type PendingStep = Exclude<TelegramRegistrationStep, "complete">

export const REGISTRATION_STEPS: PendingStep[] = ["contact", "email", "password"]

type StepCopy = {
  title: string
  what: string
  action: string
  short: string
}

export const STEP_COPY: Record<PendingStep, StepCopy> = {
  contact: {
    title: "📱 Остался первый шаг — телефон",
    what: "Нажмите кнопку «Отправить мой контакт» — Telegram передаст номер сам, вводить ничего не нужно.",
    // Для первого шага прежняя формулировка понятнее: человек ещё не начинал
    // и не знает, что регистрация состоит из подтверждения телефона.
    action: "🚀 Пройти регистрацию",
    short: "📱 <b>Телефон</b> — подтвердите свой контакт кнопкой Telegram.",
  },
  email: {
    title: "📧 Остался второй шаг — почта",
    what: "Отправьте свой email одним сообщением. Он нужен для входа на сайте и восстановления доступа.",
    action: "📧 Указать почту",
    short: "📧 <b>Почта</b> — укажите email для входа и восстановления доступа.",
  },
  password: {
    title: "🔑 Остался последний шаг — пароль",
    what: "Придумайте пароль от 8 символов и отправьте его одним сообщением. В базе хранится только защищённый хэш.",
    action: "🔑 Придумать пароль",
    short: "🔑 <b>Пароль</b> — придумайте защищённый пароль от аккаунта.",
  },
}

/** Сколько шагов позади. Для завершённой регистрации — все три. */
export function completedStepCount(step: TelegramRegistrationStep) {
  const index = REGISTRATION_STEPS.indexOf(step as PendingStep)
  return index === -1 ? REGISTRATION_STEPS.length : index
}

/** Полоса прогресса: наглядно, что осталось немного. */
export function progressBar(step: TelegramRegistrationStep) {
  const done = completedStepCount(step)
  return "🟢".repeat(done) + "⚪️".repeat(REGISTRATION_STEPS.length - done)
}

/** Шаги, которые ещё предстоит пройти. */
export function pendingSteps(step: TelegramRegistrationStep): PendingStep[] {
  const index = REGISTRATION_STEPS.indexOf(step as PendingStep)
  return index === -1 ? [] : REGISTRATION_STEPS.slice(index)
}

/** Подпись кнопки под конкретный шаг, а не общее «завершить регистрацию». */
export function resumeButtonLabel(step: TelegramRegistrationStep) {
  const copy = STEP_COPY[step as PendingStep]
  return copy ? `✅ ${copy.action}` : "🚀 Завершить регистрацию"
}

/** Личное напоминание в чат с ботом. */
export function buildReminderText(step: PendingStep, name?: string | null) {
  const copy = STEP_COPY[step]
  const done = completedStepCount(step)
  const safeName = (name || "").trim()

  return [
    `<b>${copy.title}</b>`,
    "",
    `${safeName ? `${safeName}, ` : ""}вы начали регистрацию в LeWheel, но не закончили — пройдено ${done} из ${REGISTRATION_STEPS.length} шагов.`,
    progressBar(step),
    "",
    copy.what,
    "",
    "❗️ <b>Пока регистрация не завершена, ваши сообщения в чатах LeWheel удаляются автоматически</b> — так мы защищаем чаты от спама. Как только закончите, всё будет публиковаться сразу.",
    "",
    "Это займёт меньше минуты.",
  ].join("\n")
}

/** Строки об оставшихся шагах для уведомления в группе. */
export function describePendingSteps(step: TelegramRegistrationStep) {
  const pending = pendingSteps(step)
  const done = completedStepCount(step)
  const total = REGISTRATION_STEPS.length

  // Завершившему регистрацию перечислять нечего — уведомление ему и не
  // отправляется, но пустой «хвост» из заголовка и полосы выглядел бы обрывком.
  if (pending.length === 0) return []

  const headline = done > 0
    ? `Регистрация в LeWheel почти завершена — остал${pending.length > 1 ? "ось" : "ся"} ${pending.length === 1 ? "последний шаг" : `${pending.length} шага`}:`
    : "Регистрация в LeWheel пока не завершена. Пройдите три коротких шага в личном чате с ботом:"

  return [
    headline,
    `${progressBar(step)} пройдено ${done} из ${total}`,
    "",
    ...pending.map((key, index) => `${index + 1}️⃣ ${STEP_COPY[key].short}`),
  ]
}
