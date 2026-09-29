/**
 * Ручные поправки к данным источников АЗС.
 *
 * Иногда источник сам ошибается, и код импорта это честно не исправит:
 * ГдеЗаправка отдаёт на ул. Сельско-Богородской, 31 в Уфе «Татнефть» с
 * ценами от 03.07 — а в черте Уфы «Татнефти» нет, по этому адресу работает
 * «АЗС Точка» (azstochka.ru, контакты). Ни OpenStreetMap, ни второй
 * источник этой «Татнефти» не знают. Проверено 29.09.2026.
 *
 * Поправка применяется на входе при каждом импорте: иначе источник через
 * четверть часа вернул бы свою ошибку. Каждая запись — с доказательством,
 * чтобы через полгода было видно, почему точка правится руками.
 */

export type StationCorrection = {
  brand?: string
  name?: string
  /** Цены источника по точке неверны (чужая сеть, давность) — не брать. */
  dropPrices?: boolean
  evidence: string
}

export const FUEL_STATION_CORRECTIONS: Readonly<Record<string, StationCorrection>> = {
  "GDEZAPRAVKA:29901": {
    brand: "АЗС Точка",
    name: "АЗС Точка",
    dropPrices: true,
    evidence: "Уфа, ул. Сельско-Богородская, 31: по адресу «АЗС Точка» (azstochka.ru), в OSM и ГдеБЕНЗ «Татнефти» нет; цены источника от 03.07.2026",
  },
}

type CorrectableStation = { source: string; sourceId: string; brand: string | null; name: string | null; prices: unknown[] }

export function applyStationCorrection<T extends CorrectableStation>(station: T): T {
  const correction = FUEL_STATION_CORRECTIONS[`${station.source}:${station.sourceId}`]
  if (!correction) return station
  return {
    ...station,
    brand: correction.brand ?? station.brand,
    name: correction.name ?? station.name,
    prices: correction.dropPrices ? [] : station.prices,
  } as T
}
