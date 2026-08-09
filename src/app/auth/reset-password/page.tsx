"use client"

import { FormEvent, Suspense, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Alert, Box, Button, Card, Center, Container, Loader, Stack, Text, TextInput, ThemeIcon } from "@mantine/core"
import { notifications } from "@mantine/notifications"
import { IconCar, IconCheck, IconLock, IconMailOff } from "@tabler/icons-react"

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

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (password !== confirmPassword) {
      notifications.show({ title: "Пароли не совпадают", message: "Повторите новый пароль ещё раз.", color: "red" })
      return
    }
    setLoading(true)
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload?.error || "Не удалось обновить пароль")
      setCompleted(true)
      notifications.show({ title: "Пароль обновлён", message: "Теперь войдите с новым паролем.", color: "teal" })
      window.setTimeout(() => router.push("/auth/signin"), 1200)
    } catch (error) {
      notifications.show({ title: "Не удалось обновить пароль", message: error instanceof Error ? error.message : "Попробуйте позже.", color: "red" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Container size={420} py={48}>
      <Stack gap="lg" align="center">
        <Box style={{ width: 56, height: 56, borderRadius: 16, background: "linear-gradient(135deg, #4f46e5, #7c3aed)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <IconCar size={28} color="white" />
        </Box>
        <Stack gap={4} align="center">
          <Text component="h1" fw={800} fz={24} c="dark.9" ff="var(--font-display),sans-serif">Новый пароль</Text>
          <Text size="sm" c="gray.5">Ссылка действует 24 часа и используется один раз.</Text>
        </Stack>

        {!token ? (
          <Card withBorder radius="lg" p="xl" w="100%">
            <Stack gap="md" align="center">
              <ThemeIcon variant="light" color="orange" size={56} radius="xl"><IconMailOff size={28} /></ThemeIcon>
              <Text fw={700} c="dark.9">Ссылка неполная</Text>
              <Text size="sm" c="gray.5" ta="center">Запросите новое письмо для восстановления пароля.</Text>
              <Button component={Link} href="/auth/forgot-password" variant="light" color="indigo">Запросить ссылку</Button>
            </Stack>
          </Card>
        ) : completed ? (
          <Card withBorder radius="lg" p="xl" w="100%">
            <Stack gap="md" align="center">
              <ThemeIcon variant="light" color="green" size={56} radius="xl"><IconCheck size={28} /></ThemeIcon>
              <Text fw={700} c="dark.9">Пароль обновлён</Text>
              <Text size="sm" c="gray.5" ta="center">Перенаправляем на страницу входа.</Text>
            </Stack>
          </Card>
        ) : (
          <Card withBorder radius="lg" p="xl" w="100%" shadow="sm">
            <form onSubmit={handleSubmit}>
              <Stack gap="md">
                <Alert icon={<IconLock size={16} />} color="indigo" variant="light" radius="md">Минимум 8 символов. После смены пароля все активные сессии будут завершены.</Alert>
                <TextInput label="Новый пароль" required type="password" value={password} onChange={(event) => setPassword(event.currentTarget.value)} minLength={8} maxLength={128} autoComplete="new-password" />
                <TextInput label="Повторите пароль" required type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.currentTarget.value)} minLength={8} maxLength={128} autoComplete="new-password" />
                <Button type="submit" size="md" color="indigo" radius="md" loading={loading} fullWidth>Сохранить новый пароль</Button>
                <Text size="xs" c="gray.5" ta="center"><Link href="/auth/signin" style={{ color: "#4f46e5" }}>Вернуться ко входу</Link></Text>
              </Stack>
            </form>
          </Card>
        )}
      </Stack>
    </Container>
  )
}
