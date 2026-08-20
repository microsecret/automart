"use client"

import { useEffect, useState } from "react"
import { getSession, signIn } from "next-auth/react"
import Link from "next/link"
import { Alert, Avatar, Badge, Button, Center, Group, Loader, Paper, SimpleGrid, Stack, Text, Title } from "@mantine/core"
import {
  IconBrandTelegram,
  IconCar,
  IconCircleCheck,
  IconExternalLink,
  IconGasStation,
  IconGavel,
  IconHeart,
  IconLogin,
  IconMessageCircle2,
  IconNews,
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
  { href: "/auctions", label: "Аукционы", icon: IconGavel, group: "Найти автомобиль" },
  { href: "/favorites", label: "Избранное", icon: IconHeart, group: "Найти автомобиль" },
  { href: "/listings/create/quick?source=telegram", label: "Подать объявление", icon: IconPlus, group: "Продать" },
  { href: "/listings/create/part?source=telegram", label: "Продать запчасть", icon: IconTools, group: "Продать" },
  { href: "/dashboard?tab=garage", label: "Личный гараж", icon: IconCar, group: "Мой кабинет" },
  { href: "/dashboard/deliveries", label: "Мои доставки", icon: IconTruckDelivery, group: "Мой кабинет" },
  { href: "/messages", label: "Сообщения", icon: IconMessageCircle2, group: "Мой кабинет" },
  { href: "/news", label: "Новости", icon: IconNews, group: "Сервисы" },
  { href: "/services/fuel-map", label: "АЗС: цены и наличие", icon: IconGasStation, group: "Сервисы" },
]
const QUICK_ACTION_GROUPS = ["Найти автомобиль", "Продать", "Мой кабинет", "Сервисы"]

/**
 * Куда вести человека после входа.
 *
 * Кнопки в боте передают цель через startapp: «разместить объявление» — это
 * create. Без разбора этого параметра все попадали на главную Mini App,
 * то есть жали «разместить», а оказывались не там.
 *
 * Значение читаем из подписанной initData, а не из initDataUnsafe: подпись
 * проверяется на сервере при входе, и до этой строки мы доходим только после
 * успешной авторизации.
 */
const START_PARAM_ROUTES: Record<string, string> = {
  create: "/listings/create/quick",
  promo: "/auctions",
}

function resolveStartRoute(initData: string) {
  try {
    // Цель приходит двумя путями: ссылка t.me/bot?startapp=create кладёт её в
    // start_param внутри initData, а кнопка web_app — в строку запроса.
    const startParam = (
      new URLSearchParams(initData).get("start_param")
      || new URLSearchParams(window.location.search).get("start")
    )?.trim()
    // Только известные значения — иначе чужой параметр стал бы открытым
    // редиректом внутри Mini App.
    return (startParam && START_PARAM_ROUTES[startParam]) || "/dashboard"
  } catch {
    return "/dashboard"
  }
}

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

        const startRoute = resolveStartRoute(webApp.initData)
        // Пришёл размещать объявление — не задерживаем на промежуточном экране.
        if (startRoute !== "/dashboard") {
          window.location.assign(startRoute)
          return
        }

        const openDashboard = () => {
          webApp.HapticFeedback?.impactOccurred("light")
          window.location.assign("/dashboard")
        }
        webApp.MainButton?.setText("Открыть личный кабинет")
        webApp.MainButton?.setParams?.({
          text: "Открыть личный кабинет",
          color: "#4f46e5",
          text_color: "#ffffff",
          has_shine_effect: true,
        })
        webApp.MainButton?.onClick(openDashboard)
        webApp.MainButton?.show()
        detachMainButton = () => {
          webApp.MainButton?.offClick(openDashboard)
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
            <Stack gap="md">
              <Button component={Link} href="/dashboard" onClick={triggerHaptic} color="indigo" radius="lg" size="md" fullWidth rightSection={<IconExternalLink size={16} />}>Открыть личный кабинет</Button>
              <Paper component={Link} href="/services/fuel-map" onClick={triggerHaptic} radius="lg" p="md" bg="teal.0" style={{ textDecoration: "none", border: "1px solid var(--mantine-color-teal-2)" }}>
                <Group wrap="nowrap" align="center"><Avatar color="teal" variant="light" radius="md"><IconGasStation size={20} /></Avatar><Stack gap={2} miw={0}><Text fw={800} c="teal.9">Карта АЗС рядом</Text><Text size="xs" c="teal.8">Маршрут, виды топлива и live-цены при подключённом поставщике</Text></Stack><IconExternalLink size={16} color="var(--mantine-color-teal-7)" /></Group>
              </Paper>
              {QUICK_ACTION_GROUPS.map((group) => (
                <Stack key={group} gap={7}>
                  <Text size="xs" fw={800} tt="uppercase" c="dimmed">{group}</Text>
                  <SimpleGrid cols={2} spacing="xs">
                    {QUICK_ACTIONS.filter((action) => action.group === group).map((action) => {
                      const Icon = action.icon
                      return (
                        <Button
                          key={action.href}
                          component={Link}
                          href={action.href}
                          onClick={triggerHaptic}
                          variant="light"
                          color={group === "Продать" ? "orange" : "indigo"}
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
                </Stack>
              ))}
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
