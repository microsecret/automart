// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { normalizeNewsText } from "./news.ts"

export type NewsTelegramActionKind = "channel" | "vehicle-check"

export type NewsTelegramAction = {
  kind: NewsTelegramActionKind
  label: string
  url: string
}

export type NewsContentMetadata = {
  tags: string[]
  telegramActions: NewsTelegramAction[]
}

// Public vehicle-history chat configured by the companion news editor.
export const LEGACY_VEHICLE_CHECK_TELEGRAM_URL = "https://t.me/+9GvnXtkPb3wyMzRi"

const TELEGRAM_LINK_PATTERN = /<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
const SERVICE_LINE_PATTERN = /^(?:подписаться\s+на\s+канал|проверка\s+авто(?:мобиля)?|проверить\s+авто(?:мобиль)?)\s*[.!…]*$/i
const HASHTAG_ONLY_PATTERN = /^(?:#[\p{L}\p{N}_-]{2,64})(?:\s+#[\p{L}\p{N}_-]{2,64})*$/u

export function safeTelegramUrl(value: string) {
  try {
    const url = new URL(value.trim())
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "")
    if (url.protocol !== "https:" || !["t.me", "telegram.me"].includes(hostname) || url.username || url.password) return null
    if (!url.pathname || url.pathname === "/") return null
    return url.toString()
  } catch {
    return null
  }
}

function cleanLinkLabel(value: string) {
  return normalizeNewsText(value).replace(/\s+/g, " ").trim()
}

function actionKind(label: string): NewsTelegramActionKind | null {
  if (/провер(?:ка|ить).*авто/i.test(label)) return "vehicle-check"
  if (/подпис|канал|telegram|телеграм/i.test(label)) return "channel"
  return null
}

/** Extracts only explicitly allowed Telegram CTAs from trusted editorial markup. */
export function extractTelegramActions(value: string): NewsTelegramAction[] {
  const actions: NewsTelegramAction[] = []
  const seen = new Set<string>()

  for (const match of value.matchAll(TELEGRAM_LINK_PATTERN)) {
    const url = safeTelegramUrl(match[1])
    const label = cleanLinkLabel(match[2])
    const kind = actionKind(label)
    if (!url || !label || !kind || seen.has(url)) continue
    seen.add(url)
    actions.push({ kind, label, url })
  }

  return actions.slice(0, 4)
}

export function extractNewsHashtags(value: string, suppliedTags: string[] = []) {
  const result: string[] = []
  const seen = new Set<string>()
  const candidates = [...suppliedTags, ...Array.from(value.matchAll(/(?:^|\s)#([\p{L}\p{N}_-]{2,64})/gu), (match) => match[1])]

  for (const candidate of candidates) {
    const normalized = candidate.replace(/^#+/, "").trim()
    const key = normalized.toLocaleLowerCase("ru")
    if (!normalized || seen.has(key)) continue
    seen.add(key)
    result.push(normalized)
    if (result.length === 20) break
  }

  return result
}

const NEWS_TOPIC_TAGS: ReadonlyArray<readonly [RegExp, string]> = [
  [/(?:аукцион|торги|лот)\p{L}*/iu, "автоаукционы"],
  [/(?:кита[йяюе]|китайск)\p{L}*/iu, "автоизКитая"],
  [/(?:коре[яию]|корейск)\p{L}*/iu, "автоизКореи"],
  [/(?:япони[яию]|японск)\p{L}*/iu, "автоизЯпонии"],
  [/(?:электромобил|электрокар|зарядн)\p{L}*/iu, "электромобили"],
  [/(?:гибрид)\p{L}*/iu, "гибриды"],
  [/(?:импорт|ввоз|тамож|утильсбор)\p{L}*/iu, "импортАвто"],
  [/(?:цена|стоимост|подорож|скидк)\p{L}*/iu, "ценыНаАвто"],
  [/(?:дтп|авари|поврежден|страхов)\p{L}*/iu, "проверкаАвто"],
  [/(?:достав|логист|перевоз)\p{L}*/iu, "доставкаАвто"],
  [/(?:закон|штраф|гибдд|правил)\p{L}*/iu, "автозакон"],
  [/(?:рынок|продаж)\p{L}*/iu, "авторынок"],
]

export function inferNewsTags(title: string, content: string, suppliedTags: string[] = []) {
  const text = [title, content].join("\n").normalize("NFKC")
  const inferred = NEWS_TOPIC_TAGS.flatMap(([pattern, tag]) => pattern.test(text) ? [tag] : [])
  return extractNewsHashtags(content, [...suppliedTags, "автоновости", ...inferred]).slice(0, 12)
}

/** Removes transport-only CTA labels and standalone hashtag rows from article prose. */
export function cleanNewsArticleContent(value: string) {
  return normalizeNewsText(value)
    .split("\n")
    .map((line) => {
      const normalized = line.trim()
      return SERVICE_LINE_PATTERN.test(normalized) || HASHTAG_ONLY_PATTERN.test(normalized) ? "" : normalized
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

export function serializeNewsContentMetadata(tags: string[], telegramActions: NewsTelegramAction[]) {
  return JSON.stringify({ tags, telegramActions })
}

export function readNewsContentMetadata(value?: string | null): NewsContentMetadata {
  if (!value) return { tags: [], telegramActions: [] }

  try {
    const parsed: unknown = JSON.parse(value)
    if (Array.isArray(parsed)) {
      return { tags: extractNewsHashtags("", parsed.filter((tag): tag is string => typeof tag === "string")), telegramActions: [] }
    }
    if (!parsed || typeof parsed !== "object") return { tags: [], telegramActions: [] }

    const record = parsed as { tags?: unknown; telegramActions?: unknown }
    const tags = Array.isArray(record.tags)
      ? extractNewsHashtags("", record.tags.filter((tag): tag is string => typeof tag === "string"))
      : []
    const telegramActions = Array.isArray(record.telegramActions)
      ? record.telegramActions.flatMap((action): NewsTelegramAction[] => {
          if (!action || typeof action !== "object") return []
          const candidate = action as Partial<NewsTelegramAction>
          const url = typeof candidate.url === "string" ? safeTelegramUrl(candidate.url) : null
          if (!url || (candidate.kind !== "channel" && candidate.kind !== "vehicle-check")) return []
          const label = typeof candidate.label === "string" ? cleanLinkLabel(candidate.label) : ""
          return label ? [{ kind: candidate.kind, label, url }] : []
        }).slice(0, 4)
      : []

    return { tags, telegramActions }
  } catch {
    return { tags: [], telegramActions: [] }
  }
}
