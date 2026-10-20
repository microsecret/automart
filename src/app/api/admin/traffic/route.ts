import { NextRequest, NextResponse } from "next/server"
import { requireAdminSession } from "@/lib/admin-route-guard"
import { prisma } from "@/lib/prisma"
import { trafficVisitorIdentity, type AnonymousTrafficIdentity } from "@/lib/analytics-identity"
import { moscowDayKey, moscowHour } from "@/lib/moscow-periods"
import { SECTION_GROUP_LABELS, sectionForPath, readablePath } from "@/lib/traffic-sections"
import {
  isTrafficPeriod, periodLabel, periodRange, previousPeriodRange,
  refererHost, trafficSourceLabel, type TrafficPeriod,
} from "@/lib/traffic-periods"

export const dynamic = "force-dynamic"

/** Сколько строк показывать в списках: длиннее их не читают. */
const TOP_LIMIT = 12

function countUnique(events: AnonymousTrafficIdentity[]) {
  // Use the same privacy-safe identity as the main administrator summary.
  return new Set(events.map(trafficVisitorIdentity).filter(Boolean)).size
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
        where: { createdAt: { gte: current.from, lt: current.to, lte: now } },
        select: {
          createdAt: true, path: true, visitorKey: true, ipHash: true, sessionKey: true,
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
        /* Путь нужен, чтобы сравнить разделы: «карта заправок выросла
           вдвое» полезнее, чем «посетителей стало больше». */
        select: { visitorKey: true, ipHash: true, sessionKey: true, path: true },
        take: 50_000,
        orderBy: { createdAt: "desc" },
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
    /* Просмотры рядом с посетителями: десять человек, открывших по
       странице, и один, открывший десять, — разные истории. */
    const viewsByHour = new Map<number, number>()
    /* Раздел вместо адреса: список путей отвечает «куда заходят», а
       владелец смотрит, живёт ли раздел запчастей и окупается ли карта. */
    const bySection = new Map<string, { label: string; group: string; visitors: Set<string>; views: number }>()
    const byCity = new Map<string, Set<string>>()
    const byDay = new Map<string, { visitors: Set<string>; views: number }>()
    const signedIn = new Set<string>()
    const viewsPerSession = new Map<string, number>()

    for (const event of events) {
      // Views are real even for legacy rows without any visitor identifier.
      // Do not fabricate a visitor, or drop those views from the charts.
      byPath.set(event.path, (byPath.get(event.path) || 0) + 1)
      const section = sectionForPath(event.path)
      if (!bySection.has(section.key)) {
        bySection.set(section.key, { label: section.label, group: section.group, visitors: new Set(), views: 0 })
      }
      const sectionEntry = bySection.get(section.key)!
      sectionEntry.views += 1
      const day = moscowDayKey(event.createdAt)
      if (!byDay.has(day)) byDay.set(day, { visitors: new Set(), views: 0 })
      const dayEntry = byDay.get(day)!
      dayEntry.views += 1
      const hour = moscowHour(event.createdAt)
      viewsByHour.set(hour, (viewsByHour.get(hour) || 0) + 1)
      if (event.sessionKey) viewsPerSession.set(event.sessionKey, (viewsPerSession.get(event.sessionKey) || 0) + 1)

      const visitor = trafficVisitorIdentity(event)
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

      sectionEntry.visitors.add(visitor)

      if (event.city) {
        if (!byCity.has(event.city)) byCity.set(event.city, new Set())
        byCity.get(event.city)!.add(visitor)
      }

      /* Динамика по дням: одна цифра за период не показывает, был ли
         рост ровным или это всплеск одного дня. */
      dayEntry.visitors.add(visitor)

      if (event.userId) signedIn.add(visitor)

      // Час берётся московский: сервер живёт в UTC и без пересчёта пик
      // активности смещался бы на три часа назад.
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

    /* Тот же разбор для прошлого периода: рост считается по разделам, а
       не только по площадке целиком. */
    const previousBySection = new Map<string, Set<string>>()
    const previousVisitorSet = new Set<string>()
    for (const event of previousEvents) {
      const visitor = trafficVisitorIdentity(event)
      if (!visitor) continue
      previousVisitorSet.add(visitor)
      const key = sectionForPath(event.path).key
      if (!previousBySection.has(key)) previousBySection.set(key, new Set())
      previousBySection.get(key)!.add(visitor)
    }

    /* Новые и вернувшиеся.

       Сто посетителей за неделю — это сто новых людей или двадцать
       постоянных, зашедших по пять раз? Ответ меняет решение: в первом
       случае площадку находят, но не возвращаются, во втором — наоборот.

       Вернувшимся считаем того, кто был и в прошлом отрезке. */
    const currentVisitors = new Set<string>()
    for (const event of events) {
      const visitor = trafficVisitorIdentity(event)
      if (visitor) currentVisitors.add(visitor)
    }
    const returning = [...currentVisitors].filter((visitor) => previousVisitorSet.has(visitor)).length

    /* Сколько страниц открывает один человек. Одно посещение на
       посетителя означает, что люди приходят и сразу уходят, а десять —
       что площадкой действительно пользуются. */
    const totalViews = events.length
    const viewsPerVisit = uniqueVisitors > 0 ? Math.round((totalViews / uniqueVisitors) * 10) / 10 : 0

    /* Один экран за визит — это отказ: человек открыл страницу и ушёл,
       не заглянув дальше. */
    const bounced = [...viewsPerSession.values()].filter((count) => count === 1).length
    const bounceRate = viewsPerSession.size > 0 ? Math.round((bounced / viewsPerSession.size) * 100) : 0

    // A visitor can open several sections within one product group. Union
    // the identities once instead of adding per-section unique counts.
    const byGroup = new Map<string, { group: string; label: string; visitors: Set<string>; views: number }>()
    for (const entry of bySection.values()) {
      let group = byGroup.get(entry.group)
      if (!group) {
        group = { group: entry.group, label: SECTION_GROUP_LABELS[entry.group as keyof typeof SECTION_GROUP_LABELS] || entry.group, visitors: new Set(), views: 0 }
        byGroup.set(entry.group, group)
      }
      group.views += entry.views
      for (const visitor of entry.visitors) group.visitors.add(visitor)
    }

    /* Сколько людей вообще дошло до бота.

       Посещаемость сайта не отвечает на этот вопрос: человек запускает
       бота в Telegram, и если дальше он не зарегистрировался, ни одного
       визита на сайт от него нет. Между тем это самая крупная воронка
       сервиса — и самая тихая: незавершённая регистрация выглядит как
       отсутствие человека, хотя он приходил и остановился на пороге. */
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const [botTotal, botDay, botWeek, botMonth, botRegistered, botPending, botBlocked] = await Promise.all([
      prisma.telegramContact.count(),
      prisma.telegramContact.count({ where: { startedAt: { gte: dayAgo } } }),
      prisma.telegramContact.count({ where: { startedAt: { gte: weekAgo } } }),
      prisma.telegramContact.count({ where: { startedAt: { gte: monthAgo } } }),
      prisma.telegramContact.count({ where: { registered: true } }),
      prisma.telegramContact.count({ where: { registered: false, blocked: false } }),
      prisma.telegramContact.count({ where: { blocked: true } }),
    ])

    return NextResponse.json({
      bot: {
        total: botTotal,
        day: botDay,
        week: botWeek,
        month: botMonth,
        registered: botRegistered,
        /* Не дошедшие до конца регистрации: им и уходит напоминание. */
        pending: botPending,
        blocked: botBlocked,
      },
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
        returningVisitors: returning,
        newVisitors: Math.max(0, uniqueVisitors - returning),
        /* Доля вернувшихся: площадку находят или ею пользуются? */
        returningShare: uniqueVisitors > 0 ? Math.round((returning / uniqueVisitors) * 100) : 0,
      },
      sources: toList(bySource),
      referers: toList(byReferer),
      devices: toList(byDevice),
      campaigns: toList(byCampaign),
      cities: toList(byCity),
      /* Сводка по направлениям: объявления, запчасти, аукционы, сервисы.

         Десять разделов в списке отвечают на вопрос точно, но не сразу:
         владелец хочет видеть за секунду, чем площадка живёт в целом, и
         только потом разбираться внутри направления. */
      groups: [...byGroup.values()]
        .map(({ visitors, ...group }) => ({ ...group, visitors: visitors.size }))
        .sort((a, b) => b.views - a.views),
      /* Разделы: чем люди пользовались, а не какие адреса открывали. */
      sections: [...bySection.entries()]
        .map(([key, entry]) => {
          const before = previousBySection.get(key)?.size || 0
          return {
            key,
            label: entry.label,
            group: entry.group,
            visitors: entry.visitors.size,
            views: entry.views,
            previousVisitors: before,
            /* Рост в процентах: раздел, выросший вдвое с двух человек до
               четырёх, и раздел, потерявший половину аудитории, требуют
               разного внимания. */
            change: before > 0 ? Math.round(((entry.visitors.size - before) / before) * 100) : null,
          }
        })
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
        views: viewsByHour.get(hour) || 0,
      })),
    })
  } catch (error) {
    console.error("Admin traffic stats failed:", error)
    return NextResponse.json({ error: "Не удалось загрузить аналитику" }, { status: 500 })
  }
}
