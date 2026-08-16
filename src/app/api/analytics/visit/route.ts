import crypto from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

const BOT_USER_AGENT = /(?:bot|crawler|spider|slurp|headless|lighthouse|pagespeed|monitoring|uptime|preview|facebookexternalhit|telegrambot)/i
const ANALYTICS_KEY = /^[A-Za-z0-9_-]{16,120}$/

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

function hashIp(value: string) {
  const salt = process.env.ANALYTICS_HASH_SALT || process.env.NEXTAUTH_SECRET || "local-analytics-salt"
  return crypto.createHash("sha256").update(`${salt}:${value}`).digest("hex")
}

export async function POST(request: NextRequest) {
  try {
    const limit = rateLimit(`analytics:visit:ip:${getClientIp(request)}`, { windowMs: 5 * 60_000, maxRequests: 120 })
    if (!limit.success) {
      return NextResponse.json(
        { error: "Слишком много событий. Попробуйте позже." },
        { status: 429, headers: rateLimitHeaders(limit) },
      )
    }

    const userAgent = request.headers.get("user-agent")?.slice(0, 500) || ""
    if (!userAgent || BOT_USER_AGENT.test(userAgent)) return new NextResponse(null, { status: 204 })

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

    const session = await getServerSession(authOptions).catch(() => null)
    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    const remoteIp = forwarded || request.headers.get("x-real-ip") || "unknown"
    const visitorKey = typeof body.visitorKey === "string" && ANALYTICS_KEY.test(body.visitorKey) ? body.visitorKey : null
    const sessionKey = typeof body.sessionKey === "string" && ANALYTICS_KEY.test(body.sessionKey) ? body.sessionKey : null
    const referer = normalizedAttribution(body.referer, 500)
    const utmSource = normalizedAttribution(body.utmSource, 80)
    const campaign = normalizedAttribution(body.campaign, 120) || null

    if (sessionKey) {
      const duplicate = await prisma.visitEvent.findFirst({
        where: { sessionKey, path, createdAt: { gte: new Date(Date.now() - 30_000) } },
        select: { id: true },
      })
      if (duplicate) return new NextResponse(null, { status: 204 })
    }

    await prisma.visitEvent.create({
      data: {
        path,
        visitorKey,
        sessionKey,
        ipHash: hashIp(remoteIp),
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
