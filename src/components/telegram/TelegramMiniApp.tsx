"use client"

import { useEffect, useState } from "react"
import { getSession, signIn } from "next-auth/react"
import Link from "next/link"
import { Alert, Avatar, Badge, Button, Center, Group, Loader, Paper, SimpleGrid, Stack, Text, Title } from "@mantine/core"
import {
  IconBrandTelegram,
  IconCircleCheck,
  IconExternalLink,
  IconGasStation,
  IconGavel,
  IconHeart,
  IconLogin,
  IconPlus,
  IconTools,
  IconTruckDelivery,
} from "@tabler/icons-react"

type TelegramWebApp = {
  initData: string
  ready: () => void
  expand: () => void
  setHeaderColor?: (color: string) => void
  setBackgroundColor?: (color: string) => void
  MainButton?: {
    setText: (text: string) => void
    setParams?: (params: { text?: string; color?: string; text_color?: string; has_shine_effect?: boolean }) => void
    show: () => void
    hide: () => void
    onClick: (callback: () => void) => void
    offClick: (callback: () => void) => void
  }
  HapticFeedback?: { impactOccurred: (style: "light" | "medium" | "heavy" | "rigid" | "soft") => void }
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp }
  }
}

const QUICK_ACTIONS = [
  { href: "/listings/create/vehicle?source=telegram", label: "Подать объявление", icon: IconPlus },
  { href: "/listings/create/part?source=telegram", label: "Продать запчасть", icon: IconTools },
  { href: "/auctions", label: "Аукционы", icon: IconGavel },
  { href: "/favorites", label: "Избранное", icon: IconHeart },
  { href: "/dashboard/deliveries", label: "Мои доставки", icon: IconTruckDelivery },
  { href: "/services/fuel-map", label: "Карта АЗС", icon: IconGasStation },
]

async function waitForTelegramWebApp(timeoutMs = 4_000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    if (window.Telegram?.WebApp) return window.Telegram.WebApp
    await new Promise((resolve) => window.setTimeout(resolve, 50))
  }
  return null
}

export default function TelegramMiniApp() {
  const [status, setStatus] = useState<"loading" | "ready" | "browser" | "error">("loading")
  const [message, setMessage] = useState("Узнаём ваш Telegram ID и открываем аккаунт…")
  const [displayName, setDisplayName] = useState<string | null>(null)
  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME

  useEffect(() => {
    let disposed = false
    let detachMainButton: (() => void) | undefined

    async function authorize() {
      const webApp = await waitForTelegramWebApp()
      if (disposed) return
      if (!webApp) {
        setStatus("browser")
        setMessage("Mini App открывается внутри Telegram. Для входа на сайте используйте почту или телефон и пароль.")
        return
      }

      webApp.ready()
      webApp.expand()
      webApp.setHeaderColor?.("#1e1b4b")
      webApp.setBackgroundColor?.("#eef2ff")
      if (!webApp.initData) {
        setStatus("browser")
        setMessage("Откройте Mini App кнопкой внутри Telegram. Для входа в обычном браузере используйте почту или телефон и пароль.")
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

        const session = await getSession()
        if (disposed) return
        setDisplayName(session?.user?.name || null)
        setStatus("ready")
        setMessage("Вы вошли автоматически — повторная авторизация не нужна.")

        const createListing = () => {
          webApp.HapticFeedback?.impactOccurred("light")
          window.location.assign("/listings/create/vehicle?source=telegram")
        }
        webApp.MainButton?.setText("Подать объявление")
        webApp.MainButton?.setParams?.({
          text: "Подать объявление",
          color: "#4f46e5",
          text_color: "#ffffff",
          has_shine_effect: true,
        })
        webApp.MainButton?.onClick(createListing)
        webApp.MainButton?.show()
        detachMainButton = () => {
          webApp.MainButton?.offClick(createListing)
          webApp.MainButton?.hide()
        }
      } catch {
        if (disposed) return
        setStatus("error")
        setMessage("Сервис авторизации временно недоступен. Попробуйте открыть Mini App ещё раз.")
      }
    }

    void authorize()
    return () => {
      disposed = true
      detachMainButton?.()
    }
  }, [])

  const triggerHaptic = () => window.Telegram?.WebApp?.HapticFeedback?.impactOccurred("light")
  const title = status === "ready"
    ? `Добро пожаловать${displayName ? `, ${displayName}` : ""}!`
    : status === "loading" ? "Входим в ваш аккаунт" : "LeWheel Mini App"

  return (
    <Center
      mih="100dvh"
      w="100%"
      p={{ base: "sm", sm: "md" }}
      style={{ background: "radial-gradient(circle at top,#6366f1 0%,#312e81 38%,#11162f 100%)", overflow: "hidden" }}
    >
      <Paper maw={470} w="100%" miw={0} radius="xl" p={{ base: "lg", sm: "xl" }} shadow="xl" style={{ maxWidth: "calc(100vw - 24px)", border: "1px solid rgba(255,255,255,.45)" }}>
        <Stack gap="lg">
          <Group gap="sm" wrap="nowrap" align="center">
            <Avatar src="/images/telegram-bot-avatar-v1.png" size={56} radius="xl" color="indigo" style={{ flexShrink: 0 }}>LW</Avatar>
            <Stack gap={5} miw={0}>
              <Badge leftSection={<IconBrandTelegram size={14} />} color={status === "ready" ? "teal" : "indigo"} variant="light" maw="100%">
                {status === "ready" ? "Аккаунт определён" : "LeWheel · Telegram"}
              </Badge>
              <Title order={1} fz={{ base: 23, sm: 31 }} lh={1.1} style={{ overflowWrap: "anywhere" }}>{title}</Title>
            </Stack>
          </Group>

          <Alert
            color={status === "error" ? "red" : status === "ready" ? "teal" : "indigo"}
            icon={status === "ready" ? <IconCircleCheck size={18} /> : status === "loading" ? <Loader size={17} color="indigo" /> : <IconBrandTelegram size={18} />}
            radius="md"
          >
            {message}
          </Alert>

          {status === "browser" && (
            <Button component={Link} href="/auth/signin" color="indigo" leftSection={<IconLogin size={18} />} fullWidth>
              Войти на сайте
            </Button>
          )}

          {status === "ready" && (
            <Stack gap="sm">
              <SimpleGrid cols={2} spacing="sm">
                {QUICK_ACTIONS.map((action) => {
                  const Icon = action.icon
                  return (
                    <Button
                      key={action.href}
                      component={Link}
                      href={action.href}
                      onClick={triggerHaptic}
                      variant="light"
                      color="indigo"
                      radius="md"
                      size="sm"
                      leftSection={<Icon size={16} />}
                      justify="flex-start"
                    >
                      {action.label}
                    </Button>
                  )
                })}
              </SimpleGrid>
              <Button component={Link} href="/dashboard" color="indigo" radius="md" fullWidth>Открыть личный кабинет</Button>
            </Stack>
          )}

          {status === "error" && botUsername && (
            <Button
              component="a"
              href={`https://t.me/${botUsername}?start=register`}
              target="_blank"
              rel="noreferrer"
              variant="light"
              color="indigo"
              rightSection={<IconExternalLink size={16} />}
            >
              Завершить регистрацию в боте
            </Button>
          )}

          {status !== "ready" && (
            <Text size="xs" c="dimmed" ta="center">
              Telegram ID и подпись Mini App проверяются на сервере. Данные из небезопасного initDataUnsafe не используются.
            </Text>
          )}
        </Stack>
      </Paper>
    </Center>
  )
}
