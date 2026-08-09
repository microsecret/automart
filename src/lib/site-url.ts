const DEFAULT_SITE_URL = "https://avtorynok.ru"

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
