import { normalizeAuctionImportItem } from "@/lib/auction-import-validation"
import { saveAuctionImportItems } from "@/lib/auction-import"
import { confirmAuctionListingsMissing, confirmMissingFromCompleteSnapshot } from "@/lib/auction-source-freshness"
import { isAuctionSource } from "@/lib/auction-sources"
import { authorizedSourceGet } from "@/lib/authorized-source-http"

const MAX_FEEDS = 30
const MAX_ITEMS_PER_PULL = 500
const MAX_REMOVED_IDS_PER_PULL = 5_000

export type PartnerFeedConfig = {
  source: string
  url: string
  tokenEnv: string | null
  completeSnapshot: boolean
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null
}

export function configuredPartnerAuctionFeeds(): PartnerFeedConfig[] {
  const raw = process.env.AUCTION_PARTNER_FEEDS_JSON?.trim()
  if (!raw) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error("AUCTION_PARTNER_FEEDS_JSON содержит некорректный JSON")
  }
  if (!Array.isArray(parsed) || parsed.length > MAX_FEEDS) throw new Error(`Допускается не более ${MAX_FEEDS} партнёрских feeds`)
  const seen = new Set<string>()
  return parsed.map((entry, index) => {
    const value = asRecord(entry)
    const source = typeof value?.source === "string" ? value.source.trim().toUpperCase() : ""
    const rawUrl = typeof value?.url === "string" ? value.url.trim() : ""
    const tokenEnv = typeof value?.tokenEnv === "string" && value.tokenEnv.trim() ? value.tokenEnv.trim() : null
    if (!isAuctionSource(source)) throw new Error(`Feed ${index + 1}: неизвестная площадка`)
    if (seen.has(source)) throw new Error(`Feed ${index + 1}: площадка ${source} настроена повторно`)
    seen.add(source)
    let url: URL
    try {
      url = new URL(rawUrl)
    } catch {
      throw new Error(`Feed ${index + 1}: некорректный URL`)
    }
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password) throw new Error(`Feed ${index + 1}: нужен HTTPS URL без встроенной авторизации`)
    if (tokenEnv && !/^[A-Z][A-Z0-9_]{2,80}$/.test(tokenEnv)) throw new Error(`Feed ${index + 1}: некорректное имя переменной токена`)
    return { source, url: url.toString(), tokenEnv, completeSnapshot: value?.completeSnapshot === true }
  })
}

export async function pullPartnerAuctionFeed(config: PartnerFeedConfig) {
  const url = new URL(config.url)
  const token = config.tokenEnv ? process.env[config.tokenEnv]?.trim() : null
  if (config.tokenEnv && !token) throw new Error(`Для ${config.source} не настроен ${config.tokenEnv}`)
  const response = await authorizedSourceGet(config.url, {
    allowedHosts: new Set([url.hostname]),
    headers: {
      Accept: "application/json",
      "User-Agent": "LeWheel-Authorized-Importer/1.0 (+https://lewheel.ru)",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    timeoutMs: 30_000,
    maxBytes: 25 * 1024 * 1024,
  })
  const text = await response.text()
  if (!response.ok) throw new Error(`${config.source} feed вернул HTTP ${response.status}`)
  let payload: unknown
  try {
    payload = JSON.parse(text)
  } catch {
    throw new Error(`${config.source} feed вернул некорректный JSON`)
  }
  const data = asRecord(payload)
  const rawItems = Array.isArray(data?.items) ? data.items : null
  if (!rawItems || rawItems.length > MAX_ITEMS_PER_PULL) throw new Error(`${config.source} feed должен вернуть массив items до ${MAX_ITEMS_PER_PULL} записей`)
  const items = rawItems.map(normalizeAuctionImportItem)
  if (items.some((item) => item.source !== config.source)) throw new Error(`${config.source} feed содержит лоты другой площадки`)

  const rawRemovedIds = Array.isArray(data?.removedSourceIds) ? data.removedSourceIds : []
  if (rawRemovedIds.length > MAX_REMOVED_IDS_PER_PULL) throw new Error(`${config.source} feed вернул слишком много удалённых ID`)
  const removedSourceIds = rawRemovedIds.flatMap((value) => {
    const id = typeof value === "string" || typeof value === "number" ? String(value).trim() : ""
    return id && id.length <= 120 ? [id] : []
  })

  const saved = items.length ? await saveAuctionImportItems(items) : { created: 0, updated: 0, translated: 0 }
  const missing = config.completeSnapshot && data?.completeSnapshot === true
    ? await confirmMissingFromCompleteSnapshot(config.source, items.map((item) => item.sourceId))
    : await confirmAuctionListingsMissing(config.source, removedSourceIds)
  return { imported: items.length, removedReported: removedSourceIds.length, ...saved, ...missing }
}
