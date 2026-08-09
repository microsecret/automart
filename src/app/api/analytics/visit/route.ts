import crypto from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

function hashIp(value: string) {
  const salt = process.env.ANALYTICS_HASH_SALT || process.env.NEXTAUTH_SECRET || "local-analytics-salt"
  return crypto.createHash("sha256").update(`${salt}:${value}`).digest("hex")
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({})) as { path?: unknown; sessionKey?: unknown }
    const path = String(body.path || "").slice(0, 200)
    if (!path.startsWith("/")) return NextResponse.json({ error: "Invalid path" }, { status: 400 })

    const session = await getServerSession(authOptions).catch(() => null)
    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    const remoteIp = forwarded || request.headers.get("x-real-ip") || "unknown"
    const sessionKey = typeof body.sessionKey === "string" ? body.sessionKey.slice(0, 120) : null

    await prisma.visitEvent.create({
      data: {
        path,
        sessionKey,
        ipHash: hashIp(remoteIp),
        userAgent: request.headers.get("user-agent")?.slice(0, 500) || null,
        referer: request.headers.get("referer")?.slice(0, 500) || null,
        userId: session?.user?.id || null,
      },
    })
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error("Visit analytics error:", error)
    return new NextResponse(null, { status: 204 })
  }
}
