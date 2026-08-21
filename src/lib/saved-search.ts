/**
 * Условия сохранённого поиска.
 *
 * Строка приходит с клиента и потом подставляется в адрес страницы, поэтому
 * в базу пускаются только известные параметры: произвольная строка могла бы
 * увести подписчика по чужой ссылке из его же уведомления.
 */

export const SAVED_SEARCH_SCOPES = ["LISTINGS", "AUCTIONS"] as const
export type SavedSearchScope = (typeof SAVED_SEARCH_SCOPES)[number]

/** Параметры каталога объявлений. */
const LISTING_PARAMS = new Set([
  "q", "type", "vehicleType", "make", "model", "city", "region",
  "priceFrom", "priceTo", "yearFrom", "yearTo", "mileageTo",
  "fuelType", "transmission", "driveType", "bodyType", "condition", "sort",
])

/** Параметры каталога аукционов. */
const AUCTION_PARAMS = new Set([
  "q", "country", "source", "make", "model", "bodyType",
  "priceFrom", "priceTo", "yearFrom", "sort",
])

/** Длина значения: длиннее — это уже не фильтр, а попытка что-то протащить. */
const MAX_VALUE_LENGTH = 120

export function normalizeSavedSearchQuery(raw: string, scope: SavedSearchScope): string {
  const allowed = scope === "AUCTIONS" ? AUCTION_PARAMS : LISTING_PARAMS
  const source = new URLSearchParams(raw.startsWith("?") ? raw.slice(1) : raw)
  const result = new URLSearchParams()

  // Сортировка ключей делает строку стабильной: одинаковые фильтры дают
  // одинаковую подписку независимо от порядка выбора на странице.
  const keys = [...new Set([...source.keys()])].sort()
  for (const key of keys) {
    if (!allowed.has(key)) continue
    for (const value of source.getAll(key)) {
      const trimmed = value.trim()
      if (!trimmed || trimmed.length > MAX_VALUE_LENGTH) continue
      result.append(key, trimmed)
    }
  }

  return result.toString()
}

/** Адрес страницы, на которую ведёт подписка. */
export function savedSearchHref(scope: SavedSearchScope, query: string) {
  const base = scope === "AUCTIONS" ? "/auctions" : "/"
  return query ? `${base}?${query}` : base
}
