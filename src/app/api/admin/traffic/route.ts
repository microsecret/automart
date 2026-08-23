import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { isAdmin } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { moscowHour } from "@/lib/moscow-periods"
import {
  isTrafficPeriod, periodLabel, periodRange, previousPeriodRange,
  refererHost, trafficSourceLabel, type TrafficPeriod,
} from "@/lib/traffic-periods"

export const dynamic = "force-dynamic"

/** Сколько строк показывать в списках: длиннее их не читают. */
const TOP_LIMIT = 12

function countUnique(events: { visitorKey: string | null; ipHash: string | null }[]) {
  // Уникальность по ключу посетителя, а при его отсутствии — по хешу адреса:
  // без этого один человек с отключёнными куками считался бы за десятерых.
  return new Set(events.map((e) => e.visitorKey || e.ipHash).filter(Boolean)).size
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!isAdmin(session?.user?.role)) return NextResponse.json({ error: "Нет прав" }, { status: 403 })

  const raw = new URL(request.url).searchParams.get("period")
  const period: TrafficPeriod = isTrafficPeriod(raw) ? raw : "week"

  try {
    const now = new Date()
    const current = periodRange(period, now)
    const previous = previousPeriodRange(period, now)

    const [events, previousEvents] = await Promise.all([
      prisma.visitEvent.findMany({
        // Верхняя граница закрывает период явно: у календарного месяца она
        // наступает раньше, чем «сейчас», как только начнётся следующий.
        where: { createdAt: { gte: current.from, lt: current.to } },
        select: {
          createdAt: true, path: true, visitorKey: true, ipHash: true,
          referer: true, trafficSource: true, deviceType: true, campaign: true,
        },
        // Ограничение защищает от выборки в сотни тысяч строк на месячном
        // периоде: точность счётчиков от этого не страдает на текущих объёмах.
        take: 50_000,
        orderBy: { createdAt: "desc" },
      }),
      prisma.visitEvent.findMany({
        where: { createdAt: { gte: previous.from, lt: previous.to } },
        select: { visitorKey: true, ipHash: true },
        take: 50_000,
      }),
    ])

    // Источники: считаем посетителей, а не просмотры — иначе один человек,
    // открывший двадцать страниц, перевесит двадцать разных людей.
    const bySource = new Map<string, Set<string>>()
    const byReferer = new Map<string, Set<string>>()
    const byDevice = new Map<string, Set<string>>()
    const byCampaign = new Map<string, Set<string>>()
    const byPath = new Map<string, number>()
    const byHour = new Map<number, Set<string>>()

    for (const event of events) {
      const visitor = event.visitorKey || event.ipHash
      if (!visitor) continue

      const source = trafficSourceLabel(event.trafficSource)
      if (!bySource.has(source)) bySource.set(source, new Set())
      bySource.get(source)!.add(visitor)

      const host = refererHost(event.referer)
      if (host) {
        if (!byReferer.has(host)) byReferer.set(host, new Set())
        byReferer.get(host)!.add(visitor)
      }

      const device = event.deviceType || "Неизвестно"
      if (!byDevice.has(device)) byDevice.set(device, new Set())
      byDevice.get(device)!.add(visitor)

      if (event.campaign) {
        if (!byCampaign.has(event.campaign)) byCampaign.set(event.campaign, new Set())
        byCampaign.get(event.campaign)!.add(visitor)
      }

      byPath.set(event.path, (byPath.get(event.path) || 0) + 1)

      // Час берётся московский: сервер живёт в UTC и без пересчёта пик
      // активности смещался бы на три часа назад.
      const hour = moscowHour(event.createdAt)
      if (!byHour.has(hour)) byHour.set(hour, new Set())
      byHour.get(hour)!.add(visitor)
    }

    const toList = (map: Map<string, Set<string>>) =>
      [...map.entries()]
        .map(([name, visitors]) => ({ name, visitors: visitors.size }))
        .sort((a, b) => b.visitors - a.visitors)
        .slice(0, TOP_LIMIT)

    const uniqueVisitors = countUnique(events)
    const previousVisitors = countUnique(previousEvents)

    return NextResponse.json({
      period,
      periodLabel: periodLabel(period, now),
      totals: {
        views: events.length,
        uniqueVisitors,
        previousVisitors,
        // Разница в процентах: без неё число посетителей ничего не говорит.
        change: previousVisitors > 0
          ? Math.round(((uniqueVisitors - previousVisitors) / previousVisitors) * 100)
          : null,
      },
      sources: toList(bySource),
      referers: toList(byReferer),
      devices: toList(byDevice),
      campaigns: toList(byCampaign),
      topPaths: [...byPath.entries()]
        .map(([path, views]) => ({ path, views }))
        .sort((a, b) => b.views - a.views)
        .slice(0, TOP_LIMIT),
      // Активность по часам показывает, когда запускать рассылку.
      hourly: Array.from({ length: 24 }, (_, hour) => ({
        hour,
        visitors: byHour.get(hour)?.size || 0,
      })),
    })
  } catch (error) {
    console.error("Admin traffic stats failed:", error)
    return NextResponse.json({ error: "Не удалось загрузить аналитику" }, { status: 500 })
  }
}
