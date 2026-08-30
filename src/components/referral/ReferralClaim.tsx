"use client"

import { useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import { useSearchParams } from "next/navigation"

/** Где хранится код приглашения между переходом по ссылке и входом. */
const REFERRAL_STORAGE_KEY = "lewheel:referral-code"
/** Откуда пришли: попадает в статистику партнёра. */
const REFERRAL_SOURCE_KEY = "lewheel:referral-source"

/**
 * Закрепляет приглашение за человеком, пришедшим по партнёрской ссылке.
 *
 * Партнёрская программа была разорвана посередине. Кабинет выдавал
 * ссылку с кодом, человек отправлял её знакомому, тот открывал сайт — и
 * на этом всё заканчивалось: параметр `ref` не читал никто, а
 * `/api/referral/claim` не вызывался ни из одного места. Приглашённый
 * регистрировался как обычный посетитель, связь не записывалась, и
 * вознаграждение не начислялось никогда.
 *
 * При этом кабинет партнёра честно показывал «Приглашено: 0» и обещал
 * вознаграждение — то есть программа выглядела работающей, а не была.
 *
 * Здесь связь замыкается. Код запоминается при переходе по ссылке и
 * ждёт: регистрация редко случается сразу, человек сначала смотрит
 * объявления. После входа код уходит на сервер, где приглашение
 * закрепляется навсегда — повторный переход по чужой ссылке его уже не
 * перепишет.
 *
 * Хранилище браузера, а не cookie: код нужен только этому человеку в
 * этом браузере, и отправлять его на сервер с каждым запросом незачем.
 */
export default function ReferralClaim() {
  const { data: session, status } = useSession()
  const searchParams = useSearchParams()
  const claimedRef = useRef(false)

  /* Шаг первый: запомнить код из ссылки. */
  useEffect(() => {
    const code = searchParams.get("ref")?.trim()
    if (!code) return
    try {
      /* Первая ссылка важнее последующих: приглашение принадлежит тому,
         кто привёл первым, и перезапись здесь означала бы, что чужой
         код может перехватить уже приведённого человека. */
      if (window.localStorage.getItem(REFERRAL_STORAGE_KEY)) return
      window.localStorage.setItem(REFERRAL_STORAGE_KEY, code.toUpperCase().slice(0, 16))
      /* Откуда пришёл: партнёру полезно знать, какая площадка работает. */
      const source = document.referrer || window.location.pathname
      window.localStorage.setItem(REFERRAL_SOURCE_KEY, source.slice(0, 120))
    } catch {
      /* Приватное окно или запрет на хранилище: приглашение просто не
         закрепится, остальное продолжит работать. */
    }
  }, [searchParams])

  /* Шаг второй: после входа отправить код на сервер. */
  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id) return
    if (claimedRef.current) return

    let code: string | null = null
    let source: string | null = null
    try {
      code = window.localStorage.getItem(REFERRAL_STORAGE_KEY)
      source = window.localStorage.getItem(REFERRAL_SOURCE_KEY)
    } catch {
      return
    }
    if (!code) return

    claimedRef.current = true
    void fetch("/api/referral/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, source }),
    })
      .then(async (response) => {
        /* Код убирается в двух случаях: приглашение закреплено или
           сервер сказал, что оно уже было. Держать его дальше значит
           слать один и тот же запрос при каждом заходе.

           При сетевой ошибке код остаётся: следующий заход попробует
           снова, и человек не потеряет партнёра из-за одной неудачной
           попытки. */
        if (!response.ok && response.status !== 409) return
        try {
          window.localStorage.removeItem(REFERRAL_STORAGE_KEY)
          window.localStorage.removeItem(REFERRAL_SOURCE_KEY)
        } catch {
          /* Хранилище закрылось между чтением и записью — не страшно. */
        }
      })
      .catch(() => {
        /* Нет связи: пробуем при следующем заходе. */
        claimedRef.current = false
      })
  }, [status, session?.user?.id])

  return null
}
