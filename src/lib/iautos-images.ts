const IAUTOS_IMAGE_HOSTS = new Set(["qimg.iautos.cn", "s1.iautos.cn", "s2.iautos.cn", "s3.iautos.cn"])

function decodeIautosMarkup(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\\u002f/gi, "/")
    .replace(/\\\//g, "/")
}

export function extractIautosImages(html: string) {
  const candidates = decodeIautosMarkup(html).match(/(?:https?:)?\/\/(?:qimg|s[123])\.iautos\.cn\/[^\s"'<>\\)]+/gi) || []

  return [...new Set(candidates.flatMap((candidate) => {
    try {
      const decoded = candidate.replace(/[},;]+$/g, "")
      const url = new URL(decoded.startsWith("//") ? "https:" + decoded : decoded)
      if (url.protocol !== "https:" || !IAUTOS_IMAGE_HOSTS.has(url.hostname)) return []
      return /\.(?:jpe?g|png|webp)(?:-|$)/i.test(url.pathname) ? [url.toString()] : []
    } catch {
      return []
    }
  }))].slice(0, 60)
}
