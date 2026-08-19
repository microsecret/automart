import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

// Хосты, отдающие файл напрямую: путь заканчивается расширением, поэтому тип
// проверяется до запроса. Carsensor отвечает по тридцать секунд, и релей нужен
// ему ради кэша — файл скачивается один раз, дальше приходит из него.
const IAUTOS_IMAGE_HOSTS = new Set([
  "qimg.iautos.cn",
  "s1.iautos.cn",
  "s2.iautos.cn",
  "s3.iautos.cn",
  "ccsrpcma.carsensor.net",
])
// Carvago отдаёт не файл, а 302 на подписанную ссылку S3 со сроком жизни в
// один час. CloudFront кэширует сам редирект, поэтому браузер покупателя
// регулярно получает уже просроченную подпись и карточка остаётся без фото.
// Сервер проходит редирект в момент запроса и всегда получает свежую подпись.
const REDIRECTING_IMAGE_HOSTS = new Set(["storage.alpha-analytics.cz"])
const ALLOWED_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])
const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const FETCH_TIMEOUT_MS = 20_000

type PermittedImage = { url: URL; followRedirects: boolean }

function permittedImageUrl(value: string | null): PermittedImage | null {
  if (!value || value.length > 2_000) return null
  try {
    const url = new URL(value)
    if (url.protocol !== "https:" || url.username || url.password) return null

    if (IAUTOS_IMAGE_HOSTS.has(url.hostname)) {
      // У iAutos путь заканчивается расширением, поэтому проверка остаётся.
      if (!/\.(?:jpe?g|png|webp)(?:-[a-z0-9_-]+)?$/i.test(url.pathname)) return null
      return { url, followRedirects: false }
    }

    if (REDIRECTING_IMAGE_HOSTS.has(url.hostname)) {
      // Путь вида /get/<uuid> расширения не содержит, поэтому тип
      // подтверждается уже по content-type ответа.
      if (!/^\/get\/[a-f0-9-]{16,64}$/i.test(url.pathname)) return null
      return { url, followRedirects: true }
    }

    return null
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  const permitted = permittedImageUrl(request.nextUrl.searchParams.get("url"))
  if (!permitted) return NextResponse.json({ error: "Unsupported auction image" }, { status: 400 })

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const upstream = await fetch(permitted.url, {
      cache: "no-store",
      redirect: permitted.followRedirects ? "follow" : "error",
      signal: controller.signal,
      headers: {
        Accept: "image/avif,image/webp,image/png,image/jpeg;q=0.9,*/*;q=0.5",
        "User-Agent": "LeWheel-Auction-Media/1.0",
      },
    })
    if (!upstream.ok || !upstream.body) {
      clearTimeout(timeout)
      return NextResponse.json({ error: "Auction image unavailable" }, { status: 502 })
    }

    const contentType = upstream.headers.get("content-type")?.split(";", 1)[0].trim().toLocaleLowerCase("en-US") || ""
    const contentLengthHeader = upstream.headers.get("content-length")
    const contentLength = contentLengthHeader === null ? null : Number(contentLengthHeader)
    if (!ALLOWED_CONTENT_TYPES.has(contentType) || (contentLength !== null && Number.isFinite(contentLength) && contentLength > MAX_IMAGE_BYTES)) {
      clearTimeout(timeout)
      await upstream.body.cancel()
      return NextResponse.json({ error: "Invalid auction image" }, { status: 502 })
    }

    const reader = upstream.body.getReader()
    let size = 0
    const body = new ReadableStream<Uint8Array>({
      async pull(streamController) {
        try {
          const { done, value } = await reader.read()
          if (done) {
            clearTimeout(timeout)
            streamController.close()
            return
          }
          size += value.byteLength
          if (size > MAX_IMAGE_BYTES) {
            clearTimeout(timeout)
            await reader.cancel("Auction image is too large")
            streamController.error(new Error("Auction image is too large"))
            return
          }
          streamController.enqueue(value)
        } catch (error) {
          clearTimeout(timeout)
          streamController.error(error)
        }
      },
      async cancel(reason) {
        clearTimeout(timeout)
        await reader.cancel(reason)
      },
    })
    const headers = new Headers({
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000",
      "X-Content-Type-Options": "nosniff",
    })
    if (contentLength !== null && Number.isFinite(contentLength) && contentLength >= 0) headers.set("Content-Length", String(contentLength))

    return new NextResponse(body, {
      status: 200,
      headers,
    })
  } catch (error) {
    clearTimeout(timeout)
    const timedOut = error instanceof Error && error.name === "AbortError"
    return NextResponse.json({ error: timedOut ? "Auction image timed out" : "Auction image unavailable" }, { status: 502 })
  }
}
