/**
 * Каким разделом человек пользовался.
 *
 * Список популярных страниц отвечает на вопрос «куда заходят», но не на
 * вопрос «чем пользуются»: `/listings/vehicle/1f020612-75f5…` в отчёте
 * занимает строку и ничего не говорит, а сорок таких строк вытесняют
 * всё остальное. Владелец же смотрит, живёт ли раздел запчастей и
 * окупается ли карта заправок.
 *
 * Поэтому путь сводится к разделу. Порядок правил значим: сначала
 * длинные и точные адреса, иначе «/listings» перехватит
 * «/listings/create».
 */

export type TrafficSection = {
  key: string
  label: string
  /** Группа для сводки: чем человек занимался, а не какую страницу открыл. */
  group: "CATALOG" | "PARTS" | "AUCTIONS" | "SERVICES" | "COMMUNITY" | "ACCOUNT" | "OTHER"
}

const SECTIONS: Array<{ test: (path: string) => boolean; section: TrafficSection }> = [
  { test: (p) => p === "/telegram" || p.startsWith("/telegram/"), section: { key: "telegram", label: "Мини-приложение Telegram", group: "OTHER" } },

  { test: (p) => p.startsWith("/listings/create/vehicle"), section: { key: "create-vehicle", label: "Подача объявления", group: "CATALOG" } },
  { test: (p) => p.startsWith("/listings/create/part"), section: { key: "create-part", label: "Подача запчасти", group: "PARTS" } },
  { test: (p) => p.startsWith("/listings/vehicle"), section: { key: "vehicle", label: "Карточка машины", group: "CATALOG" } },
  { test: (p) => p.startsWith("/listings/part"), section: { key: "part", label: "Карточка запчасти", group: "PARTS" } },
  { test: (p) => p === "/" || p.startsWith("/category") || p.startsWith("/search"), section: { key: "catalog", label: "Каталог объявлений", group: "CATALOG" } },
  { test: (p) => p.startsWith("/compare"), section: { key: "compare", label: "Сравнение", group: "CATALOG" } },
  { test: (p) => p.startsWith("/map"), section: { key: "listing-map", label: "Карта объявлений", group: "CATALOG" } },

  { test: (p) => p.startsWith("/parts-finder"), section: { key: "parts-finder", label: "Поиск запчастей", group: "PARTS" } },
  { test: (p) => p.startsWith("/store/"), section: { key: "store", label: "Витрина магазина", group: "PARTS" } },

  { test: (p) => p.startsWith("/auctions"), section: { key: "auctions", label: "Аукционы", group: "AUCTIONS" } },

  { test: (p) => p.startsWith("/services/fuel-map"), section: { key: "fuel-map", label: "Карта заправок", group: "SERVICES" } },
  { test: (p) => p.startsWith("/services/valuation"), section: { key: "valuation", label: "Оценка стоимости", group: "SERVICES" } },
  { test: (p) => p.startsWith("/services/history-check"), section: { key: "history", label: "Проверка истории", group: "SERVICES" } },
  { test: (p) => p.startsWith("/services/smart-matching"), section: { key: "matching", label: "Умный подбор", group: "SERVICES" } },
  { test: (p) => p.startsWith("/services/safe-deal"), section: { key: "safe-deal", label: "Безопасная сделка", group: "SERVICES" } },
  { test: (p) => p.startsWith("/services"), section: { key: "services", label: "Прочие сервисы", group: "SERVICES" } },

  { test: (p) => p.startsWith("/forum"), section: { key: "forum", label: "Форум", group: "COMMUNITY" } },
  { test: (p) => p.startsWith("/news"), section: { key: "news", label: "Новости", group: "COMMUNITY" } },
  { test: (p) => p.startsWith("/messages"), section: { key: "messages", label: "Сообщения", group: "COMMUNITY" } },

  { test: (p) => p.startsWith("/auth"), section: { key: "auth", label: "Вход и регистрация", group: "ACCOUNT" } },
  { test: (p) => p.startsWith("/dashboard") || p.startsWith("/favorites") || p.startsWith("/notifications"), section: { key: "dashboard", label: "Личный кабинет", group: "ACCOUNT" } },
  { test: (p) => p.startsWith("/help") || p.startsWith("/legal") || p.startsWith("/about"), section: { key: "help", label: "Помощь и правила", group: "OTHER" } },
]

const FALLBACK: TrafficSection = { key: "other", label: "Прочее", group: "OTHER" }

export function sectionForPath(path: string): TrafficSection {
  const clean = path.split(/[?#]/, 1)[0] || "/"
  return SECTIONS.find((rule) => rule.test(clean))?.section || FALLBACK
}

export const SECTION_GROUP_LABELS: Record<TrafficSection["group"], string> = {
  CATALOG: "Объявления",
  PARTS: "Запчасти",
  AUCTIONS: "Аукционы",
  SERVICES: "Сервисы",
  COMMUNITY: "Сообщество",
  ACCOUNT: "Кабинет",
  OTHER: "Прочее",
}

/**
 * Понятное имя страницы вместо адреса с идентификатором.
 *
 * `/listings/vehicle/1f020612-75f5-4167-8421-adb22f9770c9` в отчёте
 * читается как строка мусора: владелец не помнит машины по её коду.
 * Такие адреса сводятся к разделу, а короткие остаются как есть — их
 * человек узнаёт.
 */
export function readablePath(path: string): string {
  const clean = path.split(/[?#]/, 1)[0] || "/"
  const hasIdentifier = /\/[0-9a-f]{8}-[0-9a-f]{4}-|\/[0-9a-f]{24,}/i.test(clean)
  if (!hasIdentifier) return clean === "/" ? "Главная" : clean
  return sectionForPath(clean).label
}
