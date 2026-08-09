"use client"

import { useEffect } from "react"

/** Last-resort fallback that still works if the root application shell fails. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Global application error", error)
  }, [error])

  return (
    <html lang="ru">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#f7f7f9", color: "#171719", fontFamily: "Inter, system-ui, sans-serif" }}>
        <main style={{ width: "min(100%, 520px)", padding: 32, border: "1px solid #e8e8ec", borderRadius: 20, background: "#fff", boxShadow: "0 20px 50px -36px rgba(24, 24, 27, .45)", textAlign: "center" }}>
          <p style={{ margin: 0, color: "#4f46e5", fontSize: 14, fontWeight: 700 }}>АВТОРЫНОК</p>
          <h1 style={{ margin: "16px 0 8px", fontSize: 26, lineHeight: 1.15 }}>Временная ошибка приложения</h1>
          <p style={{ margin: 0, color: "#667085", lineHeight: 1.55 }}>Обновите страницу или вернитесь к каталогу. Мы не показываем технические детали ошибки посетителям.</p>
          <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap", marginTop: 24 }}>
            <button type="button" onClick={reset} style={{ minHeight: 40, padding: "0 16px", border: 0, borderRadius: 10, background: "#4f46e5", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Повторить</button>
            <a href="/" style={{ display: "inline-flex", alignItems: "center", minHeight: 40, padding: "0 16px", border: "1px solid #d6deeb", borderRadius: 10, color: "#273142", fontWeight: 700, textDecoration: "none" }}>К объявлениям</a>
          </div>
        </main>
      </body>
    </html>
  )
}
