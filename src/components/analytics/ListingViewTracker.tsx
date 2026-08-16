"use client"

import { useEffect } from "react"

export default function ListingViewTracker({ listingId, onCount }: { listingId?: string; onCount?: (views: number) => void }) {
  useEffect(() => {
    if (!listingId) return
    const controller = new AbortController()
    fetch(`/api/listings/${encodeURIComponent(listingId)}/views`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
      signal: controller.signal,
      keepalive: true,
    })
      .then((response) => response.ok ? response.json() as Promise<{ views?: number }> : null)
      .then((body) => {
        if (body && Number.isSafeInteger(body.views)) onCount?.(body.views as number)
      })
      .catch(() => undefined)
    return () => controller.abort()
  }, [listingId, onCount])

  return null
}
