/**
 * In-memory rate limiter.
 *
 * Приложение обслуживается одним процессом Next.js за Nginx, поэтому счётчики
 * в памяти видят все запросы и общий Redis не добавил бы защиты — только
 * внешнюю зависимость, отказ которой пришлось бы обрабатывать в каждом
 * маршруте. Распределённое хранилище понадобится при переходе на несколько
 * экземпляров приложения; до этого момента ограничение живёт здесь.
 *
 * Известное ограничение: перезапуск сервиса обнуляет окна, поэтому подряд
 * идущие деплои дают короткий период с обнулёнными счётчиками. Стоимость
 * проверки пароля задаётся bcrypt и не зависит от лимитера, так что перебор
 * остаётся дорогим и в этот момент.
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
      /* Вытесняем пачкой, а не по одному.

         Здесь шёл полный перебор карты ради самой старой записи — и
         так на каждую новую запись после заполнения. Ровно в тот
         момент, когда лимитер нужен больше всего (перебор адресов
         забивает карту), он сам начинал стоить десять тысяч сравнений
         на запрос и превращался в то узкое место, от которого должен
         защищать.

         Map в JavaScript хранит ключи в порядке вставки, поэтому
         первые в обходе — самые давние. Снимаем десятую часть разом:
         следующие тысяча записей укладываются без единого перебора. */
      const evictCount = Math.max(1, Math.floor(MAX_RATE_LIMIT_BUCKETS / 10))
      let evicted = 0
      for (const key of requests.keys()) {
        requests.delete(key)
        evicted += 1
        if (evicted >= evictCount) break
      }
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
