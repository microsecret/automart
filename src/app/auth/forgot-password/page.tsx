"use client"
export const dynamic = "force-dynamic"
import { useState } from "react"
import { Container, Card, Stack, Text, TextInput, Button, Alert, ThemeIcon, Box } from "@mantine/core"
import { IconCar, IconMail, IconCheck, IconArrowLeft } from "@tabler/icons-react"
import { notifications } from "@mantine/notifications"
import Link from "next/link"
import { fetchJson, getApiClientErrorMessage } from "@/lib/api-client"

type ForgotPasswordResponse = { message?: string }

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    setLoading(true)
    try {
      const payload = await fetchJson<ForgotPasswordResponse>("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      setSent(true)
      notifications.show({ title: "Проверьте почту", message: payload?.message || "Если аккаунт существует, инструкция уже отправлена.", color: "green" })
    } catch (error) {
      notifications.show({ title: "Не удалось отправить инструкцию", message: getApiClientErrorMessage(error, "Попробуйте позже."), color: "red" })
    } finally {
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
          <Text component="h1" fw={800} fz={24} c="var(--market-ink)" ff="var(--font-display),sans-serif">Восстановление пароля</Text>
          <Text size="sm" c="gray.5">Введите email для сброса</Text>
        </Stack>

        {sent ? (
          <Card withBorder radius="lg" p="xl" w={420}>
            <Stack gap="md" align="center">
              <ThemeIcon variant="light" color="green" size={56} radius="xl"><IconCheck size={28} /></ThemeIcon>
              <Stack gap={0} align="center">
                <Text fw={700} fz="lg" c="var(--market-ink)">Письмо отправлено</Text>
                <Text size="sm" c="gray.5" ta="center">Если аккаунт с таким email существует, инструкции уже отправлены.</Text>
              </Stack>
              <Button component={Link} href="/auth/signin" variant="light" color="indigo" radius="md" leftSection={<IconArrowLeft size={16} />}>Вернуться ко входу</Button>
            </Stack>
          </Card>
        ) : (
          <Card withBorder radius="lg" p="xl" w={420} shadow="sm">
            <form onSubmit={handleSubmit}>
              <Stack gap="md">
                <Alert icon={<IconMail size={16} />} color="indigo" variant="light" radius="md">
                  <Text size="xs" c="gray.7">Мы отправим одноразовую ссылку для установки нового пароля.</Text>
                </Alert>
                <TextInput label="Email" placeholder="your@email.ru" required type="email" value={email} onChange={(e) => setEmail(e.target.value)} size="md" leftSection={<IconMail size={18} />} />
                <Button type="submit" size="md" color="indigo" radius="md" loading={loading} fullWidth>Отправить ссылку</Button>
                <Text size="xs" c="gray.5" ta="center">
                  Вспомнили пароль? <Link href="/auth/signin" style={{ color: "#1c4291" }}>Войти</Link>
                </Text>
              </Stack>
            </form>
          </Card>
        )}
      </Stack>
    </Container>
  )
}
