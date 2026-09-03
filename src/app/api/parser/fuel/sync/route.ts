import { NextRequest, NextResponse } from "next/server"
import { regionsForScheduledRun, targetRegionKeys } from "@/lib/fuel-target-regions"
import { FUEL_SOURCES, resolveFuelSources, runFuelSources } from "@/lib/fuel-scraper-run"

export const dynamic = "force-dynamic"
export const maxDuration = 300

const PARSER_TOKEN = process.env.PARSER_TOKEN

/**
 * Запуск сбора АЗС и цен с внешних источников.
 *
 * Вызывается cron-скриптом с внутренним токеном. По умолчанию собирает
 * ГдеБЕНЗ и 2ГИС (2ГИС пропускается без ключа); Дром отдаётся честным
 * статусом «недоступен». Можно запросить конкретный источник или набор.
 * Тот же прогон доступен администратору из админки — см. POST
 * /api/admin/fuel, который ходит в общий модуль напрямую.
 */
export async function POST(request: NextRequest) {
  try {
    if (!PARSER_TOKEN) {
      console.error("PARSER_TOKEN is not configured")
      return NextResponse.json({ error: "Fuel scraper is not configured" }, { status: 503 })
    }
    if (request.headers.get("authorization") !== `Bearer ${PARSER_TOKEN}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json().catch(() => null) as {
      source?: unknown
      sources?: unknown
      regions?: unknown
      pauseMs?: unknown
    } | null

    const sources = resolveFuelSources(body ?? {})
    if (!sources.length) {
      return NextResponse.json({ error: `Поддерживаемые источники: ${FUEL_SOURCES.join(", ")}` }, { status: 400 })
    }

    /* Регионы не названы — значит это плановый прогон.

       Раньше он брал весь список. Пока в нём стояли только города, обход
       занимал две минуты. С прямоугольниками на всю страну он вырос бы до
       сорока девяти минут на источник, и следующий запуск начинался бы
       поверх незавершённого.

       Скользящий обход берёт частые города всегда, а из крупных
       прямоугольников — один, следующий по кругу. Прогон остаётся
       коротким, а страна обходится целиком за три часа. */
    const requestedRegions = Array.isArray(body?.regions)
      ? body.regions.filter((value): value is string => typeof value === "string")
      : regionsForScheduledRun()
    const knownKeys = new Set(targetRegionKeys())
    const unknown = requestedRegions?.filter((key) => !knownKeys.has(key))
    if (unknown?.length) {
      return NextResponse.json({ error: `Неизвестные регионы: ${unknown.join(", ")}` }, { status: 400 })
    }

    const pauseMs = typeof body?.pauseMs === "number" && Number.isFinite(body.pauseMs)
      ? Math.min(Math.max(body.pauseMs, 500), 30_000)
      : undefined

    const { results, skipped } = await runFuelSources(sources, requestedRegions, pauseMs, { respectCooldown: true })

    return NextResponse.json({ success: true, sources: results, skipped })
  } catch (error) {
    console.error("Fuel scraper sync error:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status: 500 })
  }
}
