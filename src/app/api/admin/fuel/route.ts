import { NextRequest, NextResponse } from "next/server"
import { requireAdminSession, runAdminRoute } from "@/lib/admin-route-guard"
import { prisma } from "@/lib/prisma"
import { recordAdminAudit } from "@/lib/admin-audit"
import { targetRegionKeys } from "@/lib/fuel-target-regions"
import { FUEL_SOURCES, resolveFuelSources, runFuelSources } from "@/lib/fuel-scraper-run"

export const dynamic = "force-dynamic"
export const maxDuration = 300

const PAGE_SIZE = 25
const MAX_PAGE_SIZE = 100
const ALLOWED_STATUS = new Set(["yes", "low", "no"])

/**
 * Данные скрейпера АЗС для админки: сводка, точки с ценами и журнал прогонов.
 *
 * Один маршрут вместо трёх: сводка и станции зависят от одних и тех же
 * фильтров, и тянуть их раздельно значило бы дублировать разбор параметров.
 */
export async function GET(request: NextRequest) {
  const guard = await requireAdminSession()
  if (guard.denied) return guard.denied

  const view = request.nextUrl.searchParams.get("view") || "overview"

  /* Живая лента прогона. Админка опрашивает её в цикле, пока сбор идёт,
     поэтому отдаём только строки новее курсора: иначе каждый опрос тянул
     бы весь прогон целиком — тысячи строк на каждые пару секунд. */
  if (view === "log") {
    const after = request.nextUrl.searchParams.get("after")
    const runIdParam = request.nextUrl.searchParams.get("runId")

    const run = runIdParam
      ? await prisma.fuelImportRun.findUnique({
          where: { id: runIdParam },
          select: { id: true, source: true, status: true, startedAt: true, completedAt: true, fetched: true, upserted: true, failed: true },
        })
      : await prisma.fuelImportRun.findFirst({
          orderBy: { startedAt: "desc" },
          select: { id: true, source: true, status: true, startedAt: true, completedAt: true, fetched: true, upserted: true, failed: true },
        })

    if (!run) return NextResponse.json({ run: null, entries: [], cursor: null })

    const entries = await prisma.fuelImportLogEntry.findMany({
      where: {
        runId: run.id,
        ...(after ? { createdAt: { gt: new Date(after) } } : {}),
      },
      orderBy: { createdAt: "asc" },
      take: 300,
      select: {
        id: true, source: true, city: true, station: true, address: true,
        prices: true, status: true, kind: true, message: true, createdAt: true,
      },
    })

    return NextResponse.json({
      run,
      entries,
      cursor: entries.length ? entries[entries.length - 1].createdAt.toISOString() : after,
    })
  }

  if (view === "runs") {
    const runs = await prisma.fuelImportRun.findMany({
      orderBy: { startedAt: "desc" },
      take: 50,
      select: {
        id: true, source: true, status: true, requested: true, fetched: true,
        upserted: true, failed: true, error: true, startedAt: true, completedAt: true,
      },
    })
    return NextResponse.json({ runs })
  }

  if (view === "analytics") {
    const now = new Date()
    const since30d = new Date(now.getTime() - 30 * 86_400_000)
    const since7d = new Date(now.getTime() - 7 * 86_400_000)
    const mskDay = (date: Date) => new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(date)
    const visitorOf = (event: { userId: string | null; visitorKey: string | null; ipHash: string | null }) =>
      event.userId ? `user:${event.userId}` : event.visitorKey ? `browser:${event.visitorKey}` : event.ipHash ? `ip:${event.ipHash}` : null

    const [visits, priceReports, availabilityReports, priceReporters, availabilityReporters, visitsBefore7d] = await Promise.all([
      prisma.visitEvent.findMany({
        where: { path: { startsWith: "/services/fuel-map" }, createdAt: { gte: since30d } },
        select: { createdAt: true, visitorKey: true, ipHash: true, userId: true, city: true },
      }),
      prisma.fuelPriceReport.findMany({
        where: { createdAt: { gte: since30d } },
        select: { createdAt: true, userId: true },
      }),
      prisma.fuelAvailabilityReport.findMany({
        where: { createdAt: { gte: since30d } },
        select: { createdAt: true, userId: true },
      }),
      prisma.fuelPriceReport.findMany({
        where: { createdAt: { gte: since30d }, userId: { not: null } },
        distinct: ["userId"],
        select: { userId: true },
      }),
      prisma.fuelAvailabilityReport.findMany({
        where: { createdAt: { gte: since30d }, userId: { not: null } },
        distinct: ["userId"],
        select: { userId: true },
      }),
      prisma.visitEvent.findMany({
        where: { path: { startsWith: "/services/fuel-map" }, createdAt: { gte: since30d, lt: since7d } },
        select: { visitorKey: true, ipHash: true, userId: true },
      }),
    ])

    const dailyMap = new Map<string, { visits: number; uniqueVisitors: Set<string>; priceReports: number; availabilityReports: number }>()
    const cityMap = new Map<string, number>()
    const visitors7d = new Set<string>()
    const visitorsBefore7d = new Set<string>()
    const allVisitors = new Set<string>()

    for (const event of visits) {
      const day = mskDay(event.createdAt)
      const bucket = dailyMap.get(day) ?? { visits: 0, uniqueVisitors: new Set<string>(), priceReports: 0, availabilityReports: 0 }
      bucket.visits += 1
      const visitor = visitorOf(event)
      if (visitor) {
        bucket.uniqueVisitors.add(visitor)
        allVisitors.add(visitor)
        if (event.createdAt >= since7d) visitors7d.add(visitor)
      }
      if (event.city) cityMap.set(event.city, (cityMap.get(event.city) || 0) + 1)
      dailyMap.set(day, bucket)
    }
    for (const event of visitsBefore7d) {
      const visitor = visitorOf(event)
      if (visitor) visitorsBefore7d.add(visitor)
    }
    for (const report of priceReports) {
      const day = mskDay(report.createdAt)
      const bucket = dailyMap.get(day) ?? { visits: 0, uniqueVisitors: new Set<string>(), priceReports: 0, availabilityReports: 0 }
      bucket.priceReports += 1
      dailyMap.set(day, bucket)
    }
    for (const report of availabilityReports) {
      const day = mskDay(report.createdAt)
      const bucket = dailyMap.get(day) ?? { visits: 0, uniqueVisitors: new Set<string>(), priceReports: 0, availabilityReports: 0 }
      bucket.availabilityReports += 1
      dailyMap.set(day, bucket)
    }

    const daily = [...dailyMap.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([date, bucket]) => ({
        date,
        visits: bucket.visits,
        uniqueVisitors: bucket.uniqueVisitors.size,
        priceReports: bucket.priceReports,
        availabilityReports: bucket.availabilityReports,
      }))
    const newVisitors7d = [...visitors7d].filter((visitor) => !visitorsBefore7d.has(visitor)).length
    const activeReporters = new Set(
      [...priceReporters, ...availabilityReporters].map((row) => row.userId).filter((value): value is string => Boolean(value)),
    ).size

    return NextResponse.json({
      analytics: {
        visits30d: visits.length,
        uniqueVisitors30d: allVisitors.size,
        activeReporters,
        priceReports30d: priceReports.length,
        availabilityReports30d: availabilityReports.length,
        newVisitors7d,
        daily,
        cities: [...cityMap.entries()].sort((left, right) => right[1] - left[1]).slice(0, 12).map(([city, count]) => ({ city, count })),
      },
    })
  }

  const city = request.nextUrl.searchParams.get("city")?.trim() || null
  const source = request.nextUrl.searchParams.get("source")?.trim() || null
  const status = request.nextUrl.searchParams.get("status")?.trim() || null
  const query = request.nextUrl.searchParams.get("q")?.trim() || null
  const page = Math.max(1, Number(request.nextUrl.searchParams.get("page")) || 1)
  const pageSize = Math.min(Math.max(1, Number(request.nextUrl.searchParams.get("pageSize")) || PAGE_SIZE), MAX_PAGE_SIZE)

  const where = {
    ...(city ? { city } : {}),
    ...(source ? { source } : {}),
    ...(status && ALLOWED_STATUS.has(status) ? { status } : {}),
    ...(query
      ? {
          OR: [
            { name: { contains: query } },
            { brand: { contains: query } },
            { address: { contains: query } },
          ],
        }
      : {}),
  }

  const [total, stations, bySource, byCity, withPrices, withAvailability, lastRun, cities, sources] = await Promise.all([
    prisma.fuelStationImport.count({ where }),
    prisma.fuelStationImport.findMany({
      where,
      orderBy: [{ city: "asc" }, { name: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, source: true, sourceId: true, name: true, brand: true, address: true,
        city: true, latitude: true, longitude: true, status: true, fuelsNow: true,
        dtOnly: true, updatedAt: true,
        prices: {
          orderBy: { fuel: "asc" },
          select: { fuel: true, priceRub: true, confirmations: true, observedAt: true },
        },
      },
    }),
    prisma.fuelStationImport.groupBy({ by: ["source"], _count: { _all: true }, orderBy: { _count: { source: "desc" } } }),
    prisma.fuelStationImport.groupBy({ by: ["city"], _count: { _all: true }, orderBy: { _count: { city: "desc" } }, take: 20 }),
    prisma.fuelPriceImport.count({ where: { station: where } }),
    prisma.fuelStationImport.count({ where: { ...where, status: { not: null } } }),
    prisma.fuelImportRun.findFirst({ orderBy: { startedAt: "desc" }, select: { id: true, source: true, status: true, fetched: true, upserted: true, failed: true, startedAt: true, completedAt: true } }),
    prisma.fuelStationImport.findMany({ distinct: ["city"], select: { city: true }, orderBy: { city: "asc" } }),
    prisma.fuelStationImport.findMany({ distinct: ["source"], select: { source: true }, orderBy: { source: "asc" } }),
  ])

  return NextResponse.json({
    summary: {
      total,
      withPrices,
      withAvailability,
      bySource: bySource.map((row) => ({ source: row.source, count: row._count._all })),
      byCity: byCity.map((row) => ({ city: row.city, count: row._count._all })),
      lastRun,
    },
    stations,
    cities: cities.map((row) => row.city).filter((value): value is string => Boolean(value)),
    sources: sources.map((row) => row.source),
    page,
    pageSize,
    total,
  })
}


/* Прогон занимает минуты и держит соединение с источником. Если запустить
   второй поверх первого, оба будут долбить один сайт и упрутся в защиту,
   поэтому запуск отклоняется, пока предыдущий не завершился. */
const RUN_STALE_MS = 30 * 60_000

/**
 * Ручной запуск скрейпера из админки.
 *
 * Тот же сбор, что и по cron, но под сессией администратора: раздавать
 * PARSER_TOKEN в браузер нельзя, поэтому маршрут вызывает общий модуль
 * прогона напрямую, а не ходит в /api/parser/fuel/sync через loopback.
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdminSession()
  if (guard.denied) return guard.denied
  const session = guard.session

  return runAdminRoute("Fuel scraper manual run", async () => {
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

    const requestedRegions = Array.isArray(body?.regions)
      ? body.regions.filter((value): value is string => typeof value === "string")
      : undefined
    const knownKeys = new Set(targetRegionKeys())
    const unknown = requestedRegions?.filter((key) => !knownKeys.has(key))
    if (unknown?.length) {
      return NextResponse.json({ error: `Неизвестные регионы: ${unknown.join(", ")}` }, { status: 400 })
    }

    const pauseMs = typeof body?.pauseMs === "number" && Number.isFinite(body.pauseMs)
      ? Math.min(Math.max(body.pauseMs, 500), 30_000)
      : undefined

    /* Зависший прогон (упавший процесс не закрыл запись) не должен
       блокировать сбор навсегда, поэтому свежесть ограничена по времени. */
    const running = await prisma.fuelImportRun.findFirst({
      where: { status: "RUNNING", startedAt: { gte: new Date(Date.now() - RUN_STALE_MS) } },
      orderBy: { startedAt: "desc" },
      select: { id: true, source: true, startedAt: true },
    })
    if (running) {
      return NextResponse.json(
        { error: `Прогон ${running.source} уже идёт, дождитесь его завершения` },
        { status: 409 },
      )
    }

    const { results } = await runFuelSources(sources, requestedRegions, pauseMs)
    const fetched = results.reduce((sum, row) => sum + row.fetched, 0)
    const saved = results.reduce((sum, row) => sum + row.saved, 0)
    const failed = results.reduce((sum, row) => sum + row.failed, 0)

    await recordAdminAudit({
      actorId: session.user?.id || null,
      actorEmail: session.user?.email,
      action: "FUEL_SCRAPER_RUN",
      entityType: "FuelImportRun",
      summary: `Ручной сбор АЗС (${sources.join(", ")}): собрано ${fetched}, сохранено ${saved}, ошибок ${failed}`,
      metadata: {
        sources: results.map((row) => ({ source: row.source, status: row.status, fetched: row.fetched, saved: row.saved, failed: row.failed })),
        regions: requestedRegions ?? null,
        pauseMs: pauseMs ?? null,
      },
    })

    return NextResponse.json({ success: true, fetched, saved, failed, sources: results })
  }, "Не удалось запустить сбор АЗС")
}
