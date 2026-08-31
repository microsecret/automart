import { collectGdebenz } from "@/lib/gdebenz-scraper"
import { collectGdezapravka } from "@/lib/gdezapravka-scraper"
import { collectTwogis } from "@/lib/twogis-scraper"
import { collectDrom } from "@/lib/drom-scraper"

/**
 * Единый запуск источников сбора АЗС.
 *
 * Прогон нужен в двух местах: cron дёргает /api/parser/fuel/sync с
 * внутренним токеном, администратор — кнопку в админке под своей сессией.
 * Разбор источника был написан в маршруте парсера, и кнопка админки
 * означала бы вторую копию того же перечисления: добавив источник в одном
 * месте, легко забыть про другое. Поэтому логика живёт здесь, а оба
 * маршрута отвечают только за проверку прав.
 */

export const FUEL_SOURCES = ["GDEBENZ", "GDEZAPRAVKA", "TWOGIS", "DROM"] as const
export type FuelSource = (typeof FUEL_SOURCES)[number]

/** Источники, которые запускаются, если вызывающий не назвал свои. */
export const DEFAULT_FUEL_SOURCES: FuelSource[] = ["GDEBENZ", "GDEZAPRAVKA", "TWOGIS"]

export type FuelCollectSummary = {
  source: string
  status: string
  fetched: number
  saved: number
  failed: number
  message: string | null
  regions: Array<{ key: string; city: string; fetched: number; saved: number; error: string | null }>
}

export function isFuelSource(value: string): value is FuelSource {
  return (FUEL_SOURCES as readonly string[]).includes(value)
}

/**
 * Нормализует запрошенные источники: приводит к верхнему регистру, убирает
 * повторы и незнакомые значения. Пустой запрос означает набор по умолчанию.
 */
export function resolveFuelSources(input: { source?: unknown; sources?: unknown }): FuelSource[] {
  const requested = Array.isArray(input.sources)
    ? input.sources.filter((value): value is string => typeof value === "string").map((value) => value.toUpperCase())
    : typeof input.source === "string"
      ? [input.source.trim().toUpperCase()]
      : DEFAULT_FUEL_SOURCES

  return [...new Set(requested)].filter(isFuelSource)
}

export async function runFuelSource(
  source: FuelSource,
  regionKeys: string[] | undefined,
  pauseMs: number | undefined,
): Promise<FuelCollectSummary> {
  if (source === "GDEBENZ") {
    const result = await collectGdebenz({ regionKeys, pauseMs })
    return { source, status: result.status, fetched: result.fetched, saved: result.saved, failed: result.failed, message: null, regions: result.regions }
  }
  if (source === "GDEZAPRAVKA") {
    const result = await collectGdezapravka({ regionKeys, pauseMs })
    return { source, status: result.status, fetched: result.fetched, saved: result.saved, failed: result.failed, message: result.message, regions: result.regions }
  }
  if (source === "TWOGIS") {
    const result = await collectTwogis({ regionKeys, pauseMs })
    return { source, status: result.status, fetched: result.fetched, saved: result.saved, failed: result.failed, message: result.message, regions: result.regions }
  }
  const result = await collectDrom()
  return { source, status: result.status, fetched: 0, saved: 0, failed: 0, message: result.message, regions: [] }
}

/**
 * Прогоняет источники последовательно.
 *
 * Именно последовательно: параллельный запуск бьёт по одним и тем же
 * сайтам-источникам разом и быстрее упирается в их защиту, а выигрыш во
 * времени для фонового сбора значения не имеет.
 */
export async function runFuelSources(
  sources: FuelSource[],
  regionKeys: string[] | undefined,
  pauseMs: number | undefined,
): Promise<FuelCollectSummary[]> {
  const results: FuelCollectSummary[] = []
  for (const source of sources) {
    results.push(await runFuelSource(source, regionKeys, pauseMs))
  }
  return results
}
