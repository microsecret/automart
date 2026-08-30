"use client"

import { useEffect, useState } from "react"

/** Где держится признак «человек внутри мини-приложения». */
const TELEGRAM_SESSION_KEY = "lewheel:from-telegram"

/**
 * Открыта ли страница из мини-приложения Telegram.
 *
 * Ссылки из приложения помечены `from=telegram`, но параметр живёт
 * ровно один переход: открыв из ленты форум, а из форума — тему,
 * человек теряет пометку и получает десктопную шапку с подвалом
 * посреди пути.
 *
 * Поэтому признак запоминается на время сеанса. Три источника, в
 * порядке надёжности:
 *
 * • объект платформы — он есть только внутри Telegram и не врёт;
 * • пометка в адресе — для первого перехода, пока объект ещё не
 *   поднялся;
 * • память сеанса — для всех последующих переходов.
 *
 * sessionStorage, а не localStorage: закрыв Telegram и открыв сайт в
 * браузере, человек должен увидеть обычный сайт, а не обрезанную
 * версию без меню.
 *
 * Проверка идёт после первой отрисовки: на сервере ни адреса, ни
 * платформы нет, и решение, принятое там, разошлось бы с клиентским.
 */
export function useTelegramSession() {
  const [fromTelegram, setFromTelegram] = useState(false)

  useEffect(() => {
    const detect = () => {
      /* Платформа отвечает точно: initData есть только у настоящего
         мини-приложения. */
      if (window.Telegram?.WebApp?.initData) return true
      if (new URLSearchParams(window.location.search).get("from") === "telegram") return true
      try {
        return window.sessionStorage.getItem(TELEGRAM_SESSION_KEY) === "1"
      } catch {
        /* Приватное окно или запрет на хранилище: остаётся то, что
           видно в адресе. */
        return false
      }
    }

    const inside = detect()
    setFromTelegram(inside)
    if (!inside) return

    try {
      window.sessionStorage.setItem(TELEGRAM_SESSION_KEY, "1")
    } catch {
      /* Хранилище закрыто — признак доживёт до следующего перехода в
         адресе, дальше страница вернётся к обычному виду. */
    }
  }, [])

  return fromTelegram
}
