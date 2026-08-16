import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

const IAUTOS_IMAGE_HOSTS = new Set(["qimg.iautos.cn", "s1.iautos.cn", "s2.iautos.cn", "s3.iautos.cn"])
const ALLOWED_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])
const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const FETCH_TIMEOUT_MS = 20_000

function permittedImageUrl(value: string | null) {
  if (!value || value.length > 2_000) return null
  try {
    const url = new URL(value)
    if (url.protocol !== "https:" || url.username || url.password || !IAUTOS_IMAGE_HOSTS.has(url.hostname)) return null
    if (!/\.(?:jpe?g|png|webp)(?:-[a-z0-9_-]+)?$/i.test(url.pathname)) return null
    return url
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  const sourceUrl = permittedImageUrl(request.nextUrl.searchParams.get("url"))
  if (!sourceUrl) return NextResponse.json({ error: "Unsupported auction image" }, { status: 400 })

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const upstream = await fetch(sourceUrl, {
      cache: "no-store",
      redirect: "error",
      signal: controller.signal,
      headers: {
        Accept: "image/avif,image/webp,image/png,image/jpeg;q=0.9,*/*;q=0.5",
        "User-Agent": "LeWheel-Auction-Media/1.0",
      },
    })
    if (!upstream.ok || !upstream.body) return NextResponse.json({ error: "Auction image unavailable" }, { status: 502 })

    const contentType = upstream.headers.get("content-type")?.split(";", 1)[0].trim().toLocaleLowerCase("en-US") || ""
    const contentLength = Number(upstream.headers.get("content-length"))
    if (!ALLOWED_CONTENT_TYPES.has(contentType) || (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_BYTES)) {
      await upstream.body.cancel()
      return NextResponse.json({ error: "Invalid auction image" }, { status: 502 })
    }

    const reader = upstream.body.getReader()
    const chunks: Uint8Array[] = []
    let size = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_IMAGE_BYTES) {
        await reader.cancel()
        return NextResponse.json({ error: "Auction image is too large" }, { status: 502 })
      }
      chunks.push(value)
    }

    return new NextResponse(Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(size),
        "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError"
    return NextResponse.json({ error: timedOut ? "Auction image timed out" : "Auction image unavailable" }, { status: 502 })
  } finally {
    clearTimeout(timeout)
  }
}
