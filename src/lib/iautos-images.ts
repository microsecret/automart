// Источник раздаёт снимки с пронумерованных узлов: у одной карточки двадцать
// семь ссылок на qimg6 и лишь одна на qimg. Жёсткий список пропускал только
// старое имя, поэтому лоты сохранялись вообще без фотографий.
const IAUTOS_IMAGE_HOST = /^(?:qimg\d*|s\d+)\.iautos\.cn$/i

function decodeIautosMarkup(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\\u002f/gi, "/")
    .replace(/\\\//g, "/")
}

export function extractIautosImages(html: string) {
  const candidates = decodeIautosMarkup(html).match(/(?:https?:)?\/\/(?:qimg\d*|s\d+)\.iautos\.cn\/[^\s"'<>\\)]+/gi) || []

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
