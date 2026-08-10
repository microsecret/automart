"use client"

import { useEffect, useState } from "react"
import { signIn } from "next-auth/react"
import Link from "next/link"
import { Alert, Badge, Button, Center, Paper, SimpleGrid, Stack, Text, Title } from "@mantine/core"
import { IconBrandTelegram, IconCircleCheck, IconExternalLink, IconGasStation, IconHeart, IconPlus, IconTruckDelivery } from "@tabler/icons-react"

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string
        ready: () => void
        expand: () => void
        setHeaderColor?: (color: string) => void
        MainButton?: {
          setText: (text: string) => void
          show: () => void
          hide: () => void
          onClick: (callback: () => void) => void
          offClick: (callback: () => void) => void
        }
        HapticFeedback?: { impactOccurred: (style: "light" | "medium" | "heavy" | "rigid" | "soft") => void }
      }
    }
  }
}

const QUICK_ACTIONS = [
  { href: "/listings/create/vehicle", label: "Подать объявление", icon: IconPlus },
  { href: "/favorites", label: "Избранное", icon: IconHeart },
  { href: "/dashboard/deliveries", label: "Мои доставки", icon: IconTruckDelivery },
  { href: "/services/fuel-map", label: "Карта АЗС", icon: IconGasStation },
]

export default function TelegramMiniApp() {
  const [status, setStatus] = useState<"loading" | "ready" | "browser" | "error">("loading")
  const [message, setMessage] = useState("Проверяем защищённую сессию Telegram…")
  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME

  useEffect(() => {
    let disposed = false
    let detachMainButton: (() => void) | undefined
    const webApp = window.Telegram?.WebApp
    if (!webApp) {
      setStatus("browser")
      setMessage("Откройте эту страницу из Telegram Mini App, чтобы войти без пароля.")
      return
    }
    webApp.ready()
    webApp.expand()
    webApp.setHeaderColor?.("#11162f")
    if (!webApp.initData) {
      setStatus("error")
      setMessage("Telegram не передал данные сессии. Откройте Mini App через бота ещё раз.")
      return
    }

    signIn("telegram", { initData: webApp.initData, redirect: false }).then((result) => {
      if (disposed) return
      if (result?.ok) {
        setStatus("ready")
        setMessage("Доступ подтверждён. Выберите, что хотите сделать сейчас.")

        const createListing = () => {
          webApp.HapticFeedback?.impactOccurred("light")
          window.location.assign("/listings/create/vehicle?source=telegram")
        }
        webApp.MainButton?.setText("Подать объявление")
        webApp.MainButton?.onClick(createListing)
        webApp.MainButton?.show()
        detachMainButton = () => {
          webApp.MainButton?.offClick(createListing)
          webApp.MainButton?.hide()
        }
      } else {
        setStatus("error")
        setMessage("Не удалось подтвердить вход. Сначала нажмите «Старт» в боте и отправьте свой контакт, затем откройте Mini App ещё раз.")
      }
    }).catch(() => {
      if (disposed) return
      setStatus("error")
      setMessage("Сервис авторизации временно недоступен.")
    })

    return () => {
      disposed = true
      detachMainButton?.()
    }
  }, [])

  const triggerHaptic = () => window.Telegram?.WebApp?.HapticFeedback?.impactOccurred("light")

  return (
    <Center mih="100vh" p="md" style={{ background: "linear-gradient(135deg,#11162f 0%,#312e81 52%,#e0e7ff 100%)" }}>
      <Paper maw={460} w="100%" radius="xl" p={{ base: "lg", sm: "xl" }} shadow="xl">
        <Stack gap="lg">
          <Badge leftSection={<IconBrandTelegram size={14} />} color="indigo" variant="light" w="fit-content">Авторынок · Telegram</Badge>
          <div>
            <Title order={1} fz={{ base: 28, sm: 34 }}>Транспорт всегда под рукой</Title>
            <Text c="dimmed" mt="xs">Единый кабинет для объявлений, избранного, аукционов и безопасных сделок.</Text>
          </div>
          <Alert color={status === "error" ? "red" : status === "ready" ? "green" : "indigo"} icon={status === "ready" ? <IconCircleCheck size={18} /> : <IconBrandTelegram size={18} />}>
            {message}
          </Alert>
          {status === "browser" && (
            <Button component={Link} href="/auth/telegram" color="indigo" leftSection={<IconBrandTelegram size={18} />} fullWidth>
              Войти через Telegram на сайте
            </Button>
          )}
          {status === "ready" && (
            <Stack gap="sm">
              <SimpleGrid cols={2} spacing="sm">
                {QUICK_ACTIONS.map((action) => {
                  const Icon = action.icon
                  return <Button key={action.href} component={Link} href={action.href} onClick={triggerHaptic} variant="light" color="indigo" radius="md" size="sm" leftSection={<Icon size={16} />} justify="flex-start">{action.label}</Button>
                })}
              </SimpleGrid>
              <Button component={Link} href="/dashboard" color="indigo" radius="md" fullWidth>Открыть полный кабинет</Button>
            </Stack>
          )}
          {status === "error" && botUsername && (
            <Button component="a" href={`https://t.me/${botUsername}`} target="_blank" rel="noreferrer" variant="light" color="indigo" rightSection={<IconExternalLink size={16} />}>
              Открыть бота @{botUsername}
            </Button>
          )}
          <Text size="xs" c="dimmed">Вход доступен после подтверждения собственного контакта в боте. Telegram ID и подпись Mini App проверяются на сервере; небезопасный `initDataUnsafe` не используется.</Text>
        </Stack>
      </Paper>
    </Center>
  )
}
