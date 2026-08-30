import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit"
import { composeCampaignAttribution, hashAnalyticsIp, isAutomatedUserAgent } from "@/lib/analytics-identity"
import { registerVisitScreen, visitScreen } from "@/lib/visit-dedup"

export const dynamic = "force-dynamic"

const ANALYTICS_KEY = /^[A-Za-z0-9_-]{16,120}$/
const INTERNAL_WORKSPACE_PREFIXES = ["/admin", "/moderation"]

function classifyDevice(userAgent: string) {
  if (/ipad|tablet|kindle|silk/i.test(userAgent)) return "TABLET"
  if (/android|iphone|ipod|mobile/i.test(userAgent)) return "MOBILE"
  return "DESKTOP"
}

function normalizedAttribution(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : ""
}

function classifyTrafficSource(referer: string, utmSource: string, request: NextRequest, fromApp: boolean) {
  /* Приложение сообщает о себе отдельным признаком, а не подделкой
     ссылающейся страницы.

     Открытое внутри мессенджера, оно не имеет referer, и все его
     посещения падали в «прямые заходы» — неотличимо от людей, набравших
     адрес вручную. Долю Telegram увидеть было нельзя, хотя это отдельный
     канал, ради которого приложение и делалось. */
  if (fromApp) return "TELEGRAM_APP"
  if (utmSource) return `UTM:${utmSource.toLocaleUpperCase("en-US").replace(/[^A-Z0-9._-]/g, "").slice(0, 48) || "OTHER"}`
  if (!referer) return "DIRECT"
  try {
    const host = new URL(referer).hostname.toLocaleLowerCase("en-US")
    const ownHost = request.nextUrl.hostname.toLocaleLowerCase("en-US")
    if (!host || host === ownHost || host.endsWith(`.${ownHost}`)) return "INTERNAL"
    if (/google\.|yandex\.|bing\.|mail\.ru$|duckduckgo\./.test(host)) return "ORGANIC_SEARCH"
    if (/(?:^|\.)(?:t\.me|telegram\.me|vk\.com|ok\.ru|youtube\.com|rutube\.ru)$/.test(host)) return "SOCIAL"
    return "REFERRAL"
  } catch {
    return "DIRECT"
  }
}

export async function POST(request: NextRequest) {
  try {
    const clientIp = getClientIp(request)
    const limit = rateLimit(`analytics:visit:ip:${clientIp}`, { windowMs: 5 * 60_000, maxRequests: 120 })
    if (!limit.success) {
      return NextResponse.json(
        { error: "Слишком много событий. Попробуйте позже." },
        { status: 429, headers: rateLimitHeaders(limit) },
      )
    }

    const userAgent = request.headers.get("user-agent")?.slice(0, 500) || ""
    if (isAutomatedUserAgent(userAgent)) return new NextResponse(null, { status: 204 })

    const body = await request.json().catch(() => ({})) as {
      path?: unknown
      screen?: unknown
      city?: unknown
      visitorKey?: unknown
      sessionKey?: unknown
      referer?: unknown
      utmSource?: unknown
      campaign?: unknown
      campaignContent?: unknown
      fromTelegramApp?: unknown
    }
    const path = String(body.path || "").slice(0, 200)
    if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/api/")) return NextResponse.json({ error: "Invalid path" }, { status: 400 })
    if (INTERNAL_WORKSPACE_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
      return new NextResponse(null, { status: 204 })
    }

    const session = await getServerSession(authOptions).catch(() => null)
    const visitorKey = typeof body.visitorKey === "string" && ANALYTICS_KEY.test(body.visitorKey) ? body.visitorKey : null
    const sessionKey = typeof body.sessionKey === "string" && ANALYTICS_KEY.test(body.sessionKey) ? body.sessionKey : null
    const referer = normalizedAttribution(body.referer, 500)
    const utmSource = normalizedAttribution(body.utmSource, 80)
    /* Признак приложения приходит от клиента, поэтому подделать его
       можно — но выгоды в этом нет: он влияет только на разбивку
       статистики, не на права и не на данные. */
    const fromTelegramApp = body.fromTelegramApp === true

    /* Город человек выбирает сам — на карте заправок или в фильтре
       каталога. Длину режем: это подпись для отчёта, а не поле поиска. */
    const city = typeof body.city === "string" && body.city.trim().length > 1
      ? body.city.trim().slice(0, 80)
      : null
    const campaign = composeCampaignAttribution(body.campaign, body.campaignContent)
    const ipHash = hashAnalyticsIp(clientIp)

    /* Повторные отправки одного beacon-а не должны раздувать счётчик, но и
       настоящий переход терять нельзя. Сравнивается экран целиком — путь со
       строкой запроса, — поэтому смена фильтров каталога и возврат назад
       считаются просмотрами, а дубль той же страницы — нет.

       Раньше здесь стоял запрос в базу по одному пути: он отбрасывал любой
       переход внутри раздела, случившийся в пределах десяти секунд. */
    const screen = visitScreen(path, body.screen)
    const visitorId = sessionKey || visitorKey || `${ipHash}:${userAgent}`
    if (registerVisitScreen(visitorId, screen)) return new NextResponse(null, { status: 204 })

    await prisma.visitEvent.create({
      data: {
        path,
        visitorKey,
        sessionKey,
        ipHash,
        userAgent,
        referer: referer || null,
        deviceType: classifyDevice(userAgent),
        trafficSource: classifyTrafficSource(referer, utmSource, request, fromTelegramApp),
        campaign,
        city,
        userId: session?.user?.id || null,
      },
    })
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error("Visit analytics error:", error)
    return new NextResponse(null, { status: 204 })
  }
}
