import { NextRequest, NextResponse } from "next/server"
import { parseProxyList, proxyGetBuffer } from "@/lib/proxy-fetch"

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
// Carsensor ограничивает скорость по адресу сервера: снимок идёт со скоростью
// 178 байт в секунду и обрывается на середине. Через прокси тот же файл
// приходит за доли секунды, поэтому такие хосты качаются в обход.
const THROTTLED_IMAGE_HOSTS = new Set(["ccsrpcma.carsensor.net"])
const ALLOWED_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])

/* Типы, которыми источник признаётся, что сам не знает, что отдаёт.

   beforward.jp помечает снимки как binary/octet-stream: файл настоящий и
   открывается, но оптимизатор картинок Next такой тип не принимает и
   отвечает пятисотой ошибкой. Шестьсот восемьдесят четыре живых лота из
   Японии показывались без фотографий — а по фотографии машину и выбирают.

   Такие ответы не отвергаются сразу: тип определяется по первым байтам
   самого файла, как это делает браузер. */
const UNTYPED_CONTENT_TYPES = new Set(["", "binary/octet-stream", "application/octet-stream"])

/**
 * Определяет тип картинки по её началу.
 *
 * Подпись формата стоит в первых байтах файла и подделать её мимоходом
 * нельзя: если содержимое не картинка, ни одна подпись не совпадёт, и
 * пересылка честно откажет.
 */
function sniffImageType(head: Uint8Array): string | null {
  if (head.length < 12) return null

  /* JPEG: FF D8 FF */
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "image/jpeg"

  /* PNG: 89 50 4E 47 0D 0A 1A 0A */
  if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) return "image/png"

  /* WebP: RIFF....WEBP */
  const ascii = (from: number, to: number) => String.fromCharCode(...head.slice(from, to))
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp"

  return null
}
const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const FETCH_TIMEOUT_MS = 20_000

/* Адреса, которые источник не отдал, запоминаются на четверть часа.

   Лоты живут месяцами, а фотографии на японских и корейских площадках
   пропадают вместе с проданной машиной. Каждый заход на такую карточку
   уходил до источника и возвращался ни с чем: замер показал пять секунд
   на один битый адрес — и так для каждого посетителя.

   Пятнадцать минут — срок, за который источник может восстановить
   картинку; дольше держать отказ нельзя, иначе вернувшееся фото не
   покажется. Хранится только сам адрес, не содержимое: снимки тяжёлые,
   а их кэшируют браузер и промежуточные узлы по заголовкам ответа. */
const FAILURE_TTL_MS = 15 * 60 * 1000
const FAILURE_CACHE_LIMIT = 512

const failedMedia = new Map<string, number>()

function isKnownFailure(url: string): boolean {
  const at = failedMedia.get(url)
  if (at === undefined) return false
  if (Date.now() - at >= FAILURE_TTL_MS) {
    failedMedia.delete(url)
    return false
  }
  return true
}

function rememberFailure(url: string): void {
  // Предел держит память: адресов у лотов десятки тысяч, а помнить нужно
  // только те, что спрашивали недавно.
  if (failedMedia.size >= FAILURE_CACHE_LIMIT) {
    const oldest = failedMedia.keys().next().value
    if (oldest !== undefined) failedMedia.delete(oldest)
  }
  failedMedia.set(url, Date.now())
}

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

    /* beforward: путь вида /large/202607/16056224/CE174713_205c37a2.jpg.

       Набор символов проверяется, как и у остальных источников: без этого
       через пересылку можно было бы дотянуться до чего угодно на чужом
       узле. Сам тип файла источник называет неверно, поэтому он
       определяется по содержимому уже при чтении ответа. */
    if (url.hostname === "image-cdn.beforward.jp") {
      if (!/^\/[a-z0-9_-]+\/\d{6}\/\d+\/[A-Za-z0-9_-]+\.(?:jpe?g|png|webp)$/i.test(url.pathname)) return null
      return { url, followRedirects: false }
    }

    return null
  } catch {
    return null
  }
}

/**
 * Скачивает снимок через прокси.
 *
 * Возвращает null, если прокси не настроены или ответ не похож на картинку —
 * тогда вызывающий код идёт обычным путём. Кэш ответа тот же, что и у прямой
 * загрузки: медленный источник опрашивается один раз в сутки.
 */
async function fetchThrottledImage(url: URL) {
  const proxies = parseProxyList(process.env.NVIDIA_PROXIES)
  if (!proxies.length) return null

  const proxy = proxies[Math.floor(Math.random() * proxies.length)]
  try {
    const response = await proxyGetBuffer(url.toString(), proxy, {
      timeoutMs: FETCH_TIMEOUT_MS,
      maxBytes: MAX_IMAGE_BYTES,
      headers: {
        Accept: "image/avif,image/webp,image/png,image/jpeg;q=0.9,*/*;q=0.5",
        "User-Agent": "LeWheel-Auction-Media/1.0",
      },
    })
    const contentType = response.contentType?.split(";", 1)[0].trim().toLocaleLowerCase("en-US") || ""
    if (!response.ok || !ALLOWED_CONTENT_TYPES.has(contentType) || !response.body.length) return null

    return new NextResponse(new Uint8Array(response.body), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(response.body.length),
        "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch {
    // Прокси мог отпасть — прямой путь остаётся запасным.
    return null
  }
}

export async function GET(request: NextRequest) {
  const permitted = permittedImageUrl(request.nextUrl.searchParams.get("url"))
  if (!permitted) return NextResponse.json({ error: "Unsupported auction image" }, { status: 400 })

  // Хосты, режущие скорость по адресу сервера, качаются через прокси целиком:
  // потоковая отдача здесь ничего не даёт, файл всё равно небольшой, зато
  // ответ приходит за доли секунды вместо полутора минут с обрывом.
  if (THROTTLED_IMAGE_HOSTS.has(permitted.url.hostname)) {
    const proxied = await fetchThrottledImage(permitted.url)
    if (proxied) return proxied
  }

  const target = permitted.url.toString()
  if (isKnownFailure(target)) {
    return NextResponse.json({ error: "Auction image unavailable" }, { status: 502 })
  }

  const controller = new AbortController()

  /* Отсчёт идёт от последней полученной порции, а не от начала запроса.

     Общий таймер рвал передачу на середине: пока файл отдаётся браузеру
     порциями, двадцать секунд от начала истекали, соединение обрывалось —
     и картинка не доходила, хотя источник исправно её отдавал. Теперь срок
     ловит именно зависание: пока данные идут, отсчёт начинается заново. */
  let timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  const renewTimeout = () => {
    clearTimeout(timeout)
    timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  }
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
      rememberFailure(target)
      return NextResponse.json({ error: "Auction image unavailable" }, { status: 502 })
    }

    const declaredType = upstream.headers.get("content-type")?.split(";", 1)[0].trim().toLocaleLowerCase("en-US") || ""
    const contentLengthHeader = upstream.headers.get("content-length")
    const contentLength = contentLengthHeader === null ? null : Number(contentLengthHeader)

    if (contentLength !== null && Number.isFinite(contentLength) && contentLength > MAX_IMAGE_BYTES) {
      clearTimeout(timeout)
      await upstream.body.cancel()
      rememberFailure(target)
      return NextResponse.json({ error: "Invalid auction image" }, { status: 502 })
    }

    const reader = upstream.body.getReader()

    /* Тип определяется по содержимому, когда источник его не назвал.

       Первая порция читается заранее и отдаётся дальше в потоке: она нужна
       и для подписи формата, и как начало самого файла. */
    let firstChunk: Uint8Array | null = null
    let contentType = declaredType

    if (!ALLOWED_CONTENT_TYPES.has(declaredType)) {
      if (!UNTYPED_CONTENT_TYPES.has(declaredType)) {
        clearTimeout(timeout)
        await reader.cancel("Unsupported content type")
        rememberFailure(target)
        return NextResponse.json({ error: "Invalid auction image" }, { status: 502 })
      }

      const first = await reader.read()
      if (first.done || !first.value) {
        clearTimeout(timeout)
        rememberFailure(target)
        return NextResponse.json({ error: "Auction image unavailable" }, { status: 502 })
      }

      const sniffed = sniffImageType(first.value)
      if (!sniffed) {
        clearTimeout(timeout)
        await reader.cancel("Body is not an image")
        rememberFailure(target)
        return NextResponse.json({ error: "Invalid auction image" }, { status: 502 })
      }

      firstChunk = first.value
      contentType = sniffed
    }

    let size = 0
    const body = new ReadableStream<Uint8Array>({
      async pull(streamController) {
        try {
          /* Порция, прочитанная ради подписи формата, отдаётся первой. */
          if (firstChunk) {
            const head = firstChunk
            firstChunk = null
            size += head.byteLength
            streamController.enqueue(head)
            return
          }

          const { done, value } = await reader.read()
          if (done) {
            clearTimeout(timeout)
            streamController.close()
            return
          }
          renewTimeout()
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
