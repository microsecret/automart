/**
 * Простой in-memory rate limiter.
 * Для продакшена лучше использовать Redis.
 */
const requests = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT_SWEEP_INTERVAL_MS = 60_000
const MAX_RATE_LIMIT_BUCKETS = 10_000
let lastRateLimitSweepAt = Date.now()

interface RateLimitOptions {
  windowMs: number
  maxRequests: number
}

interface RateLimitResult {
  success: boolean
  remaining: number
  resetIn: number
}

type HeaderCollection = Headers | Record<string, string | string[] | undefined>
type RequestWithHeaders = { headers: HeaderCollection }

function readHeader(headers: HeaderCollection, name: string) {
  if (headers instanceof Headers) return headers.get(name)
  const value = headers[name] ?? headers[name.toLowerCase()]
  return Array.isArray(value) ? value[0] : value || null
}

export function rateLimit(
  identifier: string,
  options: RateLimitOptions = { windowMs: 60_000, maxRequests: 60 }
): RateLimitResult {
  const now = Date.now()
  if (now - lastRateLimitSweepAt >= RATE_LIMIT_SWEEP_INTERVAL_MS || requests.size >= MAX_RATE_LIMIT_BUCKETS) {
    cleanupRateLimit(now)
    lastRateLimitSweepAt = now
  }
  const record = requests.get(identifier)

  if (!record || now > record.resetTime) {
    if (requests.size >= MAX_RATE_LIMIT_BUCKETS) {
      let earliestKey: string | null = null
      let earliestReset = Number.POSITIVE_INFINITY
      for (const [key, value] of requests) {
        if (value.resetTime < earliestReset) {
          earliestKey = key
          earliestReset = value.resetTime
        }
      }
      if (earliestKey) requests.delete(earliestKey)
    }
    requests.set(identifier, { count: 1, resetTime: now + options.windowMs })
    return { success: true, remaining: options.maxRequests - 1, resetIn: options.windowMs }
  }

  record.count++

  if (record.count > options.maxRequests) {
    return { success: false, remaining: 0, resetIn: record.resetTime - now }
  }

  return { success: true, remaining: options.maxRequests - record.count, resetIn: record.resetTime - now }
}

/** Очистка старых записей (вызывать периодически) */
export function cleanupRateLimit(now = Date.now()) {
  for (const [key, val] of requests.entries()) {
    if (now > val.resetTime) requests.delete(key)
  }
}

/**
 * Prefer the address normalized by the trusted reverse proxy.  Reading the
 * first X-Forwarded-For value first lets a client choose its own limiter key
 * by sending that header before Nginx appends the real remote address.
 */
export function getClientIp(request: RequestWithHeaders) {
  const realIp = readHeader(request.headers, "x-real-ip")?.trim()
  const forwarded = readHeader(request.headers, "x-forwarded-for")
  const candidate = realIp
    || forwarded?.split(",")[0]?.trim()
    || "unknown"
  return candidate.slice(0, 128)
}

/** Стандартные заголовки для ответа 429, чтобы клиент видел время повторной попытки. */
export function rateLimitHeaders(result: RateLimitResult) {
  return {
    "Retry-After": String(Math.max(1, Math.ceil(result.resetIn / 1000))),
    "X-RateLimit-Remaining": String(Math.max(0, result.remaining)),
  }
}
