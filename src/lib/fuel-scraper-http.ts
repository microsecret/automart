import https from "node:https"
import zlib from "node:zlib"
import type { IncomingHttpHeaders } from "node:http"
import { HttpsProxyAgent } from "https-proxy-agent"
import { randomUserAgent } from "@/lib/user-agents"

/**
 * Исходящие запросы скрейпера АЗС через пул HTTP CONNECT-прокси.
 *
 * Источники (ГдеБЕНЗ и другие) закрыты DDoS-Guard и следят за частотой
 * обращений с одного адреса. Запросы идут через общий пул прокси с
 * ротацией: каждый адрес перезагружается раз в две минуты, на смену IP
 * приходится обрыв в несколько секунд. Поэтому соединения не держатся
 * keep-alive, а при сбое делается пауза и повтор с другого адреса.
 */

type ProxyEndpoint = {
  host: string
  port: number
  username: string
  password: string
}

export type ScraperHttpResponse = {
  status: number
  ok: boolean
  headers: IncomingHttpHeaders
  text: string
}

const DEFAULT_TIMEOUT_MS = 25_000
/* Потолок ответа — 4 МБ вместо восьми.

   Самая большая выдача источника весит 171 КБ распакованными (12-15 КБ по
   проводу со сжатием), так что запас четырёхкратный даже для всего
   региона разом. Восемь мегабайт означали бы, что источник отдал не
   справочник, а файл — картинку или архив: такой ответ надо оборвать, а
   не выкачивать через прокси с лимитом в пятьдесят соединений. */
const MAX_BYTES = 4 * 1024 * 1024
/* Провайдер ограничивает каждого клиента пятьюдесятью TCP-соединениями.
   Скрейсеру столько не нужно: два-три параллельных запроса закрывают
   любой город, а запас остаётся под смену IP при перезагрузке прокси. */
const DEFAULT_CONNECTION_CAP = 2
const HARD_CONNECTION_CAP = 8
/* После неудачного соединения адрес уходит в карантин: он, скорее всего,
   перезагружается и сменит IP, а повтор сразу же упрётся в тот же обрыв. */
const PROXY_QUARANTINE_MS = 15_000
const MAX_RETRIES_PER_REQUEST = 4

/* Пауза при исчерпании лимита соединений.

   Провайдер даёт пятьдесят TCP на клиента. Упёршись в потолок, прокси
   перестаёт работать до тех пор, пока соединения не будут сброшены, и
   короткие повторы по десять секунд только держат счётчик занятым:
   скрейпер долбится, лимит не освобождается, прогон идёт вхолостую.

   Пять минут дают провайдеру закрыть повисшие сокеты по своему таймауту.
   Это дороже по времени, чем повтор, но дешевле, чем сорванный прогон и
   адрес, ушедший в блокировку. */
const CONNECTION_LIMIT_PAUSE_MS = 5 * 60_000

/* Ошибки, означающие «соединений больше нет», а не «сеть моргнула».

   ECONNRESET и EPIPE прокси отдаёт при обрыве на смене IP — это обычная
   перезагрузка, её лечит короткая пауза. А отказ в самом установлении
   соединения и таймаут на подключении означают, что лимит выбран. */
function isConnectionLimitError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const code = (error as NodeJS.ErrnoException).code || ""
  if (code === "ECONNREFUSED" || code === "EMFILE" || code === "ENFILE") return true
  const message = error.message.toLowerCase()
  return message.includes("socket hang up")
    || message.includes("too many")
    || message.includes("429")
    || message.includes("proxy connection ended")
}

function parseProxyEntry(rawEntry: string, index: number): ProxyEndpoint {
  const entry = rawEntry.trim()
  if (!entry) throw new Error(`Пустая запись прокси №${index + 1}`)

  const [host, portText, username, ...passwordParts] = entry.split(":")
  const port = Number(portText)
  const password = passwordParts.join(":")
  if (!host || /\s/.test(host) || !Number.isInteger(port) || port < 1 || port > 65_535 || !username || !password) {
    throw new Error(`Прокси №${index + 1} должен иметь формат host:port:user:password`)
  }
  return { host, port, username, password }
}

function configuredProxyEndpoints(): ProxyEndpoint[] {
  const raw = process.env.FUEL_SCRAPER_PROXY_POOL?.trim()
  if (!raw) return []
  return raw.split(/[\n,;]+/).filter(Boolean).map(parseProxyEntry)
}

function connectionCap() {
  const parsed = Number(process.env.FUEL_SCRAPER_MAX_CONNECTIONS)
  return Number.isInteger(parsed) ? Math.min(Math.max(parsed, 1), HARD_CONNECTION_CAP) : DEFAULT_CONNECTION_CAP
}

function buildAgent(proxy: ProxyEndpoint) {
  const proxyUrl = new URL("http://proxy.invalid")
  proxyUrl.hostname = proxy.host
  proxyUrl.port = String(proxy.port)
  proxyUrl.username = proxy.username
  proxyUrl.password = proxy.password
  return new HttpsProxyAgent(proxyUrl, {
    /* Без keep-alive: прокси перезагружается каждые две минуты, и
       удержанный сокет всё равно оборвётся. Свежее соединение на каждый
       запрос чуть медленнее, но не требует пересоздания после обрыва. */
    keepAlive: false,
    maxSockets: connectionCap(),
    maxTotalSockets: connectionCap(),
    timeout: DEFAULT_TIMEOUT_MS,
  })
}

type AgentState = {
  agent: https.Agent
  quarantinedUntil: number
  failures: number
}

let cachedPool: { source: string; states: AgentState[] } | null = null

function agentStates(): AgentState[] {
  const source = process.env.FUEL_SCRAPER_PROXY_POOL?.trim() || ""
  if (cachedPool?.source === source) return cachedPool.states
  const states = configuredProxyEndpoints().map((proxy) => ({
    agent: buildAgent(proxy),
    quarantinedUntil: 0,
    failures: 0,
  }))
  cachedPool = { source, states }
  return states
}

/**
 * Полное пересоздание пула прокси.
 *
 * Провайдер сбрасывает TCP только вместе с подключением: удержанные
 * агентом сокеты он считает занятыми, пока они не отвалятся по таймауту.
 * Пересоздание рвёт их со своей стороны и возвращает лимит.
 */
export function resetProxyPool() {
  if (!cachedPool) return
  for (const state of cachedPool.states) {
    try {
      state.agent.destroy()
    } catch {
      /* Агент мог уже быть разрушен обрывом — это не мешает пересозданию. */
    }
  }
  cachedPool = null
}

function directAgent(): https.Agent {
  return new https.Agent({ keepAlive: false })
}

function markFailure(state: AgentState) {
  state.failures += 1
  /* Экспоненциальная пауза: одна неудача — пятнадцать секунд, три —
     минута. Скрейсер переключается на другой адрес и возвращается к
     этому только после смены IP. */
  state.quarantinedUntil = Date.now() + PROXY_QUARANTINE_MS * 2 ** Math.min(state.failures - 1, 3)
}

function markSuccess(state: AgentState) {
  state.failures = 0
  state.quarantinedUntil = 0
}

function candidateAgents() {
  const states = agentStates()
  const now = Date.now()
  const available = states.filter((state) => state.quarantinedUntil <= now)
  const ordered = [...available].sort((left, right) => left.failures - right.failures)
  /* Прокси — основной маршрут, но без прямого запасного хода одна
     неудачная перезагрузка пула оставила бы сборщик без данных на
     минуту. Прямое соединение идёт последним. */
  return [...ordered.map((state) => state.agent), directAgent()]
}

function performRequestOnce(
  url: URL,
  agent: https.Agent,
  method: "GET",
  headers: Record<string, string>,
  timeoutMs: number,
): Promise<ScraperHttpResponse> {
  return new Promise((resolve, reject) => {
    const request = https.request(url, { method, agent, headers, family: 4 }, (response) => {
      /* Медиа обрывается на первом же байте.

         Скрейпер ходит только за JSON и HTML, но источник вправе ответить
         чем угодно — редиректом на картинку, страницей-заглушкой с
         тяжёлым содержимым. Выкачивать это через прокси с лимитом
         соединений незачем: соединение занято, польза нулевая. */
      const contentType = String(response.headers["content-type"] || "").toLowerCase()
      if (contentType && /^(image|video|audio|font)\//.test(contentType)) {
        request.destroy(new Error(`Источник ответил медиафайлом (${contentType})`))
        return
      }

      const chunks: Buffer[] = []
      let size = 0
      response.on("data", (chunk: Buffer) => {
        size += chunk.length
        if (size > MAX_BYTES) {
          request.destroy(new Error("Ответ источника превышает допустимый размер"))
          return
        }
        chunks.push(chunk)
      })
      response.once("end", () => {
        clearTimeout(deadline)
        const status = response.statusCode || 0
        const raw = Buffer.concat(chunks)
        /* Ответ распаковывается здесь, а не в вызывающем коде: сжатие
           запрашивается ради скорости освобождения сокета, и знать про
           него должен только транспорт. Битую упаковку не прячем —
           сломанный ответ честнее молча отданного мусора. */
        let text: string
        try {
          const encoding = String(response.headers["content-encoding"] || "").toLowerCase()
          const decoded = encoding === "gzip"
            ? zlib.gunzipSync(raw)
            : encoding === "deflate"
              ? zlib.inflateSync(raw)
              : raw
          text = decoded.toString("utf8")
        } catch (error) {
          reject(error instanceof Error ? error : new Error("Не удалось распаковать ответ источника"))
          return
        }
        resolve({
          status,
          /* Успех — это 2xx: без этого поля вызывающий не отличал бы
             отданную страницу от ответа «доступ запрещён». */
          ok: status >= 200 && status < 300,
          headers: response.headers,
          text,
        })
      })
    })
    const deadline = setTimeout(() => request.destroy(new Error("Источник не ответил вовремя")), timeoutMs)
    request.setTimeout(timeoutMs, () => request.destroy(new Error("Источник не ответил вовремя")))
    request.once("error", (error) => {
      clearTimeout(deadline)
      reject(error)
    })
    request.end()
  })
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * GET-запрос текста через прокси-пул с повторами.
 *
 * Каждый повтор идёт через другой адрес, а перед повтором выдерживается
 * короткая пауза — провайдер просит десять-пятнадцать секунд, чтобы
 * сбросить счётчик соединений после обрыва.
 */
export async function scraperGetText(
  url: string,
  options: { headers?: Record<string, string>; timeoutMs?: number; pauseMs?: number } = {},
): Promise<ScraperHttpResponse> {
  const target = new URL(url)
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  /* Провайдер просит сбрасывать TCP полным пересозданием подключения с
     паузой 10-15 секунд. Меньше не ставим, даже если вызывающий передал
     короче: иначе счётчик соединений не успеет обнулиться. */
  const pauseMs = Math.max(10_000, options.pauseMs ?? 12_000)
  const baseHeaders = {
    /* Только текст: звёздочка в конце прежнего Accept разрешала источнику отдать что угодно,
       вплоть до картинки. Скрейперу нужны JSON и HTML, а каждая лишняя
       мегабайтная выдача — это занятое TCP-соединение из пятидесяти,
       отпущенных провайдером на всего клиента. */
    Accept: "application/json,text/plain,text/html;q=0.9",
    "Accept-Language": "ru-RU,ru;q=0.9",
    /* Сжатие уменьшает время удержания сокета: ответ в 7 МБ едет
       считанные секунды вместо десятков, и соединение освобождается
       раньше. */
    "Accept-Encoding": "gzip, deflate",
    /* Соединение закрывается сразу после ответа.

       Прокси перезагружается каждые две минуты, и удержанный сокет всё
       равно оборвётся — но до обрыва он числится занятым у провайдера и
       съедает лимит. Явное закрытие возвращает соединение в пул сразу. */
    Connection: "close",
    Referer: "https://gdebenz.ru/",
    ...options.headers,
  }

  const agents = candidateAgents()
  let lastError: unknown

  for (let attempt = 0; attempt <= MAX_RETRIES_PER_REQUEST; attempt += 1) {
    const agent = agents[Math.min(attempt, agents.length - 1)]
    const state = agentStates().find((entry) => entry.agent === agent)
    /* Каждый повтор — новый User-Agent: один и тот же адрес с разными
       агентами выглядит как разные устройства, а не как робот с одной
       подписью. */
    const headers = { ...baseHeaders, "User-Agent": randomUserAgent() }
    try {
      const result = await performRequestOnce(target, agent, "GET", headers, timeoutMs)
      if (state) markSuccess(state)
      return result
    } catch (error) {
      lastError = error
      if (state) markFailure(state)
      if (attempt < MAX_RETRIES_PER_REQUEST) {
        /* Исчерпанный лимит лечится не повтором, а ожиданием: короткие
           попытки держат счётчик соединений занятым, и прокси не оживает.
           Обычный обрыв на смене IP — наоборот, проходит за секунды. */
        const limitReached = isConnectionLimitError(error)
        if (limitReached) {
          console.warn("Fuel scraper: лимит соединений прокси исчерпан, пауза 5 минут")
          /* Пул пересоздаётся: агенты держат сокеты, которые провайдер
             уже считает мёртвыми, и повтор на том же агенте упрётся в них
             снова. Полное пересоздание — то, что провайдер и просит. */
          resetProxyPool()
        }
        await sleep(limitReached ? CONNECTION_LIMIT_PAUSE_MS : pauseMs)
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Не удалось получить ответ источника")
}
