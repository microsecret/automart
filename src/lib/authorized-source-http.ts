import https from "node:https"
import type { IncomingHttpHeaders } from "node:http"
import { HttpsProxyAgent } from "https-proxy-agent"

const HARD_PROXY_TCP_CAP = 50
const DEFAULT_PROXY_TCP_CAP = 4
const DIRECT_TCP_CAP = 4
const MAX_REDIRECTS = 2
const PROXY_FAILURE_THRESHOLD = 2
const PROXY_QUARANTINE_MS = 5 * 60_000

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
const proxyHealth = new WeakMap<https.Agent, { failures: number; retryAfter: number }>()

function proxyAgents() {
  const source = process.env.AUCTION_PROXY_POOL?.trim() || ""
  const cap = boundedProxyCap(process.env.AUCTION_PROXY_MAX_CONNECTIONS)
  if (cachedProxyPool?.source === source && cachedProxyPool.cap === cap) return cachedProxyPool.agents
  const agents = configuredProxyEndpoints().map((endpoint) => {
    const agent = connectProxyAgent(endpoint, cap)
    proxyHealth.set(agent, { failures: 0, retryAfter: 0 })
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
  const start = stableStartIndex(hostname, agents.length)
  const ordered = [...agents.slice(start), ...agents.slice(0, start)]
  const available = ordered.filter((agent) => (proxyHealth.get(agent)?.retryAfter || 0) <= Date.now())
  if (available.length) return available
  return ordered.sort((left, right) => (proxyHealth.get(left)?.retryAfter || 0) - (proxyHealth.get(right)?.retryAfter || 0)).slice(0, 1)
}

function markProxySuccess(agent: https.Agent) {
  if (agent !== directAgent) proxyHealth.set(agent, { failures: 0, retryAfter: 0 })
}

function markProxyFailure(agent: https.Agent) {
  if (agent === directAgent) return
  const current = proxyHealth.get(agent) || { failures: 0, retryAfter: 0 }
  const failures = current.failures + 1
  proxyHealth.set(agent, {
    failures,
    retryAfter: failures >= PROXY_FAILURE_THRESHOLD ? Date.now() + PROXY_QUARANTINE_MS : 0,
  })
}

function requestTextOnce(url: URL, agent: https.Agent, headers: Record<string, string>, timeoutMs: number, maxBytes: number) {
  return new Promise<{ status: number; headers: IncomingHttpHeaders; body: string }>((resolve, reject) => {
    const request = https.request(url, { method: "GET", agent, headers }, (response) => {
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
      response.once("end", () => resolve({
        status: response.statusCode || 0,
        headers: response.headers,
        body: Buffer.concat(chunks).toString("utf8"),
      }))
    })
    request.setTimeout(timeoutMs, () => request.destroy(new Error("Источник не ответил вовремя")))
    request.once("error", reject)
    request.end()
  })
}

async function requestWithRedirects(rawUrl: URL, agent: https.Agent, allowedHosts: ReadonlySet<string>, headers: Record<string, string>, timeoutMs: number, maxBytes: number) {
  let url = rawUrl
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    if (url.protocol !== "https:" || !allowedHosts.has(url.hostname)) throw new Error("Источник перенаправил запрос на неподдерживаемый адрес")
    const result = await requestTextOnce(url, agent, headers, timeoutMs, maxBytes)
    const location = result.headers.location
    if (result.status < 300 || result.status >= 400 || !location) return { ...result, url: url.toString() }
    url = new URL(location, url)
  }
  throw new Error("Источник превысил допустимое число перенаправлений")
}

export async function authorizedSourceGet(rawUrl: string, options: {
  allowedHosts: ReadonlySet<string>
  headers: Record<string, string>
  timeoutMs: number
  maxBytes: number
}): Promise<SourceResponse> {
  const url = new URL(rawUrl)
  let lastError: unknown = null
  for (const agent of transportCandidates(url.hostname)) {
    try {
      const response = await requestWithRedirects(url, agent, options.allowedHosts, options.headers, options.timeoutMs, options.maxBytes)
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
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Не удалось получить страницу источника")
}

export function sourceProxyPoolStatus() {
  try {
    const agents = proxyAgents()
    const quarantined = agents.filter((agent) => (proxyHealth.get(agent)?.retryAfter || 0) > Date.now()).length
    return {
      configured: agents.length,
      active: agents.length - quarantined,
      quarantined,
      maxConnectionsPerProxy: boundedProxyCap(process.env.AUCTION_PROXY_MAX_CONNECTIONS),
      hardLimit: HARD_PROXY_TCP_CAP,
      configurationValid: true,
    }
  } catch {
    return {
      configured: 0,
      active: 0,
      quarantined: 0,
      maxConnectionsPerProxy: boundedProxyCap(process.env.AUCTION_PROXY_MAX_CONNECTIONS),
      hardLimit: HARD_PROXY_TCP_CAP,
      configurationValid: false,
    }
  }
}
