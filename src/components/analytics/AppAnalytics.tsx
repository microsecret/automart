"use client"

import { useEffect } from "react"
import { usePathname, useSearchParams } from "next/navigation"

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
  /* Смена фильтров каталога меняет только строку запроса, а `usePathname`
     остаётся прежним: переход с «/auctions?country=JP» на «?country=KR» не
     вызывал эффект и в статистику не попадал. Замер по боевой базе показал
     ровно это — среди 1787 событий не было ни одного с «?».

     В базу по-прежнему уходит путь без запроса: топ разделов считается
     группировкой по нему, и с фильтрами он размазался бы на сотни строк.
     Строка запроса нужна здесь только чтобы отличить один экран от другого
     и отправить событие. */
  const searchParams = useSearchParams()
  const search = searchParams.toString()

  useEffect(() => {
    if (!pathname || typeof window === "undefined") return
    let visitorKey: string | null = null
    let sessionKey: string | null = null
    try { visitorKey = storageValue(localStorage, VISITOR_KEY) } catch { /* Privacy modes may block persistent storage. */ }
    try { sessionKey = storageValue(sessionStorage, SESSION_KEY) } catch { /* The IP hash remains a privacy-safe fallback. */ }

    let attribution: { referer: string; utmSource: string; campaign: string; campaignContent: string } = {
      referer: "", utmSource: "", campaign: "", campaignContent: "",
    }
    try {
      const saved = sessionStorage.getItem(ATTRIBUTION_KEY)
      if (saved) attribution = JSON.parse(saved) as typeof attribution
      else {
        const query = new URLSearchParams(window.location.search)
        attribution = {
          referer: document.referrer || "",
          utmSource: query.get("utm_source") || (pathname.startsWith("/telegram") ? "telegram-mini-app" : ""),
          campaign: query.get("utm_campaign") || (window.Telegram?.WebApp?.initDataUnsafe?.start_param ? "telegram_mini_app" : ""),
          campaignContent: query.get("utm_content") || window.Telegram?.WebApp?.initDataUnsafe?.start_param || "",
        }
        sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(attribution))
      }
    } catch { /* Attribution is optional and must never block navigation. */ }

    fetch("/api/analytics/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      /* `screen` отличает экран с фильтрами от того же раздела без них.
         Сервер по нему отсекает повторную отправку одного и того же экрана и
         в базу не пишет — там остаётся чистый путь. */
      body: JSON.stringify({
        path: pathname,
        screen: search ? `${pathname}?${search}` : pathname,
        visitorKey,
        sessionKey,
        /* Открыто внутри приложения Telegram.

           У приложения нет ссылающейся страницы, и его посещения
           попадали в «прямые заходы» — неотличимо от людей, набравших
           адрес вручную. Признак платформы есть только внутри
           мессенджера, поэтому он и отличает канал. */
        fromTelegramApp: typeof window !== "undefined" && Boolean(window.Telegram?.WebApp?.initData),
        ...attribution,
      }),
      keepalive: true,
    }).catch(() => {})
  }, [pathname, search])

  return null
}
