/**
 * Зачем человека попросили войти.
 *
 * Обход сайта показал: кнопки «Показать телефон», «Написать продавцу»,
 * «Пожаловаться», подача объявления, избранное и заявка на лот — все
 * уводят на страницу входа, и та молчит. Весь её текст: «Вход в аккаунт /
 * Почта или телефон и ваш пароль». Человек не понимает, почему он здесь
 * и что будет дальше, а шапки и подвала на этой странице нет — вернуться
 * можно только кнопкой браузера.
 *
 * Причину знает адрес возврата: он приходит в `callbackUrl`. Разбор
 * вынесен отдельно, чтобы его можно было проверить тестом.
 */

export type SignInReason = {
  /** Что человек пытался сделать — заголовок вместо общего «Вход в аккаунт». */
  title: string
  /** Что даст вход — одной строкой, без обещаний, которых сайт не выполняет. */
  hint: string
}

const DEFAULT_REASON: SignInReason = {
  title: "Вход в аккаунт",
  hint: "Почта или телефон и ваш пароль",
}

const DEFAULT_SITE_ORIGIN = "https://lewheel.ru"

export function resolveSignInCallback(value: string | null | undefined, origin = DEFAULT_SITE_ORIGIN): string | null {
  const target = value?.trim()
  if (!target) return null

  try {
    // Decode a wrapped URL without changing escaped query values in a normal path.
    const address = target.startsWith("%") ? decodeURIComponent(target) : target
    const url = address.startsWith("/") ? new URL(address, origin) : new URL(address)
    if (url.origin !== origin || !url.pathname.startsWith("/") || url.pathname.startsWith("//")) return null
    return url.pathname + url.search + url.hash
  } catch {
    return null
  }
}

/* Порядок важен: путь подачи объявления начинается с /listings, как и
   страница самого объявления, поэтому более частные правила идут раньше. */
const REASONS: ReadonlyArray<{ match: RegExp; reason: SignInReason }> = [
  {
    match: /^\/listings\/create/,
    reason: {
      title: "Вход, чтобы разместить объявление",
      hint: "Размещение бесплатное. Аккаунт нужен, чтобы объявление было привязано к вам и его можно было редактировать.",
    },
  },
  {
    match: /^\/listings\/[^/]+\/promote/,
    reason: {
      title: "Вход, чтобы продвинуть объявление",
      hint: "Продвижение работает только для ваших объявлений.",
    },
  },
  {
    match: /^\/listings\//,
    reason: {
      title: "Вход, чтобы связаться с продавцом",
      hint: "Телефон и переписка открыты вошедшим: так продавец видит, с кем говорит, а объявления защищены от сбора номеров роботами.",
    },
  },
  {
    match: /^\/auctions\//,
    reason: {
      title: "Вход, чтобы оставить заявку",
      hint: "Заявка будет привязана к вам, а партнёр сможет общаться без доступа к вашему телефону и почте.",
    },
  },
  {
    match: /^\/favorites/,
    reason: {
      title: "Вход, чтобы сохранить избранное",
      hint: "Избранное синхронизируется между сайтом и Telegram.",
    },
  },
  {
    match: /^\/messages/,
    reason: {
      title: "Вход в переписку",
      hint: "Сообщения от покупателей и продавцов в одном месте.",
    },
  },
  {
    match: /^\/dashboard\/deliveries/,
    reason: {
      title: "Вход в раздел сделок",
      hint: "Чат с партнёром, счета, договоры и маршрут доставки.",
    },
  },
  {
    match: /^\/dashboard/,
    reason: {
      title: "Вход в личный кабинет",
      hint: "Ваши объявления, сообщения и статистика просмотров.",
    },
  },
]

/**
 * Что показать вместо общего «Вход в аккаунт».
 *
 * @param callbackUrl адрес, куда человек вернётся после входа
 */
export function signInReason(callbackUrl: string | null | undefined): SignInReason {
  const callback = resolveSignInCallback(callbackUrl)
  if (!callback) return DEFAULT_REASON
  const path = callback.split(/[?#]/, 1)[0]
  return REASONS.find((entry) => entry.match.test(path))?.reason || DEFAULT_REASON
}
