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
 * Рядом с памятью сеанса — cookie того же срока жизни. В приватном окне
 * и при запрете на хранилище sessionStorage бросает исключение, и признак
 * доживал ровно до следующего перехода: на третьем шаге человек получал
 * десктопную шапку с подвалом во весь экран телефона и без кнопки
 * возврата. Cookie в тех же условиях обычно работает, а сеансовая (без
 * даты окончания) исчезает при закрытии браузера — то же поведение.
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
        if (window.sessionStorage.getItem(TELEGRAM_SESSION_KEY) === "1") return true
      } catch {
        /* Приватное окно или запрет на хранилище — пробуем cookie. */
      }

      return document.cookie.split("; ").some((entry) => entry === `${TELEGRAM_SESSION_KEY}=1`)
    }

    const inside = detect()
    setFromTelegram(inside)
    if (!inside) return

    try {
      window.sessionStorage.setItem(TELEGRAM_SESSION_KEY, "1")
    } catch {
      /* Хранилище закрыто — остаётся cookie ниже. */
    }

    /* SameSite=Lax: переходы внутри сайта cookie сохраняют, а чужая
       страница её не увидит. Без срока жизни — исчезает с закрытием
       браузера, как и память сеанса. */
    document.cookie = `${TELEGRAM_SESSION_KEY}=1; path=/; SameSite=Lax`
  }, [])

  return fromTelegram
}
