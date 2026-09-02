"use client"

import { MantineProvider } from "@mantine/core"
import { Notifications } from "@mantine/notifications"
import { ModalsProvider } from "@mantine/modals"
import { NavigationProgress } from "@mantine/nprogress"
import { SessionProvider } from "next-auth/react"
import { theme } from "@/theme/theme"
import { useState, useEffect, useCallback } from "react"

const STORAGE_KEY = "automart-color-scheme"

export default function AppProviders({ children }: { children: React.ReactNode }) {
  const [colorScheme, setColorScheme] = useState<"light" | "dark">("light")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    /* Тему мессенджера сюда кладёт приложение Telegram.

       Скрипт платформы подключён только на его странице, поэтому читать
       window.Telegram здесь бесполезно: кабинет и форма подачи —
       обычные страницы сайта. Приложение записывает выбор мессенджера в
       это же хранилище, и переход из тёмной ленты в кабинет больше не
       вспыхивает белым. */
    if (typeof window === "undefined") {
      setMounted(true)
      return
    }

    /* Порядок важен: собственный выбор человека главнее всего.

       Тема мессенджера учитывается только там, где выбора нет. Раньше
       приложение писало её в тот же ключ и перекрывало настройку сайта:
       человек со светлым сайтом и тёмным Telegram, открыв мини-
       приложение один раз, получал тёмный сайт в браузере навсегда.

       Ключ сеанса живёт, пока открыт мессенджер, и не переезжает в
       обычный браузер. */
    const saved = localStorage.getItem(STORAGE_KEY)
    const fromTelegram = sessionStorage.getItem("telegram-color-scheme")

    if (saved === "dark" || saved === "light") {
      setColorScheme(saved)
    } else if (fromTelegram === "dark" || fromTelegram === "light") {
      setColorScheme(fromTelegram)
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setColorScheme("dark")
    }
    setMounted(true)
  }, [])

  const toggleScheme = useCallback(() => {
    setColorScheme((prev) => {
      const next = prev === "dark" ? "light" : "dark"
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, next)
      }
      return next
    })
  }, [])

  return (
    <SessionProvider>
      <ColorSchemeContext.Provider value={{ colorScheme, toggleScheme }}>
        <MantineProvider theme={theme} forceColorScheme={mounted ? colorScheme : "light"}>
          <NavigationProgress color="#1c4291" />
          <ModalsProvider>
            <Notifications position="top-right" />
            {children}
          </ModalsProvider>
        </MantineProvider>
      </ColorSchemeContext.Provider>
    </SessionProvider>
  )
}

import { createContext, useContext } from "react"

interface ColorSchemeCtx {
  colorScheme: "light" | "dark"
  toggleScheme: () => void
}

export const ColorSchemeContext = createContext<ColorSchemeCtx>({
  colorScheme: "light",
  toggleScheme: () => {},
})

export function useColorScheme() {
  return useContext(ColorSchemeContext)
}
