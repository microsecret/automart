const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
  х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
}

export type NewsLinkable = { id: string; slug?: string | null }

function decodeBasicHtml(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
}

/**
 * The Telegram editor publishes HTML. The marketplace deliberately stores a
 * text-only representation, so an imported post can never execute markup.
 */
export function normalizeNewsText(value: string) {
  return decodeBasicHtml(value || "")
    .replace(/<\/(?:p|div|li|h[1-6]|blockquote)>/gi, "\n")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\t\f\v ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

export function cleanNewsTitle(value: string) {
  return normalizeNewsText(value).replace(/\n+/g, " ").slice(0, 160).trim()
}

export function makeExcerpt(value: string, limit = 240) {
  const normalized = normalizeNewsText(value).replace(/\s+/g, " ")
  if (normalized.length <= limit) return normalized
  const clipped = normalized.slice(0, limit + 1)
  const lastSpace = clipped.lastIndexOf(" ")
  return `${clipped.slice(0, lastSpace > limit * 0.6 ? lastSpace : limit).trimEnd()}…`
}

export function makeSeoDescription(value: string) {
  return makeExcerpt(value, 155)
}

export function slugify(value: string) {
  const transliterated = value
    .toLowerCase()
    .split("")
    .map((char) => CYRILLIC_TO_LATIN[char] ?? char)
    .join("")

  return transliterated
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "")
}

export function makeImportedNewsSlug(title: string, sourceArticleId: string) {
  const base = slugify(title) || "avtonovost"
  const suffix = sourceArticleId.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(-24) || "post"
  return `${base}-${suffix}`.slice(0, 110).replace(/-+$/g, "")
}

export function newsHref(news: NewsLinkable) {
  return `/news/${news.slug || news.id}`
}
