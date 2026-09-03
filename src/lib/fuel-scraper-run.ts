import { prisma } from "@/lib/prisma"
import { collectGdebenz } from "@/lib/gdebenz-scraper"
import { collectGdezapravka } from "@/lib/gdezapravka-scraper"
import { collectTwogis } from "@/lib/twogis-scraper"
import { collectDrom } from "@/lib/drom-scraper"
import { collectTbank } from "@/lib/tbank-fuel-scraper"

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

export const FUEL_SOURCES = ["GDEBENZ", "GDEZAPRAVKA", "TWOGIS", "TBANK", "DROM"] as const
export type FuelSource = (typeof FUEL_SOURCES)[number]

/** Источники, которые запускаются, если вызывающий не назвал свои. */
export const DEFAULT_FUEL_SOURCES: FuelSource[] = ["GDEBENZ", "GDEZAPRAVKA", "TWOGIS", "TBANK"]

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


/* Порог остывания источника.

   При сборе раз в 15 минут источник, начавший отдавать отказы, получит
   ещё 96 попыток в сутки — и запрет по адресу станет постоянным. Поэтому
   после двух подряд неудачных прогонов источник пропускается, пока не
   пройдёт время остывания: нагрузка падает сама, без ручного вмешательства.

   Ограничение снимается автоматически — специально ничего включать назад
   не нужно, иначе про выключенный источник просто забудут. */
const SOURCE_FAILURE_STREAK = 2
const SOURCE_COOLDOWN_MS = 60 * 60_000

export type SkippedSource = { source: string; reason: string }

/**
 * Источники, которые сейчас лучше не трогать: два последних прогона подряд
 * упали, и с последнего прошло меньше часа.
 */
export async function findCoolingSources(sources: FuelSource[]): Promise<Set<string>> {
  const cooling = new Set<string>()

  for (const source of sources) {
    const recent = await prisma.fuelImportRun.findMany({
      where: { source, status: { not: "RUNNING" } },
      orderBy: { startedAt: "desc" },
      take: SOURCE_FAILURE_STREAK,
      select: { status: true, completedAt: true, startedAt: true },
    })
    if (recent.length < SOURCE_FAILURE_STREAK) continue
    if (!recent.every((run) => run.status === "FAILED")) continue

    const last = recent[0].completedAt ?? recent[0].startedAt
    if (Date.now() - last.getTime() < SOURCE_COOLDOWN_MS) cooling.add(source)
  }

  return cooling
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
  if (source === "TBANK") {
    const result = await collectTbank({ regionKeys, pauseMs })
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
  options: { respectCooldown?: boolean } = {},
): Promise<{ results: FuelCollectSummary[]; skipped: SkippedSource[] }> {
  /* Автоматический прогон уважает остывание источника, ручной запуск из
     админки — нет: администратор нажимает кнопку осознанно и вправе
     проверить, ожил ли источник. */
  const cooling = options.respectCooldown ? await findCoolingSources(sources) : new Set<string>()

  const results: FuelCollectSummary[] = []
  const skipped: SkippedSource[] = []

  for (const source of sources) {
    if (cooling.has(source)) {
      skipped.push({ source, reason: "Источник отдыхает после двух неудачных прогонов" })
      continue
    }
    results.push(await runFuelSource(source, regionKeys, pauseMs))
  }

  return { results, skipped }
}
