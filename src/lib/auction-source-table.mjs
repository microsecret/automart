/**
 * Decode the small, stable subset of HTML entities used in source vehicle
 * specification tables. Keeping this parser dependency-free lets collectors
 * process pages without constructing a browser DOM on the server.
 */
export function decodeAuctionSourceHtml(value) {
  return String(value ?? "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
}

export function auctionSourceHtmlText(value) {
  if (!value) return null
  return decodeAuctionSourceHtml(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .trim() || null
}

/**
 * Extract th/td pairs without allowing a failed heading to consume the next
 * heading. BE FORWARD places an HTML comment between some <th> and <td>
 * elements; a simple `</th>\s*<td>` expression skipped that cell and then
 * backtracked through the following <th>, merging both labels.
 */
export function auctionSourceTablePairs(html) {
  const result = new Map()
  const pairPattern = /<th\b[^>]*>((?:(?!<\/th>)[\s\S])*)<\/th>(?:(?!<th\b)[\s\S])*?<td\b[^>]*>((?:(?!<\/td>)[\s\S])*)<\/td>/gi

  for (const match of String(html ?? "").matchAll(pairPattern)) {
    const key = auctionSourceHtmlText(match[1])
    const value = auctionSourceHtmlText(match[2])
    if (key && value) result.set(key, value)
  }
  return result
}
