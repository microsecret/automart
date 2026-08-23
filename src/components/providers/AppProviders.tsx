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
    const saved = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null
    if (saved === "dark" || saved === "light") {
      setColorScheme(saved)
    } else if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
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
