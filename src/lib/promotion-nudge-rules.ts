/**
 * Когда напомнить продавцу о продвижении.
 *
 * Предложение звучит один раз — в уведомлении об одобрении. Если человек
 * тогда не купил, повода вернуться к нему больше нет: объявление висит,
 * покупатели не идут, а продавец сидит и ждёт, не зная, что можно
 * ускорить.
 *
 * Здесь только правила, без базы и Telegram: сроки и пороги должны
 * проверяться тестами, а не подбираться на живых людях.
 */

/* Цена берётся из тарифов, а не пишется числом: разойдись они — и
   человек увидит в сообщении одну сумму, а на странице оплаты другую. */
/** Через сколько после публикации имеет смысл напоминать. */
export const FIRST_NUDGE_AFTER_MS = 7 * 24 * 60 * 60 * 1000

/** Как часто повторять. */
export const NUDGE_INTERVAL_MS = 14 * 24 * 60 * 60 * 1000

/**
 * Сколько раз напоминаем.
 *
 * Три и хватит: не купивший после трёх напоминаний не купит и после
 * десятого, а площадка, которая долбит в личку, теряет самого продавца.
 */
export const MAX_NUDGES = 3

/**
 * Сколько просмотров считаем «покупатели не идут».
 *
 * Порог низкий намеренно: у объявления с сотней просмотров продвижение
 * не главная беда — там дело в цене или фотографиях, и напоминание
 * прозвучит как навязывание.
 */
export const LOW_VIEWS_THRESHOLD = 30

export type NudgeDecision =
  | { send: true; index: number }
  | { send: false; reason: string }

/**
 * Пора ли напомнить об этом объявлении.
 *
 * Проверки идут от самой дешёвой к самой дорогой по смыслу: сначала то,
 * что вовсе исключает напоминание, потом сроки.
 */
export function shouldNudge(input: {
  publishedAt: Date | null
  views: number
  /* Уже продвигается — напоминать не о чем: человек заплатил. */
  hasActivePromotion: boolean
  nudgesSent: number
  lastNudgeAt: Date | null
  now?: Date
}): NudgeDecision {
  const now = input.now ?? new Date()

  if (!input.publishedAt) return { send: false, reason: "Объявление не публиковалось" }
  if (input.hasActivePromotion) return { send: false, reason: "Продвижение уже оплачено" }
  if (input.nudgesSent >= MAX_NUDGES) return { send: false, reason: "Напоминаний уже достаточно" }

  if (input.views > LOW_VIEWS_THRESHOLD) {
    return { send: false, reason: "Объявление и так смотрят" }
  }

  const age = now.getTime() - input.publishedAt.getTime()
  if (age < FIRST_NUDGE_AFTER_MS) return { send: false, reason: "Слишком рано" }

  if (input.lastNudgeAt) {
    const since = now.getTime() - input.lastNudgeAt.getTime()
    if (since < NUDGE_INTERVAL_MS) return { send: false, reason: "Недавно напоминали" }
  }

  return { send: true, index: input.nudgesSent }
}

/**
 * Текст напоминания.
 *
 * Разный по счёту: первое говорит о цифрах, второе о цене, третье —
 * последнее, и об этом сказано прямо. Один и тот же текст трижды
 * читается как сбой рассылки.
 */
/**
 * Сеть чатов, в которой идёт платный показ: живые цифры, а не записанные в
 * текст. «11 чатов и 114 000 подписчиков» стояли здесь константой, а к
 * 28.10.2026 чатов стало 18 и участников 160 тысяч — продавцу обещали
 * меньше, чем он получал бы. Цифры приносит рассылка (chat-network-stats).
 */
export type ChatNetwork = {
  chats: number
  /** Участников во всех чатах; null — Telegram не ответил, число не называем. */
  members: number | null
  /** Как часто пост повторяется в каждом чате. */
  repostDays: number
}

/** «160 тыс.» — округление вниз: обещать больше, чем есть, нельзя. */
export function formatMembers(members: number): string {
  if (members >= 1000) return `${Math.floor(members / 1000)} тыс.`
  return String(members)
}

/**
 * Что получает продавец за платный показ — строками для сообщения.
 *
 * Число публикаций считается из срока и шага повтора: 30 дней при повторе
 * раз в двое суток дают 15 публикаций в каждом чате. Чаще не повторяем
 * намеренно — забитый объявлениями чат теряет подписчиков, и показ в нём
 * перестаёт стоить денег.
 */
export function chatPromotionPitch(network: ChatNetwork, priceRub: number, planDays: number): string[] {
  const perChat = Math.max(1, Math.floor(planDays / Math.max(1, network.repostDays)))
  const perDay = Math.ceil(priceRub / Math.max(1, planDays))
  const audience = network.members ? ` — ${formatMembers(network.members)} участников` : ""
  return [
    `📣 ${network.chats} чатов авторынка по городам${audience}`,
    `📌 Пост с закрепом, повтор каждые ${network.repostDays} дн. — до ${perChat} публикаций в каждом чате`,
    `💸 ${priceRub} ₽ за ${planDays} дней — около ${perDay} ₽ в день`,
  ]
}

export function nudgeText(input: {
  index: number
  title: string
  views: number
  days: number
  /* Цена и срок приходят снаружи, а не берутся из тарифов здесь: так
     правила остаются без единого импорта и проверяются тестами, а
     разойтись с настоящей ценой они не могут — вызывающий берёт её из
     того же места, что и страница оплаты. */
  priceRub: number
  planDays: number
  /** Сеть чатов; без неё текст обходится без чисел. */
  network?: ChatNetwork
}): string {
  const name = input.title.trim() || "Ваше объявление"
  const pitch = input.network
    ? chatPromotionPitch(input.network, input.priceRub, input.planDays).join("\n")
    : `📣 Показ во всех чатах авторынка сети с закрепом — ${input.priceRub} ₽ за ${input.planDays} дней.`

  if (input.index === 0) {
    /* Цифры вместо уговоров: «12 просмотров за 8 дней» продавец
       понимает сам, и вывод делает тоже сам. */
    return (
      `🚗 «${name}» опубликовано ${input.days} дн. назад — ${input.views} просмотров.\n\n` +
      "Ускорим продажу: покажем машину во всех чатах авторынка LeWheel.\n" +
      pitch
    )
  }

  if (input.index === 1) {
    return (
      `🔥 «${name}» всё ещё ждёт покупателя.\n\n` +
      "В чатах авторынка по городам люди ищут машину прямо сейчас — " +
      "закрепим ваш пост и будем повторять его весь месяц.\n" +
      pitch
    )
  }

  /* Последнее — и об этом сказано: человек должен понимать, что его не
     будут дёргать бесконечно. */
  return (
    `«${name}» по-прежнему без покупателя. Это последнее напоминание.\n\n` +
    "Если хотите ускорить продажу — продвижение в кабинете, раздел «Мои объявления»."
  )
}
