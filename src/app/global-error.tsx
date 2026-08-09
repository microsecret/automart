"use client"

import { useEffect } from "react"

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Global application error", error)
  }, [error])

  return (
    <html lang="ru">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#f7f7f9", color: "#171719", fontFamily: "Arial, sans-serif" }}>
        <main style={{ width: "min(480px, calc(100% - 32px))", padding: 32, border: "1px solid #e8e8ec", borderRadius: 16, background: "#fff", textAlign: "center", boxShadow: "0 20px 50px -38px rgba(24,24,27,.45)" }}>
          <p style={{ margin: "0 0 8px", color: "#4f46e5", fontWeight: 700 }}>Авторынок</p>
          <h1 style={{ margin: "0 0 12px", fontSize: 24 }}>Сервис временно недоступен</h1>
          <p style={{ margin: "0 0 24px", color: "#52525b", lineHeight: 1.5 }}>Попробуйте обновить страницу через несколько секунд.</p>
          <button type="button" onClick={reset} style={{ minHeight: 40, padding: "0 16px", border: 0, borderRadius: 8, background: "#4f46e5", color: "#fff", cursor: "pointer", fontWeight: 700 }}>Повторить</button>
        </main>
      </body>
    </html>
  )
}
