"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"

const VISITOR_KEY = "lewheel-analytics-visitor-v1"
const SESSION_KEY = "lewheel-analytics-session-v1"
const ATTRIBUTION_KEY = "lewheel-analytics-attribution-v1"

function storageValue(storage: Storage, key: string) {
  let value = storage.getItem(key)
  if (!value) {
    value = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
    storage.setItem(key, value)
  }
  return value
}

export default function AppAnalytics() {
  const pathname = usePathname()

  useEffect(() => {
    if (!pathname || typeof window === "undefined") return
    const marker = `automarket-visited:${pathname}`
    try {
      if (sessionStorage.getItem(marker)) return
      sessionStorage.setItem(marker, "1")
    } catch { /* Privacy modes may block session storage; server deduplication remains active. */ }
    let visitorKey: string | null = null
    let sessionKey: string | null = null
    try { visitorKey = storageValue(localStorage, VISITOR_KEY) } catch { /* Privacy modes may block persistent storage. */ }
    try { sessionKey = storageValue(sessionStorage, SESSION_KEY) } catch { /* The IP hash remains a privacy-safe fallback. */ }

    let attribution: { referer: string; utmSource: string; campaign: string } = { referer: "", utmSource: "", campaign: "" }
    try {
      const saved = sessionStorage.getItem(ATTRIBUTION_KEY)
      if (saved) attribution = JSON.parse(saved) as typeof attribution
      else {
        const query = new URLSearchParams(window.location.search)
        attribution = {
          referer: document.referrer || "",
          utmSource: query.get("utm_source") || "",
          campaign: query.get("utm_campaign") || "",
        }
        sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(attribution))
      }
    } catch { /* Attribution is optional and must never block navigation. */ }

    fetch("/api/analytics/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathname, visitorKey, sessionKey, ...attribution }),
      keepalive: true,
    }).catch(() => {})
  }, [pathname])

  return null
}
