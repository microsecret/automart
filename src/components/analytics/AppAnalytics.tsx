"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"

const SESSION_KEY = "automarket-analytics-session"

export default function AppAnalytics() {
  const pathname = usePathname()

  useEffect(() => {
    if (!pathname || typeof window === "undefined") return
    const marker = `automarket-visited:${pathname}`
    if (sessionStorage.getItem(marker)) return
    sessionStorage.setItem(marker, "1")
    let sessionKey = sessionStorage.getItem(SESSION_KEY)
    if (!sessionKey) {
      sessionKey = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
      sessionStorage.setItem(SESSION_KEY, sessionKey)
    }
    fetch("/api/analytics/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathname, sessionKey }),
      keepalive: true,
    }).catch(() => {})
  }, [pathname])

  return null
}
