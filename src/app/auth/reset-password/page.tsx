"use client"

import { FormEvent, Suspense, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Alert, Box, Button, Card, Center, Container, Loader, PasswordInput, Stack, Text, ThemeIcon } from "@mantine/core"
import { notifications } from "@mantine/notifications"
import { IconCar, IconCheck, IconLock, IconMailOff } from "@tabler/icons-react"
import { fetchJson, getApiClientErrorMessage } from "@/lib/api-client"

export const dynamic = "force-dynamic"

export default function ResetPasswordPage() {
  return <Suspense fallback={<Center py={100}><Loader color="indigo" /></Center>}><ResetPasswordWorkspace /></Suspense>
}

function ResetPasswordWorkspace() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token") || ""
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [completed, setCompleted] = useState(false)

  // Успешный сброс уводит на вход через 1,2 с — паузу, за которую человек
  // успевает прочитать подтверждение. Если он уходит раньше сам, таймер
  // срабатывал уже по снятому экрану и выдёргивал пользователя со страницы,
  // на которую он только что перешёл. Снимаем его при размонтировании.
  const redirectTimer = useRef<number | null>(null)

  useEffect(() => () => {
    if (redirectTimer.current !== null) window.clearTimeout(redirectTimer.current)
  }, [])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (password !== confirmPassword) {
      notifications.show({ title: "Пароли не совпадают", message: "Повторите новый пароль ещё раз.", color: "red" })
      return
    }
    setLoading(true)
    try {
      await fetchJson<{ ok: true }>("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      })
      setCompleted(true)
      notifications.show({ title: "Пароль обновлён", message: "Теперь войдите с новым паролем.", color: "teal" })
      redirectTimer.current = window.setTimeout(() => {
        redirectTimer.current = null
        router.push("/auth/signin")
      }, 1200)
      // Загрузка намеренно не снимается после успеха: токен сброса одноразовый,
      // и разблокированная на секунду кнопка позволяла отправить его повторно —
      // второй запрос возвращал ошибку поверх уже показанного успеха.
    } catch (error) {
      notifications.show({ title: "Не удалось обновить пароль", message: getApiClientErrorMessage(error, "Попробуйте позже."), color: "red" })
      setLoading(false)
    }
  }

  return (
    <Container size={420} py={48}>
      <Stack gap="lg" align="center">
        <Box style={{ width: 56, height: 56, borderRadius: 16, background: "linear-gradient(135deg, #1c4291, #1c4291)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <IconCar size={28} color="white" />
        </Box>
        <Stack gap={4} align="center">
          <Text component="h1" c="var(--market-ink)" ff="var(--font-display),sans-serif">Новый пароль</Text>
          <Text size="sm" c="gray.5">Ссылка действует 24 часа и используется один раз.</Text>
        </Stack>

        {!token ? (
          <Card withBorder radius="md" p="xl" w="100%">
            <Stack gap="md" align="center">
              <ThemeIcon variant="light" color="orange" size={56} radius="xl"><IconMailOff size={28} /></ThemeIcon>
              <Text fw={700} c="var(--market-ink)">Ссылка неполная</Text>
              <Text size="sm" c="gray.5" ta="center">Запросите новое письмо для восстановления пароля.</Text>
              <Button component={Link} href="/auth/forgot-password" variant="light" color="indigo">Запросить ссылку</Button>
            </Stack>
          </Card>
        ) : completed ? (
          <Card withBorder radius="md" p="xl" w="100%">
            <Stack gap="md" align="center">
              <ThemeIcon variant="light" color="green" size={56} radius="xl"><IconCheck size={28} /></ThemeIcon>
              <Text fw={700} c="var(--market-ink)">Пароль обновлён</Text>
              <Text size="sm" c="gray.5" ta="center">Перенаправляем на страницу входа.</Text>
            </Stack>
          </Card>
        ) : (
          <Card withBorder radius="md" p="xl" w="100%" shadow="sm">
            <form onSubmit={handleSubmit}>
              <Stack gap="md">
                <Alert icon={<IconLock size={16} />} color="indigo" variant="light" radius="md">Минимум 8 символов. После смены пароля все активные сессии будут завершены.</Alert>
                {/* Поле пароля с кнопкой «показать» и проверкой на месте.

                    Здесь стояли обычные текстовые поля со скрытым
                    вводом: на телефоне человек вслепую набирал восемь
                    с лишним символов дважды и узнавал о расхождении
                    только после нажатия «Сохранить» — всплывающим
                    сообщением, причём оба поля оставались заполненными
                    старыми значениями, и было непонятно, какое из них
                    править.

                    Требование про восемь символов стояло только в
                    атрибуте поля, то есть показывалось подсказкой
                    браузера, а не текстом рядом. */}
                <PasswordInput
                  label="Новый пароль"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.currentTarget.value)}
                  minLength={8}
                  maxLength={128}
                  autoComplete="new-password"
                  error={password.length > 0 && password.length < 8 ? "Минимум 8 символов" : undefined}
                />
                <PasswordInput
                  label="Повторите пароль"
                  required
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.currentTarget.value)}
                  minLength={8}
                  maxLength={128}
                  autoComplete="new-password"
                  error={confirmPassword.length > 0 && password !== confirmPassword ? "Пароли не совпадают" : undefined}
                />
                <Button type="submit" size="md" color="indigo" loading={loading} fullWidth>Сохранить новый пароль</Button>
                <Text size="xs" c="gray.5" ta="center"><Link href="/auth/signin" style={{ color: "#1c4291" }}>Вернуться ко входу</Link></Text>
              </Stack>
            </form>
          </Card>
        )}
      </Stack>
    </Container>
  )
}
