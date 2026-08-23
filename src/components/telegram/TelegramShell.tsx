"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Box, Text } from "@mantine/core"
import type { TelegramThemeParams } from "@/lib/telegram-webapp"
import {
  IconCar,
  IconGavel,
  IconHeart,
  IconPlus,
  IconUser,
} from "@tabler/icons-react"

/**
 * Оболочка приложения Telegram: шапка, лента и нижняя навигация.
 *
 * Приложение выглядело как страница со ссылками. Здесь оно устроено как
 * мобильное приложение: содержимое во весь экран, навигация внизу под
 * большим пальцем, оформление совпадает с темой мессенджера.
 *
 * Цвета берутся из переменных платформы (themeParams). Так приложение
 * выглядит родным и в светлой теме, и в тёмной, и у тех, кто поставил
 * свою: чужеродная белая страница внутри тёмного Telegram — первое, что
 * выдаёт наспех сделанное приложение.
 */

/* Запасные цвета — на случай, если платформа их не отдала.

   Подобраны под тёмное оформление Telegram по умолчанию: приложение,
   открытое в старом клиенте, не должно вспыхивать белым. */
const FALLBACK: Required<Pick<TelegramThemeParams,
  "bg_color" | "secondary_bg_color" | "text_color" | "hint_color" | "link_color"
  | "button_color" | "button_text_color" | "section_bg_color" | "section_separator_color"
>> = {
  bg_color: "#17212b",
  secondary_bg_color: "#0e1621",
  text_color: "#ffffff",
  hint_color: "#708499",
  link_color: "#6ab3f3",
  button_color: "#5288c1",
  button_text_color: "#ffffff",
  section_bg_color: "#17212b",
  section_separator_color: "#101921",
}

const TABS = [
  { href: "/telegram", label: "Машины", Icon: IconCar },
  { href: "/telegram?tab=auctions", label: "Аукционы", Icon: IconGavel },
  { href: "/listings/create/quick?source=telegram", label: "Продать", Icon: IconPlus, accent: true },
  { href: "/favorites?from=telegram", label: "Избранное", Icon: IconHeart },
  { href: "/dashboard?from=telegram", label: "Профиль", Icon: IconUser },
]

export default function TelegramShell({
  children,
  activeTab = "/telegram",
  title,
  subtitle,
}: {
  children: React.ReactNode
  activeTab?: string
  title: string
  subtitle?: string
}) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const webApp = window.Telegram?.WebApp
    if (!webApp) {
      // Открыто в обычном браузере: запасная тема уже задана в стилях.
      setReady(true)
      return
    }

    webApp.ready?.()
    webApp.expand?.()
    /* Свайп вниз закрывает приложение — при прокрутке ленты это
       происходит случайно и раздражает. Отключаем там, где платформа
       позволяет. */
    webApp.disableVerticalSwipes?.()

    const theme = webApp.themeParams || {}
    const root = document.documentElement
    for (const [key, fallback] of Object.entries(FALLBACK)) {
      const value = theme[key as keyof TelegramThemeParams] || fallback
      root.style.setProperty(`--tg-${key.replace(/_/g, "-")}`, value)
    }
    /* Короткие имена для стилей: полные названия платформы длинны и
       читаются хуже в правилах. */
    root.style.setProperty("--tg-bg", theme.bg_color || FALLBACK.bg_color)
    root.style.setProperty("--tg-surface", theme.section_bg_color || theme.bg_color || FALLBACK.section_bg_color)
    root.style.setProperty("--tg-elevated", theme.secondary_bg_color || FALLBACK.secondary_bg_color)
    root.style.setProperty("--tg-text", theme.text_color || FALLBACK.text_color)
    root.style.setProperty("--tg-hint", theme.hint_color || FALLBACK.hint_color)
    root.style.setProperty("--tg-accent", theme.button_color || FALLBACK.button_color)
    root.style.setProperty("--tg-accent-text", theme.button_text_color || FALLBACK.button_text_color)
    root.style.setProperty("--tg-line", theme.section_separator_color || FALLBACK.section_separator_color)

    webApp.setHeaderColor?.(theme.bg_color || FALLBACK.bg_color)
    webApp.setBackgroundColor?.(theme.secondary_bg_color || FALLBACK.secondary_bg_color)
    setReady(true)
  }, [])

  return (
    <Box className="tg-shell" data-ready={ready || undefined}>
      <Box className="tg-shell__head">
        <Text className="tg-shell__title">{title}</Text>
        {subtitle && <Text className="tg-shell__subtitle">{subtitle}</Text>}
      </Box>

      <Box className="tg-shell__body">{children}</Box>

      <Box component="nav" className="tg-nav" aria-label="Разделы приложения">
        {TABS.map(({ href, label, Icon, accent }) => {
          const active = href === activeTab
          return (
            <Link
              key={href}
              href={href}
              className="tg-nav__item"
              data-active={active || undefined}
              data-accent={accent || undefined}
              onClick={() => window.Telegram?.WebApp?.HapticFeedback?.impactOccurred("light")}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={accent ? 21 : 19} stroke={active ? 2.2 : 1.8} />
              <Text component="span" className="tg-nav__label">{label}</Text>
            </Link>
          )
        })}
      </Box>
    </Box>
  )
}
