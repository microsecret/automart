"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Alert, Anchor, Button, Group, Paper, Stack, Text, ThemeIcon } from "@mantine/core"
import { IconAt, IconBrandTelegram, IconCircleCheck, IconLock, IconPhone } from "@tabler/icons-react"

function getSafeCallbackUrl(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/dashboard"
}

const STEPS = [
  { icon: IconPhone, title: "Подтвердите телефон", text: "Отправьте свой контакт одной кнопкой" },
  { icon: IconAt, title: "Укажите почту", text: "Она понадобится для входа на сайт" },
  { icon: IconLock, title: "Придумайте пароль", text: "Минимум 8 символов — хранится только хэш" },
]

export default function SignUpForm() {
  const [callbackUrl, setCallbackUrl] = useState("/dashboard")
  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME

  useEffect(() => {
    setCallbackUrl(getSafeCallbackUrl(new URLSearchParams(window.location.search).get("callbackUrl")))
  }, [])

  return (
    <Stack gap="md">
      <Alert color="indigo" variant="light" radius="md" icon={<IconBrandTelegram size={18} />}>
        Регистрация проходит в официальном Telegram-боте LeWheel. Бот сохранит ваш Telegram ID и проведёт по трём коротким шагам.
      </Alert>

      <Stack gap="sm">
        {STEPS.map((step, index) => {
          const Icon = step.icon
          return (
            <Paper key={step.title} withBorder radius="md" p="sm">
              <Group wrap="nowrap" gap="sm">
                <ThemeIcon color="indigo" variant="light" radius="xl" size={38}><Icon size={19} /></ThemeIcon>
                <div style={{ flex: 1 }}>
                  <Text size="sm" fw={750}>{index + 1}. {step.title}</Text>
                  <Text size="xs" c="dimmed">{step.text}</Text>
                </div>
                <IconCircleCheck size={18} color="#94a3b8" aria-hidden />
              </Group>
            </Paper>
          )
        })}
      </Stack>

      {botUsername ? (
        <Button
          component="a"
          href={`https://t.me/${botUsername}?start=register`}
          target="_blank"
          rel="noreferrer"
          color="indigo"
          size="md"
          radius="md"
          leftSection={<IconBrandTelegram size={20} />}
          fullWidth
        >
          Начать регистрацию в Telegram
        </Button>
      ) : (
        <Alert color="yellow" variant="light">Бот временно не подключён. Попробуйте немного позже.</Alert>
      )}

      <Text size="xs" c="dimmed" ta="center">
        После регистрации Mini App войдёт автоматически, а на сайте можно будет использовать почту или телефон и пароль.
      </Text>

      <Group justify="center">
        <Text size="sm" c="gray.5">
          Уже есть аккаунт?{" "}
          <Anchor component={Link} href={`/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`} size="sm" c="indigo" fw={500}>
            Войти
          </Anchor>
        </Text>
      </Group>
    </Stack>
  )
}
