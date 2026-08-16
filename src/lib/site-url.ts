// Keep a safe production canonical even in preview/runtime environments where
// SITE_URL was not injected. It prevents search engines from indexing a stale domain.
const DEFAULT_SITE_URL = "https://lewheel.ru"

export function getSiteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || DEFAULT_SITE_URL

  try {
    return new URL(configured).origin
  } catch {
    return DEFAULT_SITE_URL
  }
}

export function absoluteUrl(path = "/") {
  return new URL(path, `${getSiteUrl()}/`).toString()
}
