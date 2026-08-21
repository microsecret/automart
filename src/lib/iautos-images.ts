// Снимки лежат на qimg*.iautos.cn и на партнёрском CDN taocheche.
//
// Узлы s1/s2/s3.iautos.cn сюда не входят: они возвращают
// {"error":"Document not found"} — проверено, 404 на все 1475 ссылок,
// которые уже успели попасть в базу. Это не хранилище картинок, и такие
// адреса засоряли галерею битыми кадрами.
//
// static.iautos.cn тоже исключён: это вёрстка сайта — логотипы, иконки и
// заглушки, которым не место в галерее лота.
const IAUTOS_IMAGE_HOST = /^(?:qimg\d*\.iautos\.cn|img\d*\.taocheche\.com\.cn)$/i

function decodeIautosMarkup(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\\u002f/gi, "/")
    .replace(/\\\//g, "/")
}

export function extractIautosImages(html: string) {
  const candidates = decodeIautosMarkup(html).match(/(?:https?:)?\/\/(?:qimg\d*\.iautos\.cn|img\d*\.taocheche\.com\.cn)\/[^\s"'<>\\)]+/gi) || []

  return [...new Set(candidates.flatMap((candidate) => {
    try {
      const decoded = candidate.replace(/[},;]+$/g, "")
      const url = new URL(decoded.startsWith("//") ? "https:" + decoded : decoded)
      if (url.protocol !== "https:" || !IAUTOS_IMAGE_HOST.test(url.hostname)) return []
      return /\.(?:jpe?g|png|webp)(?:-|$)/i.test(url.pathname) ? [url.toString()] : []
    } catch {
      return []
    }
  }))].slice(0, 60)
}
