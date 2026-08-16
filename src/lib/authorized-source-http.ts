import https from "node:https"
import type { IncomingHttpHeaders } from "node:http"
import { HttpsProxyAgent } from "https-proxy-agent"

const HARD_PROXY_TCP_CAP = 50
const DEFAULT_PROXY_TCP_CAP = 4
const DIRECT_TCP_CAP = 4
const MAX_REDIRECTS = 2
const PROXY_FAILURE_THRESHOLD = 2
const PROXY_QUARANTINE_MS = 5 * 60_000
const MAX_PROXY_QUARANTINE_MS = 30 * 60_000
const RETRYABLE_SOURCE_STATUSES = new Set([403, 407, 408, 425, 429, 500, 502, 503, 504])

type ProxyEndpoint = {
  host: string
  port: number
  username: string
  password: string
}

type SourceResponse = {
  status: number
  ok: boolean
  url: string
  text: () => Promise<string>
}

type ProxyHealth = {
  activeRequests: number
  failures: number
  retryAfter: number
  completedRequests: number
}

function boundedProxyCap(value: string | undefined) {
  const parsed = Number(value)
  return Number.isInteger(parsed) ? Math.min(Math.max(parsed, 1), HARD_PROXY_TCP_CAP) : DEFAULT_PROXY_TCP_CAP
}

function parseProxyEntry(rawEntry: string, index: number): ProxyEndpoint {
  const entry = rawEntry.trim()
  if (!entry) throw new Error(`Пустая запись прокси №${index + 1}`)

  if (/^https?:\/\//i.test(entry)) {
    const url = new URL(entry)
    if (url.protocol !== "http:" || !url.hostname || !url.port || !url.username || !url.password) {
      throw new Error(`Прокси №${index + 1} должен быть HTTP CONNECT с авторизацией`)
    }
    return {
      host: url.hostname,
      port: Number(url.port),
      username: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
    }
  }

  const [host, portText, username, ...passwordParts] = entry.split(":")
  const port = Number(portText)
  const password = passwordParts.join(":")
  if (!host || /\s/.test(host) || !Number.isInteger(port) || port < 1 || port > 65_535 || !username || !password) {
    throw new Error(`Прокси №${index + 1} должен иметь формат host:port:user:password`)
  }
  return { host, port, username, password }
}

function configuredProxyEndpoints() {
  const raw = process.env.AUCTION_PROXY_POOL?.trim()
  if (!raw) return []
  return raw.split(/[\n,;]+/).filter(Boolean).map(parseProxyEntry)
}

function connectProxyAgent(proxy: ProxyEndpoint, maxSockets: number) {
  const proxyUrl = new URL("http://proxy.invalid")
  proxyUrl.hostname = proxy.host
  proxyUrl.port = String(proxy.port)
  proxyUrl.username = proxy.username
  proxyUrl.password = proxy.password
  return new HttpsProxyAgent(proxyUrl, {
    keepAlive: true,
    maxSockets,
    maxTotalSockets: maxSockets,
    maxFreeSockets: Math.min(maxSockets, 2),
    timeout: 30_000,
  })
}

const directAgent = new https.Agent({ keepAlive: true, maxSockets: DIRECT_TCP_CAP, maxTotalSockets: DIRECT_TCP_CAP, maxFreeSockets: 2 })
let cachedProxyPool: { source: string; cap: number; agents: https.Agent[] } | null = null
const proxyHealth = new WeakMap<https.Agent, ProxyHealth>()
const hostRotation = new Map<string, number>()

function initialProxyHealth(): ProxyHealth {
  return { activeRequests: 0, failures: 0, retryAfter: 0, completedRequests: 0 }
}

function proxyAgents() {
  const source = process.env.AUCTION_PROXY_POOL?.trim() || ""
  const cap = boundedProxyCap(process.env.AUCTION_PROXY_MAX_CONNECTIONS)
  if (cachedProxyPool?.source === source && cachedProxyPool.cap === cap) return cachedProxyPool.agents
  const agents = configuredProxyEndpoints().map((endpoint) => {
    const agent = connectProxyAgent(endpoint, cap)
    proxyHealth.set(agent, initialProxyHealth())
    return agent
  })
  cachedProxyPool = { source, cap, agents }
  return agents
}

function stableStartIndex(hostname: string, length: number) {
  if (length < 2) return 0
  let hash = 0
  for (const character of hostname) hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  return hash % length
}

function transportCandidates(hostname: string) {
  const agents = proxyAgents()
  if (!agents.length) return [directAgent]
  const rotation = hostRotation.get(hostname) || 0
  hostRotation.set(hostname, (rotation + 1) % agents.length)
  const start = (stableStartIndex(hostname, agents.length) + rotation) % agents.length
  const ordered = [...agents.slice(start), ...agents.slice(0, start)]
  const available = ordered.filter((agent) => (proxyHealth.get(agent)?.retryAfter || 0) <= Date.now())
  if (available.length) {
    const proxyCandidates = available
      .map((agent, index) => ({ agent, index, activeRequests: proxyHealth.get(agent)?.activeRequests || 0 }))
      .sort((left, right) => left.activeRequests - right.activeRequests || left.index - right.index)
      .map(({ agent }) => agent)
    // Some public catalogues reject the shared proxy region even though the
    // same allow-listed URL is available from the application server. Keep a
    // single bounded direct attempt last so proxies remain the primary route
    // without turning a regional proxy error into an empty country catalogue.
    return [...proxyCandidates, directAgent]
  }
  return [
    ...ordered.sort((left, right) => (proxyHealth.get(left)?.retryAfter || 0) - (proxyHealth.get(right)?.retryAfter || 0)).slice(0, 1),
    directAgent,
  ]
}

function markProxySuccess(agent: https.Agent) {
  if (agent === directAgent) return
  const current = proxyHealth.get(agent) || initialProxyHealth()
  proxyHealth.set(agent, { ...current, failures: 0, retryAfter: 0, completedRequests: current.completedRequests + 1 })
}

function markProxyFailure(agent: https.Agent, retryAfterMs?: number) {
  if (agent === directAgent) return
  const current = proxyHealth.get(agent) || initialProxyHealth()
  const failures = current.failures + 1
  const exponentialDelay = Math.min(PROXY_QUARANTINE_MS * 2 ** Math.max(0, failures - PROXY_FAILURE_THRESHOLD), MAX_PROXY_QUARANTINE_MS)
  proxyHealth.set(agent, {
    ...current,
    failures,
    retryAfter: failures >= PROXY_FAILURE_THRESHOLD ? Date.now() + Math.max(retryAfterMs || 0, exponentialDelay) : 0,
  })
}

function updateActiveRequests(agent: https.Agent, delta: 1 | -1) {
  if (agent === directAgent) return
  const current = proxyHealth.get(agent) || initialProxyHealth()
  proxyHealth.set(agent, { ...current, activeRequests: Math.max(0, current.activeRequests + delta) })
}

function requestTextOnce(url: URL, agent: https.Agent, method: "GET" | "POST", headers: Record<string, string>, body: string | undefined, timeoutMs: number, maxBytes: number) {
  return new Promise<{ status: number; headers: IncomingHttpHeaders; body: string }>((resolve, reject) => {
    const requestHeaders = body === undefined ? headers : { ...headers, "Content-Length": String(Buffer.byteLength(body)) }
    // Several East-Asian catalogue hosts publish an unreachable AAAA record
    // from our production network. Explicit IPv4 keeps source checks bounded;
    // HTTP CONNECT proxies still resolve through their configured IPv4 host.
    const request = https.request(url, { method, agent, headers: requestHeaders, family: 4 }, (response) => {
      const chunks: Buffer[] = []
      let size = 0
      response.on("data", (chunk: Buffer) => {
        size += chunk.length
        if (size > maxBytes) {
          request.destroy(new Error("Ответ источника превышает допустимый размер"))
          return
        }
        chunks.push(chunk)
      })
      response.once("end", () => {
        clearTimeout(hardDeadline)
        resolve({
          status: response.statusCode || 0,
          headers: response.headers,
          body: Buffer.concat(chunks).toString("utf8"),
        })
      })
    })
    const hardDeadline = setTimeout(() => request.destroy(new Error("Источник превысил общий лимит времени")), timeoutMs)
    request.setTimeout(timeoutMs, () => request.destroy(new Error("Источник не ответил вовремя")))
    request.once("error", (error) => {
      clearTimeout(hardDeadline)
      reject(error)
    })
    request.end(body)
  })
}

async function requestWithRedirects(rawUrl: URL, agent: https.Agent, method: "GET" | "POST", allowedHosts: ReadonlySet<string>, headers: Record<string, string>, body: string | undefined, timeoutMs: number, maxBytes: number) {
  let url = rawUrl
  let currentMethod = method
  let currentBody = body
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    if (url.protocol !== "https:" || !allowedHosts.has(url.hostname)) throw new Error("Источник перенаправил запрос на неподдерживаемый адрес")
    const result = await requestTextOnce(url, agent, currentMethod, headers, currentBody, timeoutMs, maxBytes)
    const location = result.headers.location
    if (result.status < 300 || result.status >= 400 || !location) return { ...result, url: url.toString() }
    url = new URL(location, url)
    if (result.status === 303) {
      currentMethod = "GET"
      currentBody = undefined
    }
  }
  throw new Error("Источник превысил допустимое число перенаправлений")
}

function retryAfterMs(headers: IncomingHttpHeaders) {
  const value = headers["retry-after"]
  const raw = Array.isArray(value) ? value[0] : value
  if (!raw) return 0
  const seconds = Number(raw)
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000)
  const date = new Date(raw).getTime()
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : 0
}

export async function authorizedSourceRequest(rawUrl: string, options: {
  allowedHosts: ReadonlySet<string>
  headers: Record<string, string>
  method?: "GET" | "POST"
  body?: string
  timeoutMs: number
  maxBytes: number
}): Promise<SourceResponse> {
  const url = new URL(rawUrl)
  let lastError: unknown = null
  let lastResponse: Awaited<ReturnType<typeof requestWithRedirects>> | null = null
  for (const agent of transportCandidates(url.hostname)) {
    updateActiveRequests(agent, 1)
    try {
      const response = await requestWithRedirects(url, agent, options.method || "GET", options.allowedHosts, options.headers, options.body, options.timeoutMs, options.maxBytes)
      lastResponse = response
      if (agent !== directAgent && RETRYABLE_SOURCE_STATUSES.has(response.status)) {
        markProxyFailure(agent, retryAfterMs(response.headers))
        continue
      }
      markProxySuccess(agent)
      return {
        status: response.status,
        ok: response.status >= 200 && response.status < 300,
        url: response.url,
        text: async () => response.body,
      }
    } catch (error) {
      markProxyFailure(agent)
      lastError = error
    } finally {
      updateActiveRequests(agent, -1)
    }
  }
  if (lastResponse) {
    return {
      status: lastResponse.status,
      ok: lastResponse.status >= 200 && lastResponse.status < 300,
      url: lastResponse.url,
      text: async () => lastResponse.body,
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Не удалось получить страницу источника")
}

export function authorizedSourceGet(rawUrl: string, options: {
  allowedHosts: ReadonlySet<string>
  headers: Record<string, string>
  timeoutMs: number
  maxBytes: number
}) {
  return authorizedSourceRequest(rawUrl, { ...options, method: "GET" })
}

export function sourceProxyPoolStatus() {
  try {
    const agents = proxyAgents()
    const quarantined = agents.filter((agent) => (proxyHealth.get(agent)?.retryAfter || 0) > Date.now()).length
    const activeRequests = agents.reduce((total, agent) => total + (proxyHealth.get(agent)?.activeRequests || 0), 0)
    const completedRequests = agents.reduce((total, agent) => total + (proxyHealth.get(agent)?.completedRequests || 0), 0)
    return {
      configured: agents.length,
      active: agents.length - quarantined,
      quarantined,
      activeRequests,
      completedRequests,
      maxConnectionsPerProxy: boundedProxyCap(process.env.AUCTION_PROXY_MAX_CONNECTIONS),
      hardLimit: HARD_PROXY_TCP_CAP,
      configurationValid: true,
    }
  } catch {
    return {
      configured: 0,
      active: 0,
      quarantined: 0,
      activeRequests: 0,
      completedRequests: 0,
      maxConnectionsPerProxy: boundedProxyCap(process.env.AUCTION_PROXY_MAX_CONNECTIONS),
      hardLimit: HARD_PROXY_TCP_CAP,
      configurationValid: false,
    }
  }
}
