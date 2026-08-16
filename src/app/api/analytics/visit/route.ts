import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit"
import { hashAnalyticsIp, isAutomatedUserAgent } from "@/lib/analytics-identity"

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

function classifyTrafficSource(referer: string, utmSource: string, request: NextRequest) {
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
      visitorKey?: unknown
      sessionKey?: unknown
      referer?: unknown
      utmSource?: unknown
      campaign?: unknown
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
    const campaign = normalizedAttribution(body.campaign, 120) || null

    await prisma.visitEvent.create({
      data: {
        path,
        visitorKey,
        sessionKey,
        ipHash: hashAnalyticsIp(clientIp),
        userAgent,
        referer: referer || null,
        deviceType: classifyDevice(userAgent),
        trafficSource: classifyTrafficSource(referer, utmSource, request),
        campaign,
        userId: session?.user?.id || null,
      },
    })
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error("Visit analytics error:", error)
    return new NextResponse(null, { status: 204 })
  }
}
