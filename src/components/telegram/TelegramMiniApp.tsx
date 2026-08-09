"use client"

import { useEffect, useState } from "react"
import { signIn } from "next-auth/react"
import Link from "next/link"
import { Alert, Badge, Button, Center, Paper, Stack, Text, Title } from "@mantine/core"
import { IconBrandTelegram, IconCircleCheck, IconExternalLink } from "@tabler/icons-react"

declare global {
  interface Window {
    Telegram?: { WebApp?: { initData: string; ready: () => void; expand: () => void; setHeaderColor?: (color: string) => void } }
  }
}

export default function TelegramMiniApp() {
  const [status, setStatus] = useState<"loading" | "ready" | "browser" | "error">("loading")
  const [message, setMessage] = useState("Проверяем защищённую сессию Telegram…")
  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME

  useEffect(() => {
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
      if (result?.ok) {
        setStatus("ready")
        setMessage("Готово. Открываем ваш кабинет Авторынка…")
        window.location.href = "/dashboard"
      } else {
        setStatus("error")
        setMessage("Не удалось подтвердить Telegram-сессию. Запустите Mini App заново.")
      }
    }).catch(() => {
      setStatus("error")
      setMessage("Сервис авторизации временно недоступен.")
    })
  }, [])

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
          {status === "error" && botUsername && (
            <Button component="a" href={`https://t.me/${botUsername}`} target="_blank" rel="noreferrer" variant="light" color="indigo" rightSection={<IconExternalLink size={16} />}>
              Открыть бота @{botUsername}
            </Button>
          )}
          <Text size="xs" c="dimmed">Telegram ID проверяется на сервере. Данные из небезопасного `initDataUnsafe` не используются.</Text>
        </Stack>
      </Paper>
    </Center>
  )
}
