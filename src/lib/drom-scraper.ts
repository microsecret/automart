/**
 * Адаптер источника «Дром».
 *
 * Дром — это автопортал (объявления, отзывы, каталог автомобилей), раздела
 * с АЗС и ценами на топливо у него нет. Поэтому адаптер существует, чтобы
 * маршрутизация источников была единой и честно сообщала о недоступности,
 * вместо тихого пропуска или выдуманных данных.
 */

export type DromCollectResult = {
  runId: null
  status: "UNSUPPORTED"
  regions: []
  fetched: 0
  saved: 0
  failed: 0
  message: string
}

export async function collectDrom(): Promise<DromCollectResult> {
  return {
    runId: null,
    status: "UNSUPPORTED",
    regions: [],
    fetched: 0,
    saved: 0,
    failed: 0,
    message: "Дром не публикует цены на топливо и каталог АЗС — источник недоступен",
  }
}
