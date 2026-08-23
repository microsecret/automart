"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { signIn } from "next-auth/react"
import Link from "next/link"
import { Box, Button, Loader, Stack, Text } from "@mantine/core"
import { IconAlertTriangle, IconBrandTelegram } from "@tabler/icons-react"
import { tapFeedback, waitForTelegramWebApp } from "@/lib/telegram-webapp"
import TelegramShell from "./TelegramShell"
import TelegramFeed from "./TelegramFeed"
import TelegramAuctions from "./TelegramAuctions"
import TelegramNews from "./TelegramNews"

/**
 * Приложение LeWheel внутри Telegram.
 *
 * Раньше человек, открывший приложение, видел экран приветствия и четыре
 * группы ссылок — «Найти автомобиль», «Продать», «Мой кабинет»,
 * «Сервисы». Ни одной машины. Продавец не понимал, что здесь продают, а
 * покупатель закрывал, не пролистав.
 *
 * Теперь это лента машин с первого экрана и навигация внизу, как в
 * мобильном приложении. Вход по подписи Telegram остаётся прежним и
 * проходит незаметно: он не должен стоять между человеком и товаром.
 */

/* Куда вести, если человек пришёл по кнопке из бота.

   Кнопки передают цель через startapp: «разместить объявление» — create.
   Без разбора все попадали на главную приложения, то есть жали
   «разместить», а оказывались не там.

   Только известные значения: чужой параметр стал бы открытым
   перенаправлением внутри приложения. */
const START_PARAM_ROUTES: Record<string, string> = {
  create: "/listings/create/quick?source=telegram",
  promo: "/auctions?from=telegram",
}

function resolveStartRoute(initData: string): string | null {
  try {
    const startParam = (
      new URLSearchParams(initData).get("start_param")
      || new URLSearchParams(window.location.search).get("start")
    )?.trim()
    return (startParam && START_PARAM_ROUTES[startParam]) || null
  } catch {
    return null
  }
}

type Status = "loading" | "ready" | "browser" | "error"

export default function TelegramMiniApp() {
  /* Раздел читается из адреса, а не хранится в состоянии.

     Тогда кнопка «назад» в Telegram возвращает к предыдущей вкладке, а
     не закрывает приложение — как в любом мобильном приложении. */
  const rawTab = useSearchParams().get("tab")
  const tab = rawTab === "auctions" || rawTab === "news" ? rawTab : "vehicles"
  const [status, setStatus] = useState<Status>("loading")
  const [message, setMessage] = useState("")
  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME

  useEffect(() => {
    let disposed = false

    async function authorize() {
      const webApp = await waitForTelegramWebApp()
      if (disposed) return

      if (!webApp || !webApp.initData) {
        setStatus("browser")
        setMessage("Это приложение открывается кнопкой внутри Telegram.")
        return
      }

      try {
        const result = await signIn("telegram", { initData: webApp.initData, redirect: false })
        if (disposed) return

        if (!result?.ok) {
          setStatus("error")
          setMessage("Регистрация не завершена. Вернитесь в бот и пройдите три шага: телефон, почта и пароль.")
          return
        }

        /* Пришёл по кнопке с целью — ведём сразу, не задерживая на ленте. */
        const startRoute = resolveStartRoute(webApp.initData)
        if (startRoute) {
          window.location.assign(startRoute)
          return
        }

        setStatus("ready")
      } catch {
        if (disposed) return
        setStatus("error")
        setMessage("Сервис входа временно недоступен. Откройте приложение ещё раз.")
      }
    }

    void authorize()
    return () => {
      disposed = true
    }
  }, [])

  /* Лента показывается, не дожидаясь входа.

     Вход нужен, чтобы сохранять избранное и подавать объявления, но
     смотреть машины можно и без него. Экран ожидания перед лентой — то
     самое, от чего мы уходим: человек пришёл за товаром, а видит
     служебное сообщение. */
  if (status === "browser" || status === "error") {
    return (
      <TelegramShell title="LeWheel" subtitle="Транспорт, запчасти и аукционы">
        <Stack gap="md">
          <Box className="tg-notice" data-tone={status === "error" ? "error" : undefined}>
            {status === "error" ? <IconAlertTriangle size={18} /> : <IconBrandTelegram size={18} />}
            <Text size="sm">{message}</Text>
          </Box>
          {status === "error" && botUsername && (
            <Button
              component="a"
              href={`https://t.me/${botUsername}`}
              onClick={() => tapFeedback()}
              className="tg-button"
              fullWidth
            >
              Открыть бот
            </Button>
          )}
          {status === "browser" && (
            <Button component={Link} href="/" onClick={() => tapFeedback()} className="tg-button" fullWidth>
              Перейти на сайт
            </Button>
          )}
          <TelegramFeed />
        </Stack>
      </TelegramShell>
    )
  }

  const HEADINGS = {
    vehicles: { title: "Свежие объявления", subtitle: "Транспорт с проверкой и доставкой", href: "/telegram" },
    auctions: { title: "Мировые аукционы", subtitle: "Корея, Япония, Китай — с расчётом под ключ", href: "/telegram?tab=auctions" },
    news: { title: "Новости авторынка", subtitle: "Что происходит с ценами и рынком", href: "/telegram?tab=news" },
  } as const
  const heading = HEADINGS[tab]

  return (
    <TelegramShell title={heading.title} subtitle={heading.subtitle} activeTab={heading.href}>
      {status === "loading" ? (
        <Stack align="center" py={40} gap="xs">
          <Loader size="sm" color="var(--tg-accent)" />
          <Text size="xs" c="var(--tg-hint)">Открываем ваш аккаунт…</Text>
        </Stack>
      ) : tab === "auctions" ? (
        <TelegramAuctions />
      ) : tab === "news" ? (
        <TelegramNews />
      ) : (
        <TelegramFeed />
      )}
    </TelegramShell>
  )
}
