export const PROMOTION_TARIFFS = {
  BOOST: {
    id: "boost",
    title: "Поднятие в топ",
    description: "Объявление поднимается выше в результатах поиска",
    amountRub: 499,
    durationDays: 3,
    isFeatured: false,
  },
  PREMIUM: {
    id: "premium",
    title: "Премиум",
    description: "Приоритет в выдаче, выделение и бейдж «Премиум»",
    amountRub: 1_490,
    durationDays: 7,
    isFeatured: true,
  },
  /* Продвижение в сети Telegram-чатов авторынка по городам. Число чатов и
     участников в описании не пишется: оно растёт (28.10.2026 — 18 чатов,
     160 тысяч участников), а «11 чатов» здесь уже однажды устарели.
     Живые цифры показывает рассылка (chat-network-stats). Цена ниже
     продвижения на Авито при большем охвате — площадка зарабатывает
     объёмом, а не ценой. */
  CHATS: {
    id: "chats",
    title: "Показ в чатах",
    description: "Объявление публикуется во всех чатах авторынка сети с закрепом",
    amountRub: 300,
    durationDays: 30,
    isFeatured: false,
  },
  CHATS_DAILY: {
    id: "chats_daily",
    title: "1 публикация в сутки",
    description: "Публикация каждые 24 часа",
    amountRub: 300,
    durationDays: 7,
    isFeatured: false,
    postsPerDay: 1,
  },
  CHATS_TWICE: {
    id: "chats_twice",
    title: "2 публикации в сутки",
    description: "Публикация каждые 12 часов",
    amountRub: 500,
    durationDays: 7,
    isFeatured: false,
    postsPerDay: 2,
  },
  CHATS_THRICE: {
    id: "chats_thrice",
    title: "3 публикации в сутки",
    description: "Публикация каждые 8 часов",
    amountRub: 700,
    durationDays: 7,
    isFeatured: false,
    postsPerDay: 3,
  },
  VIP: {
    id: "vip",
    title: "VIP-размещение",
    description: "Максимальный приоритет, VIP-бейдж и закрепление",
    amountRub: 3_990,
    durationDays: 30,
    isFeatured: true,
  },
} as const

export type PromotionType = keyof typeof PROMOTION_TARIFFS
export type PromotionTariff = (typeof PROMOTION_TARIFFS)[PromotionType]

export const CHAT_PROMOTION_OPTIONS = [
  PROMOTION_TARIFFS.CHATS_DAILY,
  PROMOTION_TARIFFS.CHATS_TWICE,
  PROMOTION_TARIFFS.CHATS_THRICE,
] as const

export const CHAT_PROMOTION_TARIFF_IDS = [PROMOTION_TARIFFS.CHATS.id, ...CHAT_PROMOTION_OPTIONS.map((option) => option.id)]
export const LEGACY_CHAT_REPOST_MS = 48 * 60 * 60 * 1000
export const PROMOTION_PAYMENT_SUPPORT = "tamerlan_elladov"

export function chatPromotionInterval(tariffId: string): number {
  const option = CHAT_PROMOTION_OPTIONS.find((plan) => plan.id === tariffId)
  return option ? 86_400_000 / option.postsPerDay : LEGACY_CHAT_REPOST_MS
}

export function getPromotionTariff(value: unknown): PromotionTariff | null {
  if (typeof value !== "string") return null

  const normalized = value.trim().toUpperCase() as PromotionType
  return Object.hasOwn(PROMOTION_TARIFFS, normalized) ? PROMOTION_TARIFFS[normalized] : null
}
