import { NextRequest, NextResponse } from "next/server"
import { requireAdminSession } from "@/lib/admin-route-guard"
import { prisma } from "@/lib/prisma"
import { moscowDayKey, moscowHour } from "@/lib/moscow-periods"
import { sectionForPath, readablePath } from "@/lib/traffic-sections"
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
  const guard = await requireAdminSession()
  if (guard.denied) return guard.denied

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
          /* Город человек выбирает сам, userId отличает своего от гостя:
             владелец спрашивает и «откуда заходят», и «сколько вошедших». */
          city: true, userId: true,
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
    /* Раздел вместо адреса: список путей отвечает «куда заходят», а
       владелец смотрит, живёт ли раздел запчастей и окупается ли карта. */
    const bySection = new Map<string, { label: string; group: string; visitors: Set<string>; views: number }>()
    const byCity = new Map<string, Set<string>>()
    const byDay = new Map<string, { visitors: Set<string>; views: number }>()
    const signedIn = new Set<string>()
    const viewsPerVisitor = new Map<string, number>()

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

      const section = sectionForPath(event.path)
      if (!bySection.has(section.key)) {
        bySection.set(section.key, { label: section.label, group: section.group, visitors: new Set(), views: 0 })
      }
      const sectionEntry = bySection.get(section.key)!
      sectionEntry.visitors.add(visitor)
      sectionEntry.views += 1

      if (event.city) {
        if (!byCity.has(event.city)) byCity.set(event.city, new Set())
        byCity.get(event.city)!.add(visitor)
      }

      /* Динамика по дням: одна цифра за период не показывает, был ли
         рост ровным или это всплеск одного дня. */
      const day = moscowDayKey(event.createdAt)
      if (!byDay.has(day)) byDay.set(day, { visitors: new Set(), views: 0 })
      const dayEntry = byDay.get(day)!
      dayEntry.visitors.add(visitor)
      dayEntry.views += 1

      if (event.userId) signedIn.add(visitor)
      viewsPerVisitor.set(visitor, (viewsPerVisitor.get(visitor) || 0) + 1)

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

    /* Сколько страниц открывает один человек. Одно посещение на
       посетителя означает, что люди приходят и сразу уходят, а десять —
       что площадкой действительно пользуются. */
    const totalViews = events.length
    const viewsPerVisit = uniqueVisitors > 0 ? Math.round((totalViews / uniqueVisitors) * 10) / 10 : 0

    /* Один экран за визит — это отказ: человек открыл страницу и ушёл,
       не заглянув дальше. */
    const bounced = [...viewsPerVisitor.values()].filter((count) => count <= 1).length
    const bounceRate = uniqueVisitors > 0 ? Math.round((bounced / uniqueVisitors) * 100) : 0

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
      totalsExtra: {
        viewsPerVisit,
        bounceRate,
        signedInVisitors: signedIn.size,
        /* Доля вошедших: гость смотрит, вошедший действует. Владельцу
           важно, растёт ли вторая половина. */
        signedInShare: uniqueVisitors > 0 ? Math.round((signedIn.size / uniqueVisitors) * 100) : 0,
      },
      sources: toList(bySource),
      referers: toList(byReferer),
      devices: toList(byDevice),
      campaigns: toList(byCampaign),
      cities: toList(byCity),
      /* Разделы: чем люди пользовались, а не какие адреса открывали. */
      sections: [...bySection.entries()]
        .map(([key, entry]) => ({ key, label: entry.label, group: entry.group, visitors: entry.visitors.size, views: entry.views }))
        .sort((a, b) => b.visitors - a.visitors),
      /* Динамика по дням: ровный рост или всплеск одного дня. */
      daily: [...byDay.entries()]
        .map(([day, entry]) => ({ day, visitors: entry.visitors.size, views: entry.views }))
        .sort((a, b) => a.day.localeCompare(b.day)),
      /* Понятное имя рядом с адресом: «/listings/vehicle/1f020612-75f5…»
         владелец не узнаёт — он не помнит машины по коду. */
      topPaths: [...byPath.entries()]
        .map(([path, views]) => ({ path, label: readablePath(path), views }))
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
