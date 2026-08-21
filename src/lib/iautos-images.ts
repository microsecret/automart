// Снимки лежат на двух узлах: iautos.cn отдаёт часть кадров, а основной
// массив — партнёрский CDN taocheche (сорок шесть ссылок против двадцати
// восьми у одной карточки). Пока в списке был только iautos.cn, лоты
// сохранялись почти без фотографий.
//
// static.iautos.cn сюда не входит намеренно: это вёрстка сайта — логотипы,
// иконки и заглушки, которым не место в галерее лота.
const IAUTOS_IMAGE_HOST = /^(?:(?:qimg\d*|s\d+)\.iautos\.cn|img\d*\.taocheche\.com\.cn)$/i

function decodeIautosMarkup(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\\u002f/gi, "/")
    .replace(/\\\//g, "/")
}

export function extractIautosImages(html: string) {
  const candidates = decodeIautosMarkup(html).match(/(?:https?:)?\/\/(?:(?:qimg\d*|s\d+)\.iautos\.cn|img\d*\.taocheche\.com\.cn)\/[^\s"'<>\\)]+/gi) || []

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
