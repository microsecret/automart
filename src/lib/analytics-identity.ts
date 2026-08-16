import crypto from "node:crypto"

const AUTOMATED_USER_AGENT = /(?:bot|crawler|spider|slurp|headless|lighthouse|pagespeed|monitoring|uptime|preview|facebookexternalhit|telegrambot)/i

export type AnonymousTrafficIdentity = {
  ipHash: string | null
  visitorKey?: string | null
  sessionKey?: string | null
}

export function isAutomatedUserAgent(userAgent: string) {
  return !userAgent || AUTOMATED_USER_AGENT.test(userAgent)
}

export function hashAnalyticsIp(value: string) {
  const salt = process.env.ANALYTICS_HASH_SALT || process.env.NEXTAUTH_SECRET || "local-analytics-salt"
  return crypto.createHash("sha256").update(`${salt}:${value}`).digest("hex")
}

/**
 * Product reporting defines one anonymous visitor as one privacy-safe IP hash.
 * Browser and session keys only preserve comparability for legacy events that
 * were recorded before an IP hash was available.
 */
export function trafficVisitorIdentity(event: AnonymousTrafficIdentity) {
  if (event.ipHash) return `ip:${event.ipHash}`
  if (event.visitorKey) return `legacy-browser:${event.visitorKey}`
  return event.sessionKey ? `legacy-session:${event.sessionKey}` : null
}

export function percentageChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : 100
  return Math.round(((current - previous) / previous) * 1_000) / 10
}
