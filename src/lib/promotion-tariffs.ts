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
  /* Продвижение в сети Telegram-чатов: одиннадцать региональных групп,
     114 тысяч подписчиков суммарно. Цена ниже продвижения на Авито при
     большем охвате — площадка зарабатывает объёмом, а не ценой. */
  CHATS: {
    id: "chats",
    title: "Показ в чатах",
    description: "Объявление публикуется в 11 региональных чатах с закрепом",
    amountRub: 300,
    durationDays: 30,
    isFeatured: false,
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

export function getPromotionTariff(value: unknown): PromotionTariff | null {
  if (typeof value !== "string") return null

  const normalized = value.trim().toUpperCase() as PromotionType
  return PROMOTION_TARIFFS[normalized] ?? null
}
